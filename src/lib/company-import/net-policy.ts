/**
 * Where the company-website import may connect. Pure rules, no I/O.
 *
 * The import fetches a URL a contractor typed, from the server. Everything
 * here exists so that request can only ever reach an ordinary public web
 * server: never this machine, the hosting provider's metadata service, or
 * anything on a private network. When a rule cannot prove an address is
 * public, the answer is no.
 */

export const IMPORT_LIMITS = {
    /** HTML pages read from the website, not counting robots.txt. */
    maxPages: 4,
    /** Bytes accepted for any one response body. */
    maxResponseBytes: 512 * 1024,
    /** Redirects followed for any one page. */
    maxRedirects: 3,
    /** Milliseconds for any one request, connection to last byte. */
    requestTimeoutMs: 8_000,
    /** Milliseconds for the whole import. */
    totalTimeoutMs: 20_000,
    maxUrlLength: 2000,
} as const;

export type ImportFailureCode =
    | "invalid-url"
    | "unsafe-address"
    | "outside-website"
    | "too-many-redirects"
    | "too-large"
    | "timeout"
    | "not-html"
    | "robots-disallowed"
    | "robots-unavailable"
    | "unavailable";

export class ImportFetchError extends Error {
    constructor(readonly code: ImportFailureCode, detail: string) {
        super(detail);
        this.name = "ImportFetchError";
    }
}

const fail = (code: ImportFailureCode, detail: string): never => {
    throw new ImportFetchError(code, detail);
};

// ── Addresses ────────────────────────────────────────────────────────────────

function parseIpv4(value: string): number[] | null {
    const parts = value.split(".");
    if (parts.length !== 4) return null;
    const octets = parts.map((part) => (/^(0|[1-9]\d{0,2})$/.test(part) ? Number(part) : NaN));
    return octets.every((octet) => octet >= 0 && octet <= 255) ? octets : null;
}

/** Public, routable IPv4 only. Every special-purpose block is refused. */
function isPublicIpv4(octets: number[]): boolean {
    const [a, b, c] = octets;
    if (a === 0 || a === 10 || a === 127) return false;            // this network, private, loopback
    if (a === 100 && b >= 64 && b <= 127) return false;            // carrier-grade NAT
    if (a === 169 && b === 254) return false;                      // link-local, cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false;             // private
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // protocol assignments, documentation
    if (a === 192 && b === 88 && c === 99) return false;           // 6to4 relay
    if (a === 192 && b === 168) return false;                      // private
    if (a === 198 && (b === 18 || b === 19)) return false;         // benchmarking
    if (a === 198 && b === 51 && c === 100) return false;          // documentation
    if (a === 203 && b === 0 && c === 113) return false;           // documentation
    if (a >= 224) return false;                                    // multicast, reserved, broadcast
    return true;
}

