import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createContext, runInContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import OfflinePage from "@/app/offline/page";

// A091: the REAL public/sw.js, run in a node:vm context with a fake self,
// CacheStorage and fetch. Node's own Response is used. Synthetic pages only.
const ORIGIN = "https://app.example.test";
const SOURCE = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
type FakeRequest = { url: string; method: string; mode: string; headers: Headers };
type Responder = (url: string, init?: RequestInit) => Response | Promise<Response>;

function worker(network: Responder, seed: Record<string, Record<string, Response>> = {}) {
    const stores = new Map<string, Map<string, Response>>(Object.entries(seed).map(([name, entries]) => [name, new Map(Object.entries(entries))]));
    const key = (input: string | FakeRequest) => new URL(typeof input === "string" ? input : input.url, ORIGIN).href;
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    let online = true;
    const fetch = async (input: string | FakeRequest, init?: RequestInit) => {
        const url = key(input);
        fetchCalls.push({ url, init });
        if (!online) throw new TypeError("Failed to fetch");
        return network(url, init);
    };
    const open = (name: string) => {
        if (!stores.has(name)) stores.set(name, new Map());
        const store = stores.get(name)!;
        return {
            put: async (input: string | FakeRequest, response: Response) => { store.set(key(input), response); },
            match: async (input: string | FakeRequest) => store.get(key(input))?.clone(),
            // Browser addAll semantics: fetch each with defaults, store any ok response.
            addAll: async (urls: string[]) => {
                for (const url of urls) {
                    const response = await fetch(url);
                    if (!response.ok) throw new TypeError("addAll failed");
                    store.set(key(url), response);
                }
            },
        };
    };
    const caches = {
        open: async (name: string) => open(name),
        keys: async () => [...stores.keys()],
        delete: async (name: string) => stores.delete(name),
        match: async (input: string | FakeRequest) => {
            for (const store of stores.values()) { const hit = store.get(key(input)); if (hit) return hit.clone(); }
            return undefined;
        },
    };
    const listeners: Record<string, (event: unknown) => void> = {};
    const self = {
        location: { origin: ORIGIN },
        addEventListener: (type: string, handler: (event: unknown) => void) => { listeners[type] = handler; },
        skipWaiting: () => undefined,
        clients: { claim: () => undefined },
    };
    const context = createContext({ self, caches, fetch, Response, URL, Headers, Promise, console });
    runInContext(SOURCE, context);
    const lifecycle = async (type: "install" | "activate") => {
        const waits: Promise<unknown>[] = [];
        listeners[type]({ waitUntil: (promise: Promise<unknown>) => { waits.push(promise); } });
        await Promise.allSettled(waits);
        return Promise.all(waits).then(() => "ok", () => "rejected");
    };
    const request = async (path: string, mode = "navigate", headers: Record<string, string> = {}) => {
        let responded: Promise<Response> | null = null;
        listeners.fetch({ request: { url: new URL(path, ORIGIN).href, method: "GET", mode, headers: new Headers(headers) }, respondWith: (promise: Promise<Response>) => { responded = promise; } });
        const response = responded ? await responded : null;
        for (let i = 0; i < 10; i++) await Promise.resolve();
        return response as Response | null;
    };
    const cached = () => [...stores.entries()].flatMap(([name, store]) => [...store.keys()].map(url => `${name} ${new URL(url).pathname}${new URL(url).search}`));
    return { stores, fetchCalls, lifecycle, request, cached, offline: () => { online = false; }, online: () => { online = true; } };
}

const html = (body: string, init: ResponseInit = {}) => new Response(`<html><body>${body}</body></html>`, { status: 200, headers: { "Content-Type": "text/html" }, ...init });
const site: Responder = url => {
    const path = new URL(url).pathname;
    if (path === "/offline") return html("You're offline", { headers: { "Content-Type": "text/html", "Cache-Control": "s-maxage=31536000" } });
    if (path.startsWith("/icons/")) return new Response("<svg/>", { status: 200, headers: { "Content-Type": "image/svg+xml" } });
    if (path.startsWith("/dashboard")) return html("PRIVATE account A: Smith kitchen £48,000", { headers: { "Content-Type": "text/html", "Cache-Control": "private, no-store" } });
    if (path.startsWith("/proposal/")) return html("Client proposal for token holder");
    return html("public page");
};

