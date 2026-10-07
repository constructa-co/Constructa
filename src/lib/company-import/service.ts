/**
 * Preview and approval for the company-website import.
 *
 * Two database clients are used, for two different jobs:
 *
 *   - `supabase` is the signed-in contractor's own client. It only reads:
 *     their profile and their drafts, under row level security.
 *   - `admin` is the server's service-role client. It is the only thing that
 *     can write a draft, the fetch budget or an approval, through functions
 *     the browser roles cannot execute. It is always given the id of the
 *     contractor the application has just authenticated, and each function
 *     touches only that contractor's rows.
 *
 * That split is what makes a draft evidence: a contractor can edit their
 * own profile by hand whenever they like, but "the website said this" and
 * "this was approved from the website" can only be written here.
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractSuggestions, type ImportField } from "./extract";
import {
    ApplyImportInput,
    IMPORT_DRAFT_GONE_ERROR,
    IMPORT_EXPIRED_ERROR,
    IMPORT_FIELDS,
    IMPORT_GENERIC_ERROR,
    IMPORT_IN_FLIGHT_ERROR,
    IMPORT_PERMISSION_ERROR,
    IMPORT_PROFILE_COLUMNS,
    IMPORT_RATE_ERROR,
    IMPORT_REFRESH_ERROR,
    IMPORT_SAVE_ERROR,
    PreviewImportInput,
    buildImportItems,
    importFailureMessage,
    sameValue,
    type ApplyOutcome,
    type ImportDraft,
    type ImportItem,
    type ImportProfile,
} from "./draft";
import { ImportFetchError, parseImportUrl } from "./net-policy";
import { crawlWebsite, nodeNetwork, type ImportNetwork } from "./safe-fetch";

type Reader = Pick<SupabaseClient, "from">;
type Writer = Pick<SupabaseClient, "rpc">;

export interface ImportContext {
    /** The contractor's own client. Read only here. */
    supabase: Reader;
    /** The server's service-role client. The only writer. */
    admin: Writer;
    /** The contractor the application authenticated for this request. */
    userId: string;
    network?: ImportNetwork;
}

export type PreviewResult = { ok: true; draft: ImportDraft } | { ok: false; error: string };
export type ApplyResult =
    | { ok: true; draft: ImportDraft; outcomes: ApplyOutcome[] }
    | { ok: false; error: string; draft?: ImportDraft; outcomes?: ApplyOutcome[] };

const FIELD_NAMES = IMPORT_FIELDS.map((spec) => spec.field) as [ImportField, ...ImportField[]];

const ItemSchema = z.object({
    field: z.enum(FIELD_NAMES),
    proposed: z.string().max(1000),
    existing: z.string().max(20_000).nullable(),
    sourceUrl: z.string().max(2000),
    excerpt: z.string().max(400),
    basis: z.enum(["structured-data", "contact-link", "page-text", "page-heading", "confirmed-address"]),
    status: z.enum(["pending", "same", "applied"]),
    appliedAt: z.string().nullable(),
});

interface DraftRow {
    id: string;
    source_url: string;
    website: string;
    permission_confirmed_at: string;
    fetched_at: string;
    expires_at: string;
    pages: unknown;
    items: unknown;
}

const DRAFT_COLUMNS = "id, source_url, website, permission_confirmed_at, fetched_at, expires_at, pages, items";

/** A saved row as a draft. A draft past its expiry, or with no readable expiry, is expired. */
export function toDraft(row: DraftRow, now: number): ImportDraft {
    const items = Array.isArray(row.items)
        ? row.items.flatMap((entry) => {
            const parsed = ItemSchema.safeParse(entry);
            return parsed.success ? [parsed.data as ImportItem] : [];
        })
        : [];
    const expires = Date.parse(row.expires_at);
    return {
        id: row.id,
        sourceUrl: row.source_url,
        website: row.website,
        permissionConfirmedAt: row.permission_confirmed_at,
        fetchedAt: row.fetched_at,
        expiresAt: row.expires_at,
        expired: !(expires > now),
        pages: Array.isArray(row.pages) ? row.pages.filter((page): page is string => typeof page === "string") : [],
        items,
    };
}

