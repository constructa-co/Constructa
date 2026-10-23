/**
 * Proposal readiness for the company as a whole: what a contractor's
 * proposals can already draw on, and what they could still add.
 *
 * Every status is read from the saved profile. Nothing is inferred, drafted
 * or assumed, and nothing here stops a contractor creating a project.
 * (Whether one particular proposal can be sent is `proposal-readiness.ts`.)
 */

import { CASE_STUDIES_PATH, PROFILE_PATH } from "@/lib/first-session";

export interface CompanyReadinessProfile {
    company_name?: string | null;
    business_type?: string | null;
    /** Saved profile fields that are not currently published must not satisfy proposal readiness. */
    address?: string | null;
    phone?: string | null;
    sales_phone?: string | null;
    sales_email?: string | null;
    logo_url?: string | null;
    capability_statement?: string | null;
    case_studies?: unknown;
}

export type CompanyReadinessKey = "basics" | "brand" | "story" | "case-studies" | "terms";

/** "included" is for something every proposal already has without any setup. */
export type CompanyReadinessStatus = "ready" | "started" | "todo" | "included";

export interface CompanyReadinessItem {
    key: CompanyReadinessKey;
    title: string;
    status: CompanyReadinessStatus;
    statusLabel: string;
    detail: string;
    /** Where the contractor adds or changes it. Absent when there is nothing to set up. */
    action?: { label: string; href: string };
}

export interface CompanyReadiness {
    companyName: string;
    workType: string;
    items: CompanyReadinessItem[];
    readyCount: number;
    total: number;
}

const STATUS_LABELS: Record<CompanyReadinessStatus, string> = {
    ready: "Ready",
    started: "Started",
    todo: "Not added yet",
    included: "Included",
};

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Case studies the proposal builder can actually offer for selection. */
export function countCaseStudies(value: unknown): number {
    if (!Array.isArray(value)) return 0;
    return value.filter((entry) => {
        if (!entry || typeof entry !== "object") return false;
        const study = entry as Record<string, unknown>;
        return !!text(study.projectName);
    }).length;
}

function item(
    key: CompanyReadinessKey,
    title: string,
    status: CompanyReadinessStatus,
    detail: string,
    action?: CompanyReadinessItem["action"],
): CompanyReadinessItem {
    return { key, title, status, statusLabel: STATUS_LABELS[status], detail, ...(action ? { action } : {}) };
}

/**
 * `library` is given only when the case-study library is switched on and
 * could be read: how many of its case studies are approved, and how many are
 * not. Only approved ones count. A draft is never "ready".
 */
export function buildCompanyReadiness(profile: CompanyReadinessProfile | null | undefined, library?: { approved: number; unapproved: number } | null): CompanyReadiness {
    const companyName = text(profile?.company_name);
    const workType = text(profile?.business_type);

    const missingBasics = [
        companyName ? null : "your business name",
        text(profile?.phone) ? null : "a phone number",
    ].filter((entry): entry is string => entry !== null);
    const basics = missingBasics.length === 0
        ? item("basics", "Company basics", "ready", "Your client-facing business name and phone number are saved.", { label: "Edit", href: PROFILE_PATH })
        : item(
            "basics",
            "Company basics",
            companyName ? "started" : "todo",
            `${companyName ? "Your business name is saved. " : ""}Add ${missingBasics.join(" and ")} so clients know who you are and how to reach you.`,
            { label: "Add details", href: PROFILE_PATH },
        );

    const brand = text(profile?.logo_url)
        ? item("brand", "Logo and brand", "ready", "Your logo is saved.", { label: "Edit", href: PROFILE_PATH })
        : item("brand", "Logo and brand", "todo", "No logo yet. Add one so your proposals carry your brand.", { label: "Add logo", href: PROFILE_PATH });

    const story = text(profile?.capability_statement)
        ? item("story", "Company story", "ready", "Your company introduction is saved.", { label: "Edit", href: PROFILE_PATH })
        : item("story", "Company story", "todo", "Nothing written yet. Add a short introduction to your business in your own words.", { label: "Add story", href: PROFILE_PATH });

    const studies = countCaseStudies(profile?.case_studies) + Math.max(0, library?.approved ?? 0);
    const drafts = Math.max(0, library?.unapproved ?? 0);
    const draftsNote = drafts > 0 ? ` ${drafts} more ${drafts === 1 ? "is" : "are"} not approved yet, so ${drafts === 1 ? "it" : "they"} can't be used.` : "";
    const caseStudies = studies > 0
        ? item("case-studies", "Case studies", "ready", `${studies} case ${studies === 1 ? "study" : "studies"} ${library ? "ready to use" : "saved"}.${draftsNote}`, { label: "Edit", href: CASE_STUDIES_PATH })
        : drafts > 0
            ? item("case-studies", "Case studies", "started", `${drafts} case ${drafts === 1 ? "study is" : "studies are"} not approved yet. Approve ${drafts === 1 ? "it" : "one"} so proposals can use it.`, { label: "Approve", href: CASE_STUDIES_PATH })
            : item("case-studies", "Case studies", "todo", "None yet. Add past jobs you are happy to show clients.", { label: "Add case study", href: CASE_STUDIES_PATH });

    const terms = item(
        "terms",
        "Terms",
        "included",
        "Standard terms are included with every proposal. You can check them before each one is sent.",
    );

    const items = [basics, brand, story, caseStudies, terms];
    return {
        companyName,
        workType,
        items,
        readyCount: items.filter((entry) => entry.status === "ready" || entry.status === "included").length,
        total: items.length,
    };
}
