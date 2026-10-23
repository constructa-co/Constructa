/**
 * Deterministic extraction of a few company facts from fetched pages.
 *
 * The pages are untrusted text. Nothing in them is executed, followed as an
 * instruction, or passed to a model: they are searched for a fixed set of
 * patterns, and each match becomes a suggestion a contractor must approve.
 * When a pattern is not clearly there, no suggestion is made.
 */

import type { ImportedPage } from "./safe-fetch";

export type ImportField =
    | "company_name"
    | "website"
    | "company_number"
    | "vat_number"
    | "specialisms"
    | "phone"
    | "sales_email"
    | "address";

export type SuggestionBasis = "structured-data" | "contact-link" | "page-text" | "page-heading" | "confirmed-address";

export interface Suggestion {
    field: ImportField;
    value: string;
    sourceUrl: string;
    /** The piece of the page the value came from, as plain text. */
    excerpt: string;
    basis: SuggestionBasis;
}

export const FIELD_MAX: Record<ImportField, number> = {
    company_name: 200,
    website: 300,
    company_number: 10,
    vat_number: 14,
    specialisms: 600,
    phone: 30,
    sales_email: 200,
    address: 300,
};

const MAX_EXCERPT = 240;
const MAX_JSON_LD_BYTES = 60_000;
const MAX_SERVICES = 12;

// ── Plain text out of markup ─────────────────────────────────────────────────

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", pound: "£", ndash: "-", mdash: "-" };

function decodeEntities(text: string): string {
    return text.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (whole, body: string) => {
        if (body[0] !== "#") return ENTITIES[body.toLowerCase()] ?? whole;
        const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
        return code > 31 && code < 0x10ffff ? String.fromCodePoint(code) : " ";
    });
}

/** One line of plain text: no tags, no control characters, single spaces. */
export function plainText(fragment: string): string {
    return decodeEntities(fragment.replace(/<[^>]*>/g, " "))
        .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f\ufeff]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** Markup with everything that is not page content taken out. */
function contentOnly(html: string): string {
    return html
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<(script|style|noscript|template|svg|iframe|object|head)\b[\s\S]*?<\/\1\s*>/gi, " ");
}

const attribute = (tag: string, name: string): string | null => {
    const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
    return match ? decodeEntities(match[1] ?? match[2] ?? match[3] ?? "").trim() : null;
};

// ── Links worth reading next ─────────────────────────────────────────────────

const LINK_PRIORITY = [/contact/i, /about/i, /services?|what-we-do/i];

