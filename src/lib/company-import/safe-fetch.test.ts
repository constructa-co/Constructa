import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TLSSocket } from "node:tls";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { IMPORT_LIMITS, ImportFetchError, assertPublicAddresses } from "./net-policy";
import { crawlWebsite, createNodeNetwork, nodeNetwork, pinnedRequest } from "./safe-fetch";
import { HOME, PUBLIC_V4, SITE, fakeNetwork, html, plain, redirect, type Routes } from "./__fixtures__/site";

const START = "https://www.smithbuilders.co.uk/";
const refusal = async (run: Promise<unknown>) => {
    try { await run; } catch (error) { return error instanceof ImportFetchError ? error.code : `other: ${String(error)}`; }
    return "allowed";
};

describe("crawlWebsite", () => {
    it("reads the page given and a few likely pages from the same website", async () => {
        const net = fakeNetwork(SITE);
        const result = await crawlWebsite("www.smithbuilders.co.uk", net.network);

        expect(result.website).toBe("https://www.smithbuilders.co.uk");
        expect(result.pages.map((page) => page.url)).toEqual([
            START,
            "https://www.smithbuilders.co.uk/contact-us",
            "https://www.smithbuilders.co.uk/about",
            "https://www.smithbuilders.co.uk/services",
        ]);
        expect(result.pages[0].fetchedAt).toBe("2026-10-07T10:00:00.000Z");
        // robots.txt first, then pages; the social link and the blog are never asked for.
        expect(net.requests.map((request) => request.url.pathname)).toEqual(["/robots.txt", "/", "/contact-us", "/about", "/services"]);
        expect(net.requests.every((request) => request.url.host === "www.smithbuilders.co.uk")).toBe(true);
    });

    it("connects only to the address that was checked, for every request", async () => {
        const net = fakeNetwork(SITE);
        await crawlWebsite(START, net.network);
        expect(net.requests.length).toBeGreaterThan(1);
        for (const request of net.requests) {
            expect(request.address).toEqual(PUBLIC_V4);
            expect(request.maxBytes).toBe(IMPORT_LIMITS.maxResponseBytes);
            expect(request.timeoutMs).toBeLessThanOrEqual(IMPORT_LIMITS.requestTimeoutMs);
        }
        expect(net.resolved.length).toBe(net.requests.length);
    });

    it("makes no request at all when the name resolves to a private or local address", async () => {
        for (const address of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.1.10", "::1", "fd00::1", "::ffff:10.0.0.1"]) {
            const net = fakeNetwork(SITE, { "www.smithbuilders.co.uk": [{ address, family: address.includes(":") ? 6 : 4 }] });
            expect(await refusal(crawlWebsite(START, net.network)), address).toBe("unsafe-address");
            expect(net.requests, address).toEqual([]);
        }
    });

    it("refuses a name that mixes one private answer in with public ones", async () => {
        const net = fakeNetwork(SITE, { "www.smithbuilders.co.uk": [PUBLIC_V4, { address: "10.0.0.9", family: 4 }] });
        expect(await refusal(crawlWebsite(START, net.network))).toBe("unsafe-address");
        expect(net.requests).toEqual([]);
    });

    it("stops when the name starts answering with a private address part-way through (DNS rebinding)", async () => {
        // Public for robots.txt and the first page, then private.
        const net = fakeNetwork(SITE, (_host, call) => (call <= 2 ? [PUBLIC_V4] : [{ address: "169.254.169.254", family: 4 }]));
        const result = await crawlWebsite(START, net.network);

        expect(result.pages.map((page) => page.url)).toEqual([START]);
        expect(result.skipped.every((entry) => entry.reason === "unsafe-address")).toBe(true);
        expect(net.requests).toHaveLength(2);
        expect(net.requests.every((request) => request.address.address === PUBLIC_V4.address)).toBe(true);
    });

    it("refuses hostile start addresses before any lookup", async () => {
        for (const url of ["http://169.254.169.254/latest/meta-data/", "http://localhost/", "https://user:pw@www.smithbuilders.co.uk/", "http://[::1]/", "https://www.smithbuilders.co.uk:8443/", "file:///etc/passwd"]) {
            const net = fakeNetwork(SITE);
            expect(await refusal(crawlWebsite(url, net.network)), url).toMatch(/^(unsafe-address|invalid-url)$/);
            expect(net.resolved, url).toEqual([]);
        }
    });

    it("follows a redirect inside the website, checking the new name too", async () => {
        const routes: Routes = {
            ...SITE,
            "https://smithbuilders.co.uk/robots.txt": redirect("https://www.smithbuilders.co.uk/robots.txt"),
            "https://smithbuilders.co.uk/": redirect("https://www.smithbuilders.co.uk/"),
        };
        const net = fakeNetwork(routes);
        const result = await crawlWebsite("smithbuilders.co.uk", net.network);
        expect(result.website).toBe("https://www.smithbuilders.co.uk");
        expect(net.resolved.slice(0, 2)).toEqual(["smithbuilders.co.uk", "www.smithbuilders.co.uk"]);
    });

    it("refuses a redirect that leaves the website, including to an internal address", async () => {
        for (const location of ["https://evil.example.org/", "http://169.254.169.254/latest/meta-data/", "http://localhost:3000/", "https://shop.smithbuilders.co.uk/", "ftp://www.smithbuilders.co.uk/", "https://a:b@www.smithbuilders.co.uk/"]) {
            const net = fakeNetwork({ ...SITE, [START]: redirect(location) });
            expect(await refusal(crawlWebsite(START, net.network)), location).toBe("outside-website");
            expect(net.requests.every((request) => request.url.host === "www.smithbuilders.co.uk"), location).toBe(true);
        }
    });

    it("refuses a redirect to a name inside the website that resolves somewhere private", async () => {
        const net = fakeNetwork(
            { ...SITE, [START]: redirect("https://smithbuilders.co.uk/") },
            { "smithbuilders.co.uk": [{ address: "10.0.0.1", family: 4 }] },
        );
        expect(await refusal(crawlWebsite(START, net.network))).toBe("unsafe-address");
        expect(net.requests.some((request) => request.url.host === "smithbuilders.co.uk")).toBe(false);
    });

    it("refuses a downgrade from https to http and a redirect loop", async () => {
        const downgrade = fakeNetwork({ ...SITE, [START]: redirect("http://www.smithbuilders.co.uk/") });
        expect(await refusal(crawlWebsite(START, downgrade.network))).toBe("outside-website");

        const loop = fakeNetwork({ ...SITE, [START]: redirect("/a"), "https://www.smithbuilders.co.uk/a": redirect("/") });
        expect(await refusal(crawlWebsite(START, loop.network))).toBe("too-many-redirects");
        // The first request plus the allowed number of redirects, and no more.
        expect(loop.requests.filter((request) => request.url.pathname !== "/robots.txt")).toHaveLength(IMPORT_LIMITS.maxRedirects + 1);
    });

    it("never reads more than the page limit, however many links there are", async () => {
        const links = Array.from({ length: 60 }, (_, index) => `<a href="/about-${index}">About ${index}</a>`).join("");
        const routes: Routes = { "https://www.smithbuilders.co.uk/robots.txt": plain(""), [START]: html(`<html><body>${links}</body></html>`) };
        for (let index = 0; index < 60; index += 1) routes[`https://www.smithbuilders.co.uk/about-${index}`] = html("<html><body>x</body></html>");
        const net = fakeNetwork(routes);
        const result = await crawlWebsite(START, net.network);
        expect(result.pages).toHaveLength(IMPORT_LIMITS.maxPages);
        expect(net.requests).toHaveLength(IMPORT_LIMITS.maxPages + 1);
    });

    it("respects robots.txt for the first page and for further pages", async () => {
        const blocked = fakeNetwork({ ...SITE, "https://www.smithbuilders.co.uk/robots.txt": plain("User-agent: *\nDisallow: /\n") });
        expect(await refusal(crawlWebsite(START, blocked.network))).toBe("robots-disallowed");
        expect(blocked.requests.map((request) => request.url.pathname)).toEqual(["/robots.txt"]);

        const partial = fakeNetwork({ ...SITE, "https://www.smithbuilders.co.uk/robots.txt": plain("User-agent: *\nDisallow: /contact\n") });
        const result = await crawlWebsite(START, partial.network);
        expect(result.pages.map((page) => new URL(page.url).pathname)).toEqual(["/", "/about", "/services"]);
        expect(result.skipped).toEqual([{ url: "https://www.smithbuilders.co.uk/contact-us", reason: "robots-disallowed" }]);
        expect(partial.requests.some((request) => request.url.pathname === "/contact-us")).toBe(false);
    });

    it("carries on when there is no robots.txt, and stops when the website cannot say", async () => {
        const none = fakeNetwork({ ...SITE, "https://www.smithbuilders.co.uk/robots.txt": plain("", 404) });
        expect((await crawlWebsite(START, none.network)).pages.length).toBe(4);
        for (const status of [500, 503, 429]) {
            const broken = fakeNetwork({ ...SITE, "https://www.smithbuilders.co.uk/robots.txt": plain("", status) });
            expect(await refusal(crawlWebsite(START, broken.network)), String(status)).toBe("robots-unavailable");
            expect(broken.requests).toHaveLength(1);
        }
    });

    it("reports an unavailable, oversized or non-HTML first page instead of guessing", async () => {
        const missing = fakeNetwork({ ...SITE, [START]: html("gone", 404) });
        expect(await refusal(crawlWebsite(START, missing.network))).toBe("unavailable");

        const pdf = fakeNetwork({ ...SITE, [START]: { status: 200, headers: { "content-type": "application/pdf" }, body: new Uint8Array(10) } });
        expect(await refusal(crawlWebsite(START, pdf.network))).toBe("not-html");

        const huge = fakeNetwork({ ...SITE, [START]: { status: 200, headers: { "content-type": "text/html" }, body: new Uint8Array(IMPORT_LIMITS.maxResponseBytes + 1) } });
        expect(await refusal(crawlWebsite(START, huge.network))).toBe("too-large");

        const down = fakeNetwork({ ...SITE, [START]: () => { throw new ImportFetchError("unavailable", "refused"); } });
        expect(await refusal(crawlWebsite(START, down.network))).toBe("unavailable");
    });

    it("stops at the overall time limit", async () => {
        // Reading the first page uses up the whole budget.
        const routes: Routes = { ...SITE };
        const timed = fakeNetwork(routes);
        routes[START] = () => { timed.advance(IMPORT_LIMITS.totalTimeoutMs + 1); return html(HOME); };
        const result = await crawlWebsite(START, timed.network);
        expect(result.pages).toHaveLength(1);
        expect(result.skipped[0].reason).toBe("timeout");
        expect(timed.requests).toHaveLength(2);
    });

    it("keeps the first page when a later page fails", async () => {
        const net = fakeNetwork({ ...SITE, "https://www.smithbuilders.co.uk/contact-us": html("oops", 500) });
        const result = await crawlWebsite(START, net.network);
        expect(result.pages.map((page) => new URL(page.url).pathname)).toEqual(["/", "/about", "/services"]);
        expect(result.skipped).toEqual([{ url: "https://www.smithbuilders.co.uk/contact-us", reason: "unavailable" }]);
    });
});

