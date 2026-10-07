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

/** Extra certificate authorities to trust. Only tests pass one; production trusts the system's. */
export interface PinnedTransport {
    ca?: string | Buffer;
}

/**
 * One GET to one pinned address. Follows nothing, decodes nothing, and stops
 * at the byte and time limits. For https the certificate is still checked
 * against the website's name, and the name is still sent as SNI: only the
 * address the socket connects to is taken out of the resolver's hands.
 */
export function pinnedRequest({ url, address, timeoutMs, maxBytes }: PinnedRequest, transport: PinnedTransport = {}): Promise<FetchedResponse> {
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
            ...(transport.ca ? { ca: transport.ca } : {}),
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

type Lookup = (host: string, options: { all: true; verbatim: true }) => Promise<{ address: string; family: number }[]>;

/**
 * The real network: the system resolver, then the pinned request. The
 * resolver and the trusted authorities can be replaced so the whole path can
 * be exercised against a server on this machine.
 */
export function createNodeNetwork(options: { lookup?: Lookup; transport?: PinnedTransport } = {}): ImportNetwork {
    const lookup: Lookup = options.lookup ?? ((host, lookupOptions) => dns.lookup(host, lookupOptions));
    return {
        resolve: async (host) => {
            let answers: { address: string; family: number }[];
            try {
                answers = await lookup(host, { all: true, verbatim: true });
            } catch {
                throw new ImportFetchError("unavailable", `No address found for ${host}.`);
            }
            return answers.map((answer) => ({ address: answer.address, family: answer.family === 6 ? 6 : 4 }));
        },
        request: (request) => pinnedRequest(request, options.transport),
        now: () => Date.now(),
    };
}

export const nodeNetwork: ImportNetwork = createNodeNetwork();

interface Budget {
    deadline: number;
    /** Requests still allowed for the whole import. */
    requestsLeft: number;
}

const decode = (body: Uint8Array) => new TextDecoder("utf-8").decode(body);

/** A lookup that has not answered in time is abandoned; its late answer is never used. */
function within<T>(work: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new ImportFetchError("timeout", "The website's address took too long to look up.")), ms);
        work.then(
            (value) => { clearTimeout(timer); resolve(value); },
            (error) => { clearTimeout(timer); reject(error); },
        );
    });
}

const timeLeft = (network: ImportNetwork, budget: Budget) => {
    const remaining = budget.deadline - network.now();
    if (remaining <= 0) throw new ImportFetchError("timeout", "The import ran out of time.");
    return remaining;
};

/**
 * Reads one URL inside the approved website. Every hop, the first and each
 * redirect, is checked against robots.txt before it is requested, resolved
 * and checked within the time left, and counted against the request limit.
 */
async function fetchWithin(
    network: ImportNetwork,
    approvedHost: string,
    start: ImportTarget,
    budget: Budget,
    mayRead?: (target: ImportTarget) => boolean,
): Promise<{ target: ImportTarget; response: FetchedResponse }> {
    let target = start;
    for (let hop = 0; ; hop += 1) {
        if (mayRead && !mayRead(target)) {
            throw new ImportFetchError("robots-disallowed", "The website asks automated readers not to read that page.");
        }

        const lookupTime = Math.min(IMPORT_LIMITS.requestTimeoutMs, timeLeft(network, budget));
        const addresses = assertPublicAddresses(target.host, await within(network.resolve(target.host), lookupTime));
        const address = addresses[0];
        // Checked again at the point of use, so no caller can skip the check.
        if (!isPublicAddress(address.address)) throw new ImportFetchError("unsafe-address", "Refusing a non-public address.");

        // The lookup took time. Work out what is left again before connecting anywhere.
        const remaining = timeLeft(network, budget);
        if (budget.requestsLeft <= 0) throw new ImportFetchError("request-limit", "The import reached its request limit.");
        budget.requestsLeft -= 1;

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
 * Reads the page the contractor gave and a few more from the same website.
 * It tries at most `IMPORT_LIMITS.maxPages` pages and makes at most
 * `IMPORT_LIMITS.maxRequests` requests in all, within one time budget, and
 * requests nothing that robots.txt asks robots to leave alone.
 */
export async function crawlWebsite(input: string, network: ImportNetwork = nodeNetwork): Promise<CrawlResult> {
    const start = parseImportUrl(input);
    const approvedHost = start.host;
    const budget: Budget = { deadline: network.now() + IMPORT_LIMITS.totalTimeoutMs, requestsLeft: IMPORT_LIMITS.maxRequests };

    // robots.txt first. A site that cannot say what it allows is left alone.
    const robotsTarget = parseImportUrl(new URL("/robots.txt", start.url).toString());
    const robots = await fetchWithin(network, approvedHost, robotsTarget, budget);
    let robotsTxt = "";
    if (robots.response.status >= 200 && robots.response.status < 300) robotsTxt = decode(robots.response.body);
    else if (robots.response.status === 429 || robots.response.status >= 500) {
        throw new ImportFetchError("robots-unavailable", "The website could not say which pages may be read.");
    }
    const allowed = (target: ImportTarget) => isPathAllowed(robotsTxt, `${target.url.pathname}${target.url.search}`);

    const first = await fetchWithin(network, approvedHost, start, budget, allowed);
    if (first.response.status !== 200) throw new ImportFetchError("unavailable", `The website answered with status ${first.response.status}.`);
    if (!isHtml(first.response)) throw new ImportFetchError("not-html", "That address is not a web page.");

    const pages: ImportedPage[] = [{
        url: first.target.url.toString(),
        html: decode(first.response.body),
        fetchedAt: new Date(network.now()).toISOString(),
    }];
    const skipped: CrawlResult["skipped"] = [];
    const seen = new Set([first.target.url.toString(), start.url.toString()]);

    // Attempts are counted, not successes: a website of failing pages cannot draw more requests.
    let attempted = 1;
    for (const link of discoverLinks(pages[0].html)) {
        if (attempted >= IMPORT_LIMITS.maxPages) break;
        const target = resolveWithinWebsite(approvedHost, first.target.url, link);
        if (!target || seen.has(target.url.toString())) continue;
        seen.add(target.url.toString());
        if (!allowed(target)) {
            skipped.push({ url: target.url.toString(), reason: "robots-disallowed" });
            continue;
        }
        attempted += 1;
        try {
            const page = await fetchWithin(network, approvedHost, target, budget, allowed);
            if (page.response.status !== 200 || !isHtml(page.response)) {
                skipped.push({ url: target.url.toString(), reason: "unavailable" });
                continue;
            }
            seen.add(page.target.url.toString());
            pages.push({ url: page.target.url.toString(), html: decode(page.response.body), fetchedAt: new Date(network.now()).toISOString() });
        } catch (error) {
            // The first page was read safely; one further page failing does not undo that.
            const reason = error instanceof ImportFetchError ? error.code : "unavailable";
            skipped.push({ url: target.url.toString(), reason });
            if (reason === "timeout" || reason === "request-limit") break;
        }
    }

    return { website: first.target.url.origin, host: first.target.host, pages, skipped };
}