/** Links on a page, the likeliest sources of company facts first. Resolving and bounding them is the fetcher's job. */
export function discoverLinks(html: string): string[] {
    const found: { href: string; rank: number }[] = [];
    for (const match of contentOnly(html).matchAll(/<a\b[^>]{0,2000}>/gi)) {
        const href = attribute(match[0], "href");
        if (!href || /^(#|mailto:|tel:|javascript:|data:)/i.test(href) || href.length > 500) continue;
        const rank = LINK_PRIORITY.findIndex((pattern) => pattern.test(href));
        if (rank >= 0) found.push({ href, rank });
        if (found.length >= 200) break;
    }
    return Array.from(new Set(found.sort((a, b) => a.rank - b.rank).map((entry) => entry.href)));
}

// ── Structured data ──────────────────────────────────────────────────────────

type Json = Record<string, unknown>;

const NOT_A_COMPANY = new Set(["website", "webpage", "person", "breadcrumblist", "article", "blogposting", "product", "service", "faqpage", "imageobject", "searchaction", "listitem", "offer", "review", "postaladdress"]);

function structuredCompanies(html: string): Json[] {
    const companies: Json[] = [];
    const visit = (node: unknown, depth: number) => {
        if (depth > 4 || !node || typeof node !== "object") return;
        if (Array.isArray(node)) return node.slice(0, 50).forEach((entry) => visit(entry, depth + 1));
        const record = node as Json;
        const types = [record["@type"]].flat().filter((type): type is string => typeof type === "string");
        if (types.length > 0 && !types.some((type) => NOT_A_COMPANY.has(type.toLowerCase())) && typeof record.name === "string") {
            companies.push(record);
        }
        visit(record["@graph"], depth + 1);
    };
    for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
        if (match[1].length > MAX_JSON_LD_BYTES) continue;
        try {
            visit(JSON.parse(match[1]), 0);
        } catch {
            // Not valid JSON: ignored, never repaired or guessed at.
        }
    }
    return companies;
}

const text = (value: unknown): string => (typeof value === "string" ? plainText(value) : "");

function structuredAddress(value: unknown): string {
    if (typeof value === "string") return plainText(value);
    if (!value || typeof value !== "object" || Array.isArray(value)) return "";
    const address = value as Json;
    return ["streetAddress", "addressLocality", "addressRegion", "postalCode"]
        .map((key) => text(address[key]))
        .filter(Boolean)
        .join(", ");
}

function structuredServices(company: Json): string[] {
    const names: string[] = [];
    const add = (value: unknown) => {
        const name = text(typeof value === "object" && value ? (value as Json).name : value);
        if (name) names.push(name);
    };
    const list = (value: unknown): unknown[] => (Array.isArray(value) ? value.slice(0, 40) : value ? [value] : []);
    for (const offer of list(company.makesOffer)) add((offer as Json)?.itemOffered ?? offer);
    const catalog = company.hasOfferCatalog as Json | undefined;
    for (const entry of list(catalog?.itemListElement)) add((entry as Json)?.itemOffered ?? entry);
    for (const topic of list(company.knowsAbout)) add(topic);
    return names;
}

// ── Field rules ──────────────────────────────────────────────────────────────

const PHONE = /^\+?[\d\s().-]{9,22}$/;
const EMAIL = /^[a-z0-9._%+-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

function cleanPhone(raw: string): string | null {
    const value = plainText(raw).replace(/^tel:/i, "").trim();
    const digits = value.replace(/\D/g, "");
    return PHONE.test(value) && digits.length >= 9 && digits.length <= 15 ? value.replace(/\s+/g, " ") : null;
}

function cleanEmail(raw: string): string | null {
    const value = plainText(raw).replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase();
    return EMAIL.test(value) && value.length <= FIELD_MAX.sales_email ? value : null;
}

function joinServices(names: string[]): string | null {
    const kept: string[] = [];
    for (const name of names) {
        const value = name.replace(/[,;]+/g, " ").replace(/\s+/g, " ").trim();
        if (value.length < 3 || value.length > 60) continue;
        if (!kept.some((entry) => entry.toLowerCase() === value.toLowerCase())) kept.push(value);
        if (kept.length >= MAX_SERVICES) break;
    }
    const joined = kept.join(", ");
    return kept.length >= 2 && joined.length <= FIELD_MAX.specialisms ? joined : null;
}

const HEADING_NOISE = /^(our )?(services|what we do|contact( us)?|about( us)?|get in touch|testimonials|reviews|gallery|home|menu|why choose us|faqs?)$/i;

function around(source: string, index: number, length: number): string {
    const start = Math.max(0, index - 60);
    return clip(source.slice(start, index + length + 60).trim(), MAX_EXCERPT);
}

/** Suggestions from one page, best evidence first within each field. */
function fromPage(page: ImportedPage): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const add = (field: ImportField, value: string | null, excerpt: string, basis: SuggestionBasis) => {
        // Angle brackets left after tags are removed (for example from "&lt;b&gt;") are dropped too.
        const tidy = (raw: string) => plainText(raw).replace(/[<>]/g, " ").replace(/\s+/g, " ").trim();
        const cleaned = value ? tidy(value) : "";
        if (!cleaned || cleaned.length > FIELD_MAX[field]) return;
        suggestions.push({ field, value: cleaned, sourceUrl: page.url, excerpt: clip(tidy(excerpt), MAX_EXCERPT), basis });
    };

    for (const company of structuredCompanies(page.html)) {
        const name = text(company.name);
        add("company_name", name, `Structured data on the page: name ${name}`, "structured-data");
        const phone = cleanPhone(text(company.telephone));
        add("phone", phone, `Structured data on the page: telephone ${text(company.telephone)}`, "structured-data");
        const email = cleanEmail(text(company.email));
        add("sales_email", email, `Structured data on the page: email ${text(company.email)}`, "structured-data");
        const address = structuredAddress(company.address);
        add("address", address, `Structured data on the page: address ${address}`, "structured-data");
        const services = joinServices(structuredServices(company));
        add("specialisms", services, `Structured data on the page lists: ${services}`, "structured-data");
    }

    const siteName = /<meta\b[^>]*property\s*=\s*["']og:site_name["'][^>]*>/i.exec(page.html);
    if (siteName) {
        const name = attribute(siteName[0], "content");
        add("company_name", name, `The page names the site ${name}`, "structured-data");
    }

    const body = contentOnly(page.html);

    for (const match of body.matchAll(/<a\b[^>]{0,2000}>([\s\S]{0,300}?)<\/a\s*>/gi)) {
        const href = attribute(match[0].slice(0, match[0].indexOf(">") + 1), "href") ?? "";
        const label = plainText(match[1]);
        if (/^tel:/i.test(href)) add("phone", cleanPhone(href) && (cleanPhone(label) ?? cleanPhone(href)), `Phone link on the page: ${label || href}`, "contact-link");
        if (/^mailto:/i.test(href)) add("sales_email", cleanEmail(href), `Email link on the page: ${label || href}`, "contact-link");
    }

    const addressBlock = /<address\b[^>]*>([\s\S]{0,1500}?)<\/address\s*>/i.exec(body);
    if (addressBlock) {
        const address = plainText(addressBlock[1].replace(/<br\s*\/?>/gi, ", ")).replace(/(,\s*)+/g, ", ").replace(/^, |, $/g, "");
        // An address block is often the whole contact panel. Only a short, postal-looking one is offered.
        if (/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i.test(address) && !/@/.test(address)) {
            add("address", address, `Address block on the page: ${address}`, "page-text");
        }
    }

    const words = plainText(body);
    const companyNumber = /\b(?:company|registered|registration)\s+(?:number|no\.?|num\.?)\s*[:.]?\s*((?:SC|NI|OC|SO|NC)?\d{6,8})\b/i.exec(words);
    if (companyNumber) add("company_number", companyNumber[1].toUpperCase(), around(words, companyNumber.index, companyNumber[0].length), "page-text");
    const vat = /\bVAT\s+(?:reg(?:istration)?\.?\s+)?(?:number|no\.?|num\.?)\s*[:.]?\s*((?:GB)?\s?\d{3}\s?\d{4}\s?\d{2})\b/i.exec(words);
    if (vat) add("vat_number", vat[1].replace(/\s+/g, "").toUpperCase(), around(words, vat.index, vat[0].length), "page-text");

    let path = "";
    try { path = new URL(page.url).pathname; } catch { /* a page URL is always absolute */ }
    if (/services?|what-we-do/i.test(path)) {
        const headings = Array.from(body.matchAll(/<h[23]\b[^>]*>([\s\S]{0,300}?)<\/h[23]\s*>/gi))
            .map((match) => plainText(match[1]))
            .filter((heading) => heading && !HEADING_NOISE.test(heading));
        const services = joinServices(headings);
        add("specialisms", services, `Headings on the services page: ${services}`, "page-heading");
    }

    return suggestions;
}

const FIELD_ORDER: ImportField[] = ["company_name", "website", "company_number", "vat_number", "specialisms", "phone", "sales_email", "address"];
const BASIS_STRENGTH: SuggestionBasis[] = ["confirmed-address", "structured-data", "contact-link", "page-text", "page-heading"];

/**
 * One suggestion per field at most: the one with the strongest evidence,
 * and among equals the one from the earliest page read.
 */
export function extractSuggestions(pages: ImportedPage[], website: string): Suggestion[] {
    const all: Suggestion[] = [];
    if (pages[0] && website.length <= FIELD_MAX.website) {
        all.push({ field: "website", value: website, sourceUrl: pages[0].url, excerpt: "The website address you entered and confirmed.", basis: "confirmed-address" });
    }
    for (const page of pages) all.push(...fromPage(page));

    const best = new Map<ImportField, Suggestion>();
    for (const suggestion of all) {
        const current = best.get(suggestion.field);
        if (!current || BASIS_STRENGTH.indexOf(suggestion.basis) < BASIS_STRENGTH.indexOf(current.basis)) best.set(suggestion.field, suggestion);
    }
    return FIELD_ORDER.flatMap((field) => (best.has(field) ? [best.get(field) as Suggestion] : []));
}