describe("crawlWebsite limits", () => {
    it("makes no request after a slow lookup has used up the time", async () => {
        const net = fakeNetwork(SITE);
        const resolve = net.network.resolve;
        // The lookup for the first page answers, but only after the whole budget has gone.
        net.network.resolve = async (host) => {
            const answer = await resolve(host);
            if (net.resolved.length === 2) net.advance(IMPORT_LIMITS.totalTimeoutMs + 1);
            return answer;
        };
        expect(await refusal(crawlWebsite(START, net.network))).toBe("timeout");
        expect(net.requests.map((request) => request.url.pathname)).toEqual(["/robots.txt"]);
    });

    it("abandons a lookup that never answers, and makes no request", async () => {
        vi.useFakeTimers();
        try {
            const net = fakeNetwork(SITE);
            net.network.resolve = () => new Promise(() => {});
            const outcome = refusal(crawlWebsite(START, net.network));
            await vi.advanceTimersByTimeAsync(IMPORT_LIMITS.requestTimeoutMs + 1);
            expect(await outcome).toBe("timeout");
            expect(net.requests).toEqual([]);
        } finally {
            vi.useRealTimers();
        }
    });

    it("never gives a request more time than the import has left", async () => {
        const net = fakeNetwork(SITE);
        const request = net.network.request;
        net.network.request = async (pinned) => {
            const response = await request(pinned);
            net.advance(6_000);
            return response;
        };
        const result = await crawlWebsite(START, net.network);
        // 20 s budget, 6 s a request: three requests fit, the fourth gets what is left, a fifth is never made.
        expect(net.requests.map((entry) => entry.timeoutMs)).toEqual([8_000, 8_000, 8_000, 2_000]);
        expect(result.skipped.at(-1)?.reason).toBe("timeout");
    });

    it("does not follow a redirect into a path robots.txt disallows, for the first page or a later one", async () => {
        const robots = plain("User-agent: *\nDisallow: /private/\n");
        const first = fakeNetwork({
            ...SITE,
            "https://www.smithbuilders.co.uk/robots.txt": robots,
            [START]: redirect("/private/home"),
            "https://www.smithbuilders.co.uk/private/home": html(HOME),
        });
        expect(await refusal(crawlWebsite(START, first.network))).toBe("robots-disallowed");
        expect(first.requests.map((request) => request.url.pathname)).toEqual(["/robots.txt", "/"]);

        const later = fakeNetwork({
            ...SITE,
            "https://www.smithbuilders.co.uk/robots.txt": robots,
            "https://www.smithbuilders.co.uk/contact-us": redirect("/private/contact"),
            "https://www.smithbuilders.co.uk/private/contact": html("<html><body>PRIVATE-PAGE-BODY</body></html>"),
        });
        const result = await crawlWebsite(START, later.network);
        expect(result.skipped).toContainEqual({ url: "https://www.smithbuilders.co.uk/contact-us", reason: "robots-disallowed" });
        expect(later.requests.some((request) => request.url.pathname.startsWith("/private/"))).toBe(false);
        expect(result.pages.some((page) => page.html.includes("PRIVATE-PAGE-BODY"))).toBe(false);
    });

    it("counts pages it tried, not pages that worked", async () => {
        const links = Array.from({ length: 60 }, (_, index) => `<a href="/about-${index}">About ${index}</a>`).join("");
        // Every further page fails. That must not earn more attempts.
        const routes: Routes = { "https://www.smithbuilders.co.uk/robots.txt": plain(""), [START]: html(`<html><body>${links}</body></html>`) };
        for (let index = 0; index < 60; index += 1) routes[`https://www.smithbuilders.co.uk/about-${index}`] = html("broken", 500);
        const net = fakeNetwork(routes);
        const result = await crawlWebsite(START, net.network);
        expect(result.pages).toHaveLength(1);
        expect(result.skipped).toHaveLength(IMPORT_LIMITS.maxPages - 1);
        expect(net.requests).toHaveLength(IMPORT_LIMITS.maxPages + 1);
    });

    it("holds every request of an import, redirects included, under one cap", async () => {
        // Every page bounces three times before answering: the most requests a page may cost.
        const routes: Routes = { "https://www.smithbuilders.co.uk/robots.txt": plain("") };
        const bouncing = (pathname: string, body: string) => {
            routes[`https://www.smithbuilders.co.uk${pathname}`] = redirect(`${pathname === "/" ? "/home" : pathname}-1`);
            const base = pathname === "/" ? "/home" : pathname;
            routes[`https://www.smithbuilders.co.uk${base}-1`] = redirect(`${base}-2`);
            routes[`https://www.smithbuilders.co.uk${base}-2`] = redirect(`${base}-3`);
            routes[`https://www.smithbuilders.co.uk${base}-3`] = html(body);
        };
        bouncing("/", `<html><body>${["a", "b", "c", "d", "e"].map((name) => `<a href="/about-${name}">x</a>`).join("")}</body></html>`);
        for (const name of ["a", "b", "c", "d", "e"]) bouncing(`/about-${name}`, "<html><body>x</body></html>");
        const net = fakeNetwork(routes);
        const result = await crawlWebsite(START, net.network);

        expect(net.requests).toHaveLength(IMPORT_LIMITS.maxRequests);
        expect(result.skipped.at(-1)?.reason).toBe("request-limit");
        expect(net.resolved.length).toBeLessThanOrEqual(IMPORT_LIMITS.maxRequests + 1);
    });
});