/** Eight 16-bit groups, or null when the text is not an IPv6 address. */
function parseIpv6(value: string): number[] | null {
    let text = value.toLowerCase();
    if (text.includes("%")) return null; // zone identifiers are never public
    // A trailing dotted quad is two groups.
    const lastColon = text.lastIndexOf(":");
    const tail = text.slice(lastColon + 1);
    if (tail.includes(".")) {
        const v4 = parseIpv4(tail);
        if (!v4) return null;
        text = `${text.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
    }
    const halves = text.split("::");
    if (halves.length > 2) return null;
    const groupsOf = (part: string) => (part === "" ? [] : part.split(":"));
    const head = groupsOf(halves[0]);
    const rest = halves.length === 2 ? groupsOf(halves[1]) : [];
    if (halves.length === 1 && head.length !== 8) return null;
    if (halves.length === 2 && head.length + rest.length > 7) return null;
    const groups = halves.length === 2
        ? [...head, ...Array(8 - head.length - rest.length).fill("0"), ...rest]
        : head;
    if (!groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return null;
    return groups.map((group) => parseInt(group, 16));
}

/**
 * Global unicast IPv6 only (2000::/3), less the ranges inside it that tunnel
 * to or stand in for something else. Addresses that embed an IPv4 address
 * are refused outright rather than unwrapped.
 */
function isPublicIpv6(groups: number[]): boolean {
    const [g0, g1] = groups;
    if ((g0 & 0xe000) !== 0x2000) return false;      // ::, ::1, ::ffff:0:0/96, 64:ff9b::/96, fc00::/7, fe80::/10, ff00::/8
    if (g0 === 0x2001 && g1 === 0x0000) return false; // Teredo
    if (g0 === 0x2001 && g1 === 0x0db8) return false; // documentation
    if (g0 === 0x2001 && (g1 & 0xfff0) === 0x0010) return false; // ORCHID
    if (g0 === 0x2001 && (g1 & 0xfff0) === 0x0020) return false; // ORCHIDv2
    if (g0 === 0x2002) return false;                  // 6to4
    return true;
}

export function isIpLiteral(host: string): boolean {
    const bare = host.replace(/^\[|\]$/g, "");
    return parseIpv4(bare) !== null || bare.includes(":");
}

/** True only for an address that is certainly a public internet address. */
export function isPublicAddress(address: string): boolean {
    const v4 = parseIpv4(address);
    if (v4) return isPublicIpv4(v4);
    const v6 = parseIpv6(address);
    return v6 ? isPublicIpv6(v6) : false;
}

export interface ResolvedAddress {
    address: string;
    family: 4 | 6;
}

/**
 * Every address a name resolves to must be public. One private answer among
 * public ones is how a name is pointed at an internal service, so a mixed
 * answer is refused as a whole.
 */
export function assertPublicAddresses(host: string, addresses: ResolvedAddress[]): ResolvedAddress[] {
    if (addresses.length === 0) fail("unavailable", `No address found for ${host}.`);
    for (const entry of addresses) {
        if (!isPublicAddress(entry.address)) fail("unsafe-address", `${host} resolves to an address that is not public.`);
    }
    return addresses;
}

// ── URLs ─────────────────────────────────────────────────────────────────────

const BLOCKED_HOST_SUFFIXES = [".local", ".localhost", ".internal", ".intranet", ".lan", ".home", ".corp", ".home.arpa", ".test", ".invalid", ".example", ".onion"];

export interface ImportTarget {
    url: URL;
    /** Lower-case host without a trailing dot. */
    host: string;
}

/**
 * A URL the import may request: http or https on the standard port, a real
 * domain name, and no credentials. IP addresses are refused; a company
 * website has a name.
 */
export function parseImportUrl(input: string): ImportTarget {
    const text = typeof input === "string" ? input.trim() : "";
    if (!text || text.length > IMPORT_LIMITS.maxUrlLength) fail("invalid-url", "The address is missing or too long.");
    let url: URL;
    try {
        url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
    } catch {
        return fail("invalid-url", "The address is not a web address.");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") fail("invalid-url", "Only http and https addresses can be used.");
    if (url.username || url.password) fail("invalid-url", "The address must not contain a user name or password.");
    if (url.port) fail("invalid-url", "The address must use the standard web port.");

    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!host || isIpLiteral(host)) fail("unsafe-address", "Use the website's name, not a numeric address.");
    if (!host.includes(".") || host === "localhost") fail("unsafe-address", "That is not a public website name.");
    if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) fail("unsafe-address", "That is not a public website name.");
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) fail("invalid-url", "The website name is not valid.");

    url.hash = "";
    return { url, host };
}

const bareHost = (host: string) => host.replace(/^www\./, "");

/**
 * The approved website is the name the contractor confirmed, with or without
 * "www.". A subdomain, a different name, or anything else is outside it.
 */
export function isWithinWebsite(approvedHost: string, candidateHost: string): boolean {
    return bareHost(approvedHost.toLowerCase()) === bareHost(candidateHost.toLowerCase());
}

/** Resolves a link or redirect against the page it came from, or null when it leaves the approved website. */
export function resolveWithinWebsite(approvedHost: string, base: URL, reference: string): ImportTarget | null {
    let next: URL;
    try {
        next = new URL(reference, base);
    } catch {
        return null;
    }
    if (next.protocol !== "http:" && next.protocol !== "https:") return null;
    try {
        const target = parseImportUrl(next.toString());
        return isWithinWebsite(approvedHost, target.host) ? target : null;
    } catch {
        return null;
    }
}
