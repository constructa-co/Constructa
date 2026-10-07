/**
 * Preview and approval for the company-website import.
 *
 * Preview reads the website and saves a draft; it never writes to the
 * profile. Approval writes one profile column per approved item, takes the
 * value from the saved draft rather than from the browser, and writes only
 * if the profile still holds the value the contractor was shown.
 *
 * The database client and the network are passed in. Every query names the
 * signed-in contractor as well as relying on row level security.
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractSuggestions, type ImportField } from "./extract";
import {
    ApplyImportInput,
    IMPORT_FIELDS,
    IMPORT_GENERIC_ERROR,
    IMPORT_PERMISSION_ERROR,
    IMPORT_PREVIEWS_PER_HOUR,
    IMPORT_PROFILE_COLUMNS,
    IMPORT_RATE_ERROR,
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

type Db = Pick<SupabaseClient, "from">;

export interface ImportContext {
    supabase: Db;
    userId: string;
    network?: ImportNetwork;
}

export type PreviewResult = { ok: true; draft: ImportDraft } | { ok: false; error: string };
export type ApplyResult =
    | { ok: true; draft: ImportDraft; outcomes: ApplyOutcome[] }
    | { ok: false; error: string; draft?: ImportDraft; outcomes?: ApplyOutcome[] };

export const IMPORT_DRAFT_GONE_ERROR = "That preview is no longer available. Check your website again to see fresh suggestions.";

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
    pages: unknown;
    items: unknown;
}

const DRAFT_COLUMNS = "id, source_url, website, permission_confirmed_at, fetched_at, pages, items";

/** A saved row as a draft. Anything in it that is not a well-formed item is dropped, not trusted. */
export function toDraft(row: DraftRow): ImportDraft {
    const items = Array.isArray(row.items)
        ? row.items.flatMap((entry) => {
            const parsed = ItemSchema.safeParse(entry);
            return parsed.success ? [parsed.data as ImportItem] : [];
        })
        : [];
    return {
        id: row.id,
        sourceUrl: row.source_url,
        website: row.website,
        permissionConfirmedAt: row.permission_confirmed_at,
        fetchedAt: row.fetched_at,
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

async function readProfile(supabase: Db, userId: string): Promise<ImportProfile | null> {
    const { data, error } = await supabase.from("profiles").select(IMPORT_PROFILE_COLUMNS).eq("id", userId).single();
    if (error || !data) return null;
    return data as unknown as ImportProfile;
}

export async function previewImport(context: ImportContext, rawInput: unknown): Promise<PreviewResult> {
    const { supabase, userId, network = nodeNetwork } = context;
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

    const { count, error: countError } = await supabase
        .from("company_import_drafts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", new Date(network.now() - 60 * 60 * 1000).toISOString());
    // If the recent-use count cannot be read, the website is not fetched.
    if (countError || count === null) return { ok: false, error: IMPORT_GENERIC_ERROR };
    if (count >= IMPORT_PREVIEWS_PER_HOUR) return { ok: false, error: IMPORT_RATE_ERROR };

    let crawl;
    try {
        crawl = await crawlWebsite(input.data.url, network);
    } catch (error) {
        const code = error instanceof ImportFetchError ? error.code : "unavailable";
        // The code only. Page content and addresses are not logged.
        console.error("company import fetch refused", { code });
        return { ok: false, error: importFailureMessage(code) };
    }

    const profile = await readProfile(supabase, userId);
    if (!profile) return { ok: false, error: IMPORT_GENERIC_ERROR };
    const items = buildImportItems(extractSuggestions(crawl.pages, crawl.website), profile);

    const { data: saved, error: saveError } = await supabase
        .from("company_import_drafts")
        .insert({
            user_id: userId,
            source_url: crawl.pages[0].url,
            website: crawl.website,
            permission_confirmed_at: permissionConfirmedAt,
            fetched_at: crawl.pages[0].fetchedAt,
            pages: crawl.pages.map((page) => page.url),
            items,
        })
        .select(DRAFT_COLUMNS)
        .single();
    if (saveError || !saved) {
        console.error("company import draft save failed", { code: saveError?.code });
        return { ok: false, error: IMPORT_GENERIC_ERROR };
    }
    return { ok: true, draft: toDraft(saved as DraftRow) };
}

/** The contractor's most recent draft, compared with their profile as it is now. */
export async function latestImportDraft(context: ImportContext): Promise<ImportDraft | null> {
    const { supabase, userId } = context;
    const { data, error } = await supabase
        .from("company_import_drafts")
        .select(DRAFT_COLUMNS)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error || !data) return null;
    return refreshAgainstProfile(toDraft(data as DraftRow), await readProfile(supabase, userId));
}

export async function applyImport(context: ImportContext, rawInput: unknown): Promise<ApplyResult> {
    const { supabase, userId, network = nodeNetwork } = context;
    const input = ApplyImportInput.safeParse(rawInput);
    if (!input.success) return { ok: false, error: IMPORT_SAVE_ERROR };

    const { data: row, error: loadError } = await supabase
        .from("company_import_drafts")
        .select(DRAFT_COLUMNS)
        .eq("id", input.data.draftId)
        .eq("user_id", userId)
        .maybeSingle();
    if (loadError) return { ok: false, error: IMPORT_SAVE_ERROR };
    if (!row) return { ok: false, error: IMPORT_DRAFT_GONE_ERROR };

    const draft = toDraft(row as DraftRow);
    const outcomes: ApplyOutcome[] = [];
    const approvedOnce = new Set<ImportField>();
    let failed = false;

    for (const approval of input.data.approvals) {
        const item = draft.items.find((entry) => entry.field === approval.field);
        if (!item || item.status === "applied" || approvedOnce.has(approval.field)) {
            outcomes.push({ field: approval.field, outcome: "unavailable" });
            continue;
        }
        approvedOnce.add(approval.field);

        // Write only if the profile still holds what the contractor was shown.
        const guarded = supabase.from("profiles").update({ [item.field]: item.proposed }).eq("id", userId);
        const { data: written, error: writeError } = await (approval.expectedExisting === null
            ? guarded.is(item.field, null)
            : guarded.eq(item.field, approval.expectedExisting)
        ).select("id");
        if (writeError) {
            console.error("company import apply failed", { field: item.field, code: writeError.code });
            failed = true;
            break;
        }

        if ((written?.length ?? 0) > 0) {
            item.status = "applied";
            item.existing = item.proposed;
            item.appliedAt = new Date(network.now()).toISOString();
            outcomes.push({ field: item.field, outcome: "applied" });
            continue;
        }

        // Nothing was written. Show what the profile says now and let the contractor decide again.
        const current = await readProfile(supabase, userId);
        if (!current) {
            failed = true;
            break;
        }
        item.existing = current[item.field] ?? null;
        item.status = sameValue(item.existing, item.proposed) ? "same" : "pending";
        outcomes.push({ field: item.field, outcome: "conflict", current: item.existing });
    }

    const { error: recordError } = await supabase
        .from("company_import_drafts")
        .update({ items: draft.items })
        .eq("id", draft.id)
        .eq("user_id", userId);
    if (recordError) console.error("company import draft update failed", { code: recordError.code });

    if (failed) return { ok: false, error: IMPORT_SAVE_ERROR, draft, outcomes };
    return { ok: true, draft, outcomes };
}