/**
 * The real adapter end to end: resolver, then pinned connection, over TLS.
 * The certificate is made here for a name that exists nowhere, and the
 * server is on this machine. No public host is contacted.
 */
describe("createNodeNetwork over TLS", () => {
    const NAME = "www.smithbuilders.co.uk";
    let dir = "";
    let ca = "";
    let server: https.Server;
    let port = 0;
    const handshakes: Array<string | false | null | undefined> = [];
    const lookedUp: string[] = [];
    const lookupLoopback = async (host: string) => { lookedUp.push(host); return [{ address: "127.0.0.1", family: 4 }]; };

    beforeAll(async () => {
        dir = mkdtempSync(path.join(tmpdir(), "constructa-import-tls-"));
        const openssl = (...args: string[]) => execFileSync("openssl", args, { cwd: dir, stdio: "pipe" });
        openssl("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ca.key", "-out", "ca.pem", "-subj", "/CN=Constructa Fixture CA", "-days", "2", "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign");
        openssl("req", "-newkey", "rsa:2048", "-nodes", "-keyout", "leaf.key", "-out", "leaf.csr", "-subj", `/CN=${NAME}`);
        writeFileSync(path.join(dir, "leaf.ext"), `subjectAltName=DNS:${NAME}\nbasicConstraints=CA:FALSE\n`);
        openssl("x509", "-req", "-in", "leaf.csr", "-CA", "ca.pem", "-CAkey", "ca.key", "-CAcreateserial", "-out", "leaf.pem", "-days", "2", "-extfile", "leaf.ext");
        ca = readFileSync(path.join(dir, "ca.pem"), "utf8");

        server = https.createServer({ key: readFileSync(path.join(dir, "leaf.key")), cert: readFileSync(path.join(dir, "leaf.pem")) }, (request, response) => {
            response.writeHead(200, { "content-type": "text/html", "x-host": String(request.headers.host) }).end("<html>secure hello</html>");
        });
        server.on("secureConnection", (socket: TLSSocket) => handshakes.push(socket.servername));
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
        port = (server.address() as AddressInfo).port;
    });
    afterAll(async () => {
        await new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
        rmSync(dir, { recursive: true, force: true });
    });

    const through = async (network: ReturnType<typeof createNodeNetwork>, host: string) => {
        const [address] = await network.resolve(host);
        return network.request({ url: new URL(`https://${host}:${port}/`), address, timeoutMs: 3000, maxBytes: 100 * 1024 });
    };

    it("resolves, pins and completes a verified TLS request, sending the website's name as SNI", async () => {
        const network = createNodeNetwork({ lookup: lookupLoopback, transport: { ca } });
        const response = await through(network, NAME);
        expect(response.status).toBe(200);
        expect(new TextDecoder().decode(response.body)).toBe("<html>secure hello</html>");
        expect(response.headers["x-host"]).toBe(`${NAME}:${port}`);
        expect(handshakes.at(-1)).toBe(NAME);
        expect(lookedUp).toEqual([NAME]);
    });

    it("refuses a certificate issued for a different name, though the address is the same", async () => {
        const network = createNodeNetwork({ lookup: lookupLoopback, transport: { ca } });
        expect(await refusal(through(network, "shop.smithbuilders.co.uk"))).toBe("unavailable");
    });

    it("refuses a certificate from an authority that is not trusted", async () => {
        // No fixture authority here: this is the production trust store.
        const network = createNodeNetwork({ lookup: lookupLoopback });
        expect(await refusal(through(network, NAME))).toBe("unavailable");
    });

    it("refuses when the pinned address is not where the name's server is", async () => {
        const network = createNodeNetwork({ lookup: lookupLoopback, transport: { ca } });
        const response = network.request({ url: new URL(`https://${NAME}:${port}/`), address: { address: "127.0.0.2", family: 4 }, timeoutMs: 1500, maxBytes: 1024 });
        // Nothing listens on the other address: the name is not consulted to find one that does.
        expect(await refusal(response)).toMatch(/^(unavailable|timeout)$/);
    });

    it("turns resolver answers into checked families, and resolver failure into a plain refusal", async () => {
        const mixed = createNodeNetwork({ lookup: async () => [{ address: "93.184.216.34", family: 4 }, { address: "2606:2800:220:1::1", family: 6 }, { address: "10.0.0.1", family: 0 }] });
        expect(await mixed.resolve("a.co.uk")).toEqual([{ address: "93.184.216.34", family: 4 }, { address: "2606:2800:220:1::1", family: 6 }, { address: "10.0.0.1", family: 4 }]);
        const broken = createNodeNetwork({ lookup: async () => { throw Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }); } });
        expect(await refusal(broken.resolve("a.co.uk"))).toBe("unavailable");
    });

    it("the system resolver's answer for this machine is refused by the address check", async () => {
        // The one real lookup in the suite, and it never leaves the machine.
        const answers = await nodeNetwork.resolve("localhost");
        expect(answers.length).toBeGreaterThan(0);
        expect(() => assertPublicAddresses("localhost", answers)).toThrow(ImportFetchError);
    });

    it("the whole import refuses a name that resolves to this machine before any connection", async () => {
        const before = handshakes.length;
        const network = createNodeNetwork({ lookup: lookupLoopback, transport: { ca } });
        expect(await refusal(crawlWebsite(`https://${NAME}/`, network))).toBe("unsafe-address");
        expect(handshakes.length).toBe(before);
    });
});

