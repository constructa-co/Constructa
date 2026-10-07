/**
 * The reviewable draft a website import produces, and the rules for turning
 * an approved item into a profile change. Pure; shared by the server actions
 * and the screen.
 *
 * A draft is never the profile. Proposals are built from `profiles` alone, so
 * a suggestion that has not been approved cannot appear in one.
 */

import { z } from "zod";
import { FIELD_MAX, type ImportField, type Suggestion, type SuggestionBasis } from "./extract";
import type { ImportFailureCode } from "./net-policy";

export const IMPORT_PATH = "/dashboard/settings/profile/import";

/** Previews a contractor may start in any one hour. */
export const IMPORT_PREVIEWS_PER_HOUR = 6;

export type ImportGroup = "identity" | "services" | "contact";

export interface ImportFieldSpec {
    field: ImportField;
    label: string;
    group: ImportGroup;
    /** True when the value is part of what a client sees on a proposal. */
    onProposals: boolean;
}

/** The profile columns an import may suggest. Nothing else can be written by it. */
export const IMPORT_FIELDS: readonly ImportFieldSpec[] = [
    { field: "company_name", label: "Business name", group: "identity", onProposals: true },
    { field: "website", label: "Website", group: "identity", onProposals: true },
    { field: "company_number", label: "Company number", group: "identity", onProposals: false },
    { field: "vat_number", label: "VAT number", group: "identity", onProposals: false },
    { field: "specialisms", label: "Services", group: "services", onProposals: true },
    { field: "phone", label: "Phone", group: "contact", onProposals: true },
    { field: "sales_email", label: "Sales email", group: "contact", onProposals: false },
    { field: "address", label: "Address", group: "contact", onProposals: false },
];

export const IMPORT_GROUP_LABELS: Record<ImportGroup, string> = {
    identity: "Company identity",
    services: "Services",
    contact: "Contact details",
};

export const IMPORT_PROFILE_COLUMNS = IMPORT_FIELDS.map((spec) => spec.field).join(", ");

const FIELD_NAMES = IMPORT_FIELDS.map((spec) => spec.field) as [ImportField, ...ImportField[]];

export type ImportProfile = Partial<Record<ImportField, string | null>>;

/**
 * - `pending`: suggested, waiting for the contractor.
 * - `same`: the profile already says this; nothing to approve.
 * - `applied`: the contractor approved it and the profile was changed.
 */
export type ImportItemStatus = "pending" | "same" | "applied";

export interface ImportItem {
    field: ImportField;
    proposed: string;
    /** The saved profile value the contractor is shown beside the suggestion. */
    existing: string | null;
    sourceUrl: string;
    excerpt: string;
    basis: SuggestionBasis;
    status: ImportItemStatus;
    appliedAt: string | null;
}

export interface ImportDraft {
    id: string;
    sourceUrl: string;
    website: string;
    permissionConfirmedAt: string;
    fetchedAt: string;
    pages: string[];
    items: ImportItem[];
}

const comparable = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

export const sameValue = (a: string | null | undefined, b: string | null | undefined) => comparable(a) === comparable(b);

/** Suggestions set beside what is saved now. Nothing is written by this. */
export function buildImportItems(suggestions: Suggestion[], profile: ImportProfile | null | undefined): ImportItem[] {
    return suggestions
        .filter((suggestion) => FIELD_NAMES.includes(suggestion.field) && suggestion.value.length <= FIELD_MAX[suggestion.field])
        .map((suggestion) => {
            const existing = profile?.[suggestion.field] ?? null;
            return {
                field: suggestion.field,
                proposed: suggestion.value,
                existing,
                sourceUrl: suggestion.sourceUrl,
                excerpt: suggestion.excerpt,
                basis: suggestion.basis,
                status: sameValue(existing, suggestion.value) ? "same" as const : "pending" as const,
                appliedAt: null,
            };
        });
}

// ── Action inputs ────────────────────────────────────────────────────────────

export const PreviewImportInput = z.object({
    url: z.string().trim().min(1).max(2000),
    permissionConfirmed: z.literal(true),
});

export const ApplyImportInput = z.object({
    draftId: z.string().uuid(),
    /**
     * Each approved field with the saved value the contractor was looking at
     * when they approved it. The value to write is never sent: it is read
     * from the draft on the server.
     */
    approvals: z.array(z.object({
        field: z.enum(FIELD_NAMES),
        expectedExisting: z.string().max(20_000).nullable(),
    })).min(1).max(IMPORT_FIELDS.length),
});

export type ApplyImportInput = z.infer<typeof ApplyImportInput>;

export type ApplyOutcome =
    | { field: ImportField; outcome: "applied" }
    /** The profile no longer holds what the contractor was shown. Nothing was written. */
    | { field: ImportField; outcome: "conflict"; current: string | null }
    | { field: ImportField; outcome: "unavailable" };

// ── Messages ─────────────────────────────────────────────────────────────────

export const IMPORT_PERMISSION_ERROR = "Tick the box to confirm this is your own website and you are happy for us to read it.";
export const IMPORT_GENERIC_ERROR = "We couldn't read that website just now. You can try again, or enter your details by hand.";
export const IMPORT_SAVE_ERROR = "We couldn't save that. Nothing was changed. Check your connection and try again.";
export const IMPORT_RATE_ERROR = "You've checked a website several times in the last hour. Please try again later, or enter your details by hand.";

/** What the contractor is told. Never the technical detail, which could describe our network. */
export function importFailureMessage(code: ImportFailureCode): string {
    switch (code) {
        case "invalid-url":
            return "That doesn't look like a website address. Check it and try again, for example www.yourbusiness.co.uk.";
        case "unsafe-address":
            return "We can only read a public website by its name, for example www.yourbusiness.co.uk.";
        case "outside-website":
        case "too-many-redirects":
            return "That address sends visitors to a different website, so we stopped. Enter the address your site ends up on, or enter your details by hand.";
        case "robots-disallowed":
        case "robots-unavailable":
            return "Your website asks automated readers to stay away, so we haven't read it. You can enter your details by hand.";
        case "too-large":
        case "not-html":
            return "We couldn't read that page. Try your home page address, or enter your details by hand.";
        case "timeout":
            return "Your website took too long to answer. You can try again, or enter your details by hand.";
        default:
            return IMPORT_GENERIC_ERROR;
    }
}
