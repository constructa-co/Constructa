/**
 * Bounded, guarded reading of a contractor's own website.
 *
 * Every request goes through the same three steps: the URL is checked
 * (`net-policy.ts`), the name is resolved and every address it resolves to
 * must be public, and the connection is then made to one of those checked
 * addresses and no other. Because the socket is pinned to the address that
 * was checked, a name that answers differently a moment later (DNS
 * rebinding) cannot move the connection somewhere private. Redirects are
 * never followed by the HTTP client; each one is put through the same three
 * steps as a new request.
 *
 * Server only. The network is passed in so tests never touch a real one.
 */

import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import {
    IMPORT_LIMITS,
    ImportFetchError,
    assertPublicAddresses,
    isPublicAddress,
    parseImportUrl,
    resolveWithinWebsite,
    type ImportTarget,
    type ResolvedAddress,
} from "./net-policy";
import { IMPORT_USER_AGENT, isPathAllowed } from "./robots";
import { discoverLinks } from "./extract";

export interface PinnedRequest {
    url: URL;
    /** The checked address the socket must connect to. */
    address: ResolvedAddress;
    timeoutMs: number;
    maxBytes: number;
}

export interface FetchedResponse {
    status: number;
    headers: Record<string, string>;
    body: Uint8Array;
}

export interface ImportNetwork {
    resolve(host: string): Promise<ResolvedAddress[]>;
    request(request: PinnedRequest): Promise<FetchedResponse>;
    now(): number;
}

const sameAddress = (a: string | undefined, b: string) =>
    (a ?? "").toLowerCase().replace(/^::ffff:/, "") === b.toLowerCase();

/** One GET to one pinned address. Follows nothing, decodes nothing, and stops at the byte and time limits. */
export function pinnedRequest({ url, address, timeoutMs, maxBytes }: PinnedRequest): Promise<FetchedResponse> {
    return new Promise((resolve, reject) => {
        const client = url.protocol === "https:" ? https : http;
        let settled = false;
        const finish = (error: ImportFetchError | null, value?: FetchedResponse) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            request.destroy();
            if (error) reject(error);
            else resolve(value as FetchedResponse);
        };

        const request = client.request({
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.port || (url.protocol === "https:" ? 443 : 80),
            path: `${url.pathname}${url.search}`,
            method: "GET",
            // A fresh socket every time: a pooled one could belong to another address.
            agent: false,
            headers: {
                "user-agent": `${IMPORT_USER_AGENT}/1.0`,
                accept: "text/html,text/plain;q=0.8",
                "accept-encoding": "identity",
            },
            // The name was resolved and checked already. This is the pin.
            lookup: (_hostname, options, callback) => {
                const done = callback as (error: Error | null, address: unknown, family?: number) => void;
                if (typeof options === "object" && options?.all) done(null, [{ address: address.address, family: address.family }]);
                else done(null, address.address, address.family);
            },
        });

        const timer = setTimeout(() => finish(new ImportFetchError("timeout", "The website took too long to answer.")), timeoutMs);

        request.on("socket", (socket) => {
            socket.once("connect", () => {
                // Belt and braces: the socket must be where the pin said.
                if (!sameAddress(socket.remoteAddress, address.address)) {
                    finish(new ImportFetchError("unsafe-address", "The connection went to an unexpected address."));
                }
            });
        });
        request.on("error", () => finish(new ImportFetchError("unavailable", "The website could not be reached.")));
        request.on("response", (response) => {
            const headers: Record<string, string> = {};
            for (const [name, value] of Object.entries(response.headers)) {
                if (typeof value === "string") headers[name.toLowerCase()] = value;
            }
            if (headers["content-encoding"] && headers["content-encoding"].toLowerCase() !== "identity") {
                return finish(new ImportFetchError("unavailable", "The website sent a compressed page that was not asked for."));
            }
            if (Number(headers["content-length"]) > maxBytes) {
                return finish(new ImportFetchError("too-large", "The page is too large to read."));
            }
            const chunks: Buffer[] = [];
            let received = 0;
            response.on("data", (chunk: Buffer) => {
                received += chunk.length;
                if (received > maxBytes) return finish(new ImportFetchError("too-large", "The page is too large to read."));
                chunks.push(chunk);
            });
            response.on("error", () => finish(new ImportFetchError("unavailable", "The website stopped answering.")));
            response.on("end", () => finish(null, { status: response.statusCode ?? 0, headers, body: Buffer.concat(chunks) }));
        });
        request.end();
    });
}

export const nodeNetwork: ImportNetwork = {
    resolve: async (host) => {
        try {
            const answers = await dns.lookup(host, { all: true, verbatim: true });
            return answers.map((answer) => ({ address: answer.address, family: answer.family === 6 ? 6 : 4 }));
        } catch {
            throw new ImportFetchError("unavailable", `No address found for ${host}.`);
        }
    },
    request: pinnedRequest,
    now: () => Date.now(),
};

interface Budget {
    deadline: number;
}

const decode = (body: Uint8Array) => new TextDecoder("utf-8").decode(body);