/**
 * The real transport, against a server on this machine. The fetcher itself
 * would never be handed a loopback address; here it is given one directly so
 * the pin, the byte limit and the time limit can be seen working on a socket.
 */
describe("pinnedRequest", () => {
    let server: http.Server;
    let port = 0;
    const seenHosts: string[] = [];

    beforeAll(async () => {
        server = http.createServer((request, response) => {
            seenHosts.push(String(request.headers.host));
            if (request.url === "/big") {
                response.writeHead(200, { "content-type": "text/html" });
                const chunk = Buffer.alloc(64 * 1024, "a");
                const write = () => { if (!response.destroyed && response.write(chunk)) setImmediate(write); else response.once("drain", write); };
                return write();
            }
            if (request.url === "/declared-big") return response.writeHead(200, { "content-type": "text/html", "content-length": "99999999" }).end();
            if (request.url === "/slow") return void setTimeout(() => response.end("late"), 2000);
            if (request.url === "/gzip") return response.writeHead(200, { "content-encoding": "gzip" }).end("x");
            if (request.url === "/redirect") return response.writeHead(302, { location: "http://127.0.0.1:1/secret" }).end();
            response.writeHead(200, { "content-type": "text/html", "x-agent": String(request.headers["user-agent"]) }).end("<html>hello</html>");
        });
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
        port = (server.address() as AddressInfo).port;
    });
    afterAll(() => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }));

    const ask = (path: string, overrides: Partial<Parameters<typeof pinnedRequest>[0]> = {}) => pinnedRequest({
        // A name that does not exist: only the pin can make this connect.
        url: new URL(`http://www.smithbuilders.co.uk:${port}${path}`),
        address: { address: "127.0.0.1", family: 4 },
        timeoutMs: 1500,
        maxBytes: 100 * 1024,
        ...overrides,
    });

    it("connects to the pinned address, not to wherever the name points, and still sends the name", async () => {
        const response = await ask("/");
        expect(response.status).toBe(200);
        expect(new TextDecoder().decode(response.body)).toBe("<html>hello</html>");
        expect(seenHosts.at(-1)).toBe(`www.smithbuilders.co.uk:${port}`);
        expect(response.headers["x-agent"]).toContain("ConstructaProfileImport");
    });

    it("stops reading at the byte limit, declared or not", async () => {
        expect(await refusal(ask("/big"))).toBe("too-large");
        expect(await refusal(ask("/declared-big"))).toBe("too-large");
    });

    it("gives up at the time limit", async () => {
        expect(await refusal(ask("/slow", { timeoutMs: 150 }))).toBe("timeout");
    });

    it("does not follow redirects or accept compressed bodies itself", async () => {
        const response = await ask("/redirect");
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("http://127.0.0.1:1/secret");
        expect(await refusal(ask("/gzip"))).toBe("unavailable");
    });

    it("reports a refused connection as unavailable", async () => {
        expect(await refusal(ask("/", { url: new URL("http://www.smithbuilders.co.uk:1/") }))).toBe("unavailable");
    });
});