/** Brings the "saved now" side of each undecided item up to date. Nothing is written. */
export function refreshAgainstProfile(draft: ImportDraft, profile: ImportProfile | null | undefined): ImportDraft {
    return {
        ...draft,
        items: draft.items.map((item) => {
            if (item.status === "applied") return item;
            const existing = profile?.[item.field] ?? null;
            return { ...item, existing, status: sameValue(existing, item.proposed) ? "same" : "pending" };
        }),
    };
}

async function readProfile(supabase: Reader, userId: string): Promise<ImportProfile | null> {
    const { data, error } = await supabase.from("profiles").select(IMPORT_PROFILE_COLUMNS).eq("id", userId).single();
    if (error || !data) return null;
    return data as unknown as ImportProfile;
}

async function readDraft(supabase: Reader, userId: string, draftId: string, now: number): Promise<ImportDraft | null | "error"> {
    const { data, error } = await supabase
        .from("company_import_drafts")
        .select(DRAFT_COLUMNS)
        .eq("id", draftId)
        .eq("user_id", userId)
        .maybeSingle();
    if (error) return "error";
    return data ? toDraft(data as DraftRow, now) : null;
}

export async function previewImport(context: ImportContext, rawInput: unknown): Promise<PreviewResult> {
    const { supabase, admin, userId, network = nodeNetwork } = context;
    const raw = (rawInput && typeof rawInput === "object" ? rawInput : {}) as Record<string, unknown>;

    // Permission first: without it nothing is looked up, let alone fetched.
    if (raw.permissionConfirmed !== true) return { ok: false, error: IMPORT_PERMISSION_ERROR };
    const input = PreviewImportInput.safeParse(raw);
    if (!input.success) return { ok: false, error: importFailureMessage("invalid-url") };
    const permissionConfirmedAt = new Date(network.now()).toISOString();

    try {
        parseImportUrl(input.data.url);
    } catch (error) {
        return { ok: false, error: importFailureMessage(error instanceof ImportFetchError ? error.code : "invalid-url") };
    }

    // The budget is claimed in the database before anything is fetched. The
    // claim is atomic per contractor, counts this read whatever becomes of
    // it, and fails closed: no claim, no fetch.
    const { data: claim, error: claimError } = await admin.rpc("company_import_reserve_attempt", { p_user_id: userId });
    const status = (claim as { status?: string } | null)?.status;
    const attemptId = (claim as { attempt_id?: string } | null)?.attempt_id;
    if (claimError || !status) {
        console.error("company import reservation failed", { code: claimError?.code });
        return { ok: false, error: IMPORT_GENERIC_ERROR };
    }
    if (status === "in-flight") return { ok: false, error: IMPORT_IN_FLIGHT_ERROR };
    if (status === "rate-limited") return { ok: false, error: IMPORT_RATE_ERROR };
    if (status !== "reserved" || !attemptId) return { ok: false, error: IMPORT_GENERIC_ERROR };

    const release = async (outcome: string) => {
        const { error } = await admin.rpc("company_import_finish_attempt", { p_user_id: userId, p_attempt_id: attemptId, p_outcome: outcome });
        // If this fails the read stays counted and stops blocking by itself after two minutes.
        if (error) console.error("company import attempt not closed", { code: error.code });
    };

    try {
        let crawl;
        try {
            crawl = await crawlWebsite(input.data.url, network);
        } catch (error) {
            const code = error instanceof ImportFetchError ? error.code : "unavailable";
            // The code only. Page content and addresses are not logged.
            console.error("company import fetch refused", { code });
            await release(`failed:${code}`);
            return { ok: false, error: importFailureMessage(code) };
        }

        const profile = await readProfile(supabase, userId);
        if (!profile) {
            await release("failed:profile-read");
            return { ok: false, error: IMPORT_GENERIC_ERROR };
        }
        const items = buildImportItems(extractSuggestions(crawl.pages, crawl.website), profile);

        const { data: saved, error: saveError } = await admin.rpc("company_import_save_draft", {
            p_user_id: userId,
            p_attempt_id: attemptId,
            p_source_url: crawl.pages[0].url,
            p_website: crawl.website,
            p_permission_confirmed_at: permissionConfirmedAt,
            p_fetched_at: crawl.pages[0].fetchedAt,
            p_pages: crawl.pages.map((page) => page.url),
            p_items: items,
        });
        if (saveError || !saved) {
            console.error("company import draft save failed", { code: saveError?.code });
            await release("failed:draft-save");
            return { ok: false, error: IMPORT_GENERIC_ERROR };
        }
        return { ok: true, draft: toDraft(saved as DraftRow, network.now()) };
    } catch (error) {
        await release("failed:unexpected");
        throw error;
    }
}