/** Reads one URL inside the approved website, checking every hop. */
async function fetchWithin(
    network: ImportNetwork,
    approvedHost: string,
    start: ImportTarget,
    budget: Budget,
): Promise<{ target: ImportTarget; response: FetchedResponse }> {
    let target = start;
    for (let hop = 0; ; hop += 1) {
        const remaining = budget.deadline - network.now();
        if (remaining <= 0) throw new ImportFetchError("timeout", "The import ran out of time.");

        const addresses = assertPublicAddresses(target.host, await network.resolve(target.host));
        const address = addresses[0];
        // Checked again at the point of use, so no caller can skip the check.
        if (!isPublicAddress(address.address)) throw new ImportFetchError("unsafe-address", "Refusing a non-public address.");

        const response = await network.request({
            url: target.url,
            address,
            timeoutMs: Math.min(IMPORT_LIMITS.requestTimeoutMs, remaining),
            maxBytes: IMPORT_LIMITS.maxResponseBytes,
        });
        if (response.body.byteLength > IMPORT_LIMITS.maxResponseBytes) {
            throw new ImportFetchError("too-large", "The page is too large to read.");
        }

        if (response.status < 300 || response.status > 399) return { target, response };

        if (hop >= IMPORT_LIMITS.maxRedirects) throw new ImportFetchError("too-many-redirects", "The website redirected too many times.");
        const next = response.headers.location ? resolveWithinWebsite(approvedHost, target.url, response.headers.location) : null;
        if (!next) throw new ImportFetchError("outside-website", "The website redirected somewhere outside itself.");
        if (target.url.protocol === "https:" && next.url.protocol !== "https:") {
            throw new ImportFetchError("outside-website", "The website redirected from a secure page to an insecure one.");
        }
        target = next;
    }
}

export interface ImportedPage {
    url: string;
    html: string;
    fetchedAt: string;
}

export interface CrawlResult {
    /** Origin of the website as finally reached, e.g. https://www.smithbuilders.co.uk */
    website: string;
    host: string;
    pages: ImportedPage[];
    /** Pages that were found but not read, and why. */
    skipped: { url: string; reason: string }[];
}

const isHtml = (response: FetchedResponse) => /^(text\/html|application\/xhtml\+xml)\b/i.test(response.headers["content-type"] ?? "");

/**
 * Reads the page the contractor gave and a few more from the same website:
 * at most `IMPORT_LIMITS.maxPages` pages, all within the time budget, and
 * none that robots.txt asks robots to leave alone.
 */
export async function crawlWebsite(input: string, network: ImportNetwork = nodeNetwork): Promise<CrawlResult> {
    const start = parseImportUrl(input);
    const approvedHost = start.host;
    const budget: Budget = { deadline: network.now() + IMPORT_LIMITS.totalTimeoutMs };

    // robots.txt first. A site that cannot say what it allows is left alone.
    const robotsTarget = parseImportUrl(new URL("/robots.txt", start.url).toString());
    const robots = await fetchWithin(network, approvedHost, robotsTarget, budget);
    let robotsTxt = "";
    if (robots.response.status >= 200 && robots.response.status < 300) robotsTxt = decode(robots.response.body);
    else if (robots.response.status === 429 || robots.response.status >= 500) {
        throw new ImportFetchError("robots-unavailable", "The website could not say which pages may be read.");
    }
    const allowed = (target: ImportTarget) => isPathAllowed(robotsTxt, `${target.url.pathname}${target.url.search}`);

    if (!allowed(start)) throw new ImportFetchError("robots-disallowed", "The website asks automated readers not to read that page.");
    const first = await fetchWithin(network, approvedHost, start, budget);
    if (!allowed(first.target)) throw new ImportFetchError("robots-disallowed", "The website asks automated readers not to read that page.");
    if (first.response.status !== 200) throw new ImportFetchError("unavailable", `The website answered with status ${first.response.status}.`);
    if (!isHtml(first.response)) throw new ImportFetchError("not-html", "That address is not a web page.");

    const pages: ImportedPage[] = [{
        url: first.target.url.toString(),
        html: decode(first.response.body),
        fetchedAt: new Date(network.now()).toISOString(),
    }];
    const skipped: CrawlResult["skipped"] = [];
    const seen = new Set([first.target.url.toString(), start.url.toString()]);

    for (const link of discoverLinks(pages[0].html)) {
        if (pages.length >= IMPORT_LIMITS.maxPages) break;
        const target = resolveWithinWebsite(approvedHost, first.target.url, link);
        if (!target || seen.has(target.url.toString())) continue;
        seen.add(target.url.toString());
        if (!allowed(target)) {
            skipped.push({ url: target.url.toString(), reason: "robots-disallowed" });
            continue;
        }
        try {
            const page = await fetchWithin(network, approvedHost, target, budget);
            if (page.response.status !== 200 || !isHtml(page.response) || !allowed(page.target)) {
                skipped.push({ url: target.url.toString(), reason: "unavailable" });
                continue;
            }
            seen.add(page.target.url.toString());
            pages.push({ url: page.target.url.toString(), html: decode(page.response.body), fetchedAt: new Date(network.now()).toISOString() });
        } catch (error) {
            // The first page was read safely; one further page failing does not undo that.
            skipped.push({ url: target.url.toString(), reason: error instanceof ImportFetchError ? error.code : "unavailable" });
            if (error instanceof ImportFetchError && error.code === "timeout") break;
        }
    }

    return { website: first.target.url.origin, host: first.target.host, pages, skipped };
}