describe("A091 service worker never stores or replays pages", () => {
    it.each([
        ["a signed-in dashboard page", "/dashboard/projects/costs?projectId=job-a"],
        ["a token-bearing public proposal", "/proposal/abababababababab"],
        ["a public page with a query", "/?ref=newsletter"],
        ["an ordinary public page", "/about"],
    ])("does not write %s into any cache", async (_label, path) => {
        const sw = worker(site);
        await sw.lifecycle("install"); await sw.lifecycle("activate");
        const before = sw.cached();
        expect((await sw.request(path))?.status).toBe(200);
        expect(sw.cached()).toEqual(before);
        expect(sw.cached().some(entry => entry.includes("/dashboard") || entry.includes("/proposal") || entry.includes("?"))).toBe(false);
    });

    it("never replays another account's page from an old cache when offline; it shows the generic offline page", async () => {
        const sw = worker(site, { "constructa-v1": { [`${ORIGIN}/dashboard/projects`]: html("PRIVATE account A: Smith kitchen") } });
        await sw.lifecycle("install");
        sw.offline();
        const response = await sw.request("/dashboard/projects");
        expect(await response!.text()).not.toContain("PRIVATE");
        // Before activation too: the old cache is never a source.
        const fresh = worker(site, { "constructa-v1": { [`${ORIGIN}/dashboard/projects`]: html("PRIVATE account A") } });
        await fresh.lifecycle("install"); fresh.offline();
        const text = await (await fresh.request("/dashboard/projects"))!.text();
        expect(text).toContain("You're offline");
        expect(text).not.toContain("PRIVATE");
    });

    it("does not answer a data or RSC request with the offline HTML", async () => {
        const sw = worker(site);
        await sw.lifecycle("install"); sw.offline();
        const response = await sw.request("/dashboard/projects?_rsc=abc", "cors", { RSC: "1" });
        expect(response === null || response.type === "error").toBe(true);
    });

    it("stores the offline page and icons anonymously, and refuses a redirected or private one", async () => {
        const sw = worker(site);
        await sw.lifecycle("install");
        expect(sw.fetchCalls.filter(call => call.url.endsWith("/offline")).every(call => call.init?.credentials === "omit")).toBe(true);
        expect(sw.cached().sort()).toEqual(["constructa-static-v2 /icons/icon-192.svg", "constructa-static-v2 /icons/icon-512.svg", "constructa-static-v2 /offline"]);

        for (const bad of [
            () => { const response = html("Sign in, account A"); Object.defineProperty(response, "redirected", { value: true }); return response; },
            () => html("private offline", { headers: { "Cache-Control": "private, no-store" } }),
        ]) {
            const risky = worker(url => new URL(url).pathname === "/offline" ? bad() : site(url));
            expect(await risky.lifecycle("install")).toBe("ok");
            expect(risky.cached().some(entry => entry.endsWith("/offline"))).toBe(false);
        }
    });

    it("removes only its own obsolete cache on activation, leaving other caches on the origin", async () => {
        const sw = worker(site, { "constructa-v1": {}, "another-app-cache": {}, "workbox-precache-v2": {} });
        await sw.lifecycle("install"); await sw.lifecycle("activate");
        expect([...sw.stores.keys()].sort()).toEqual(["another-app-cache", "constructa-static-v2", "workbox-precache-v2"]);
    });

    it("keeps the offline page and icons available offline", async () => {
        const sw = worker(site);
        await sw.lifecycle("install"); await sw.lifecycle("activate"); sw.offline();
        expect(await (await sw.request("/somewhere"))!.text()).toContain("You're offline");
        expect(await (await sw.request("/icons/icon-192.svg", "no-cors"))!.text()).toBe("<svg/>");
    });

    it("still installs when the offline page cannot be fetched", async () => {
        const sw = worker(url => new URL(url).pathname === "/offline" ? new Response("down", { status: 503 }) : site(url));
        expect(await sw.lifecycle("install")).toBe("ok");
    });
});

describe("A091 offline page", () => {
    it("promises no stored pages and shows no account data", () => {
        const markup = renderToStaticMarkup(createElement(OfflinePage));
        expect(markup).toContain("offline");
        expect(markup).not.toMatch(/recently visited|still be available|available below/i);
    });
});