/** The contractor's most recent draft, compared with their profile as it is now. */
export async function latestImportDraft(context: Pick<ImportContext, "supabase" | "userId" | "network">): Promise<ImportDraft | null> {
    const { supabase, userId, network = nodeNetwork } = context;
    const { data, error } = await supabase
        .from("company_import_drafts")
        .select(DRAFT_COLUMNS)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error || !data) return null;
    return refreshAgainstProfile(toDraft(data as DraftRow, network.now()), await readProfile(supabase, userId));
}

/**
 * Approves the ticked items one at a time. Each approval is one database
 * transaction that changes the profile column and records the approval
 * together, or does neither. The first failure stops the run and is
 * reported as a failure; items already approved stay approved and are shown
 * as such.
 */
export async function applyImport(context: ImportContext, rawInput: unknown): Promise<ApplyResult> {
    const { supabase, admin, userId, network = nodeNetwork } = context;
    const input = ApplyImportInput.safeParse(rawInput);
    if (!input.success) return { ok: false, error: IMPORT_SAVE_ERROR };

    const outcomes: ApplyOutcome[] = [];
    let failure: string | null = null;

    for (const approval of input.data.approvals) {
        const { data, error } = await admin.rpc("company_import_approve_item", {
            p_user_id: userId,
            p_draft_id: input.data.draftId,
            p_field: approval.field,
            p_expected_existing: approval.expectedExisting,
        });
        const result = data as { outcome?: string; current?: string | null } | null;
        if (error || !result?.outcome) {
            console.error("company import approval failed", { field: approval.field, code: error?.code });
            failure = IMPORT_SAVE_ERROR;
            break;
        }
        if (result.outcome === "not-found") return { ok: false, error: IMPORT_DRAFT_GONE_ERROR, outcomes };
        if (result.outcome === "expired") {
            failure = IMPORT_EXPIRED_ERROR;
            break;
        }
        if (result.outcome === "applied") outcomes.push({ field: approval.field, outcome: "applied" });
        else if (result.outcome === "conflict") outcomes.push({ field: approval.field, outcome: "conflict", current: result.current ?? null });
        else outcomes.push({ field: approval.field, outcome: "unavailable" });
    }

    // What is shown afterwards is what the database now holds, not what this request believes.
    const draft = await readDraft(supabase, userId, input.data.draftId, network.now());
    if (draft === null) return { ok: false, error: IMPORT_DRAFT_GONE_ERROR, outcomes };
    if (draft === "error") {
        const anySaved = outcomes.some((entry) => entry.outcome === "applied");
        return { ok: false, error: failure ?? (anySaved ? IMPORT_REFRESH_ERROR : IMPORT_SAVE_ERROR), outcomes };
    }
    if (failure) return { ok: false, error: failure, draft, outcomes };
    return { ok: true, draft, outcomes };
}
