/**
 * Case-study library: which case studies a proposal's saved ticks mean. Pure.
 * NOT USED BY THE APPLICATION YET. See `content.ts`.
 *
 * One function, meant for BOTH the review preview and publication when the
 * library is switched on, so what a contractor is shown is what is sent.
 *
 * Two kinds of saved tick:
 *
 *   an older tick     any value the product saves today: an entry's `id`, or
 *                     its place in the list as text. These keep meaning
 *                     exactly what they mean today. This function hands them
 *                     to the product's own `selectCaseStudies`, unchanged.
 *   a library tick    `lib:<uuid>`. Only this form ever refers to a library
 *                     row. A bare uuid is an older tick, always: a library
 *                     row can never take over a value that used to mean an
 *                     older entry.
 *
 * With no library ticks the result is exactly today's result, whatever
 * library rows exist.
 *
 * A library tick that cannot be honoured is never dropped quietly. The
 * result says it cannot be sent, and why, and carries no case studies, so a
 * caller cannot publish a proposal that silently lost one.
 */

import { selectCaseStudies, type ProposalCaseStudy } from "@/lib/proposal-publication";
import { approvedProblem, type ApprovedCaseStudy } from "./content";

export const LIBRARY_TICK_PREFIX = "lib:";
export const MAX_CASE_STUDIES_PER_PROPOSAL = 6;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const libraryTick = (id: string) => `${LIBRARY_TICK_PREFIX}${id}`;

/** A row of `public.case_studies`, as read for the contractor it belongs to. */
export interface LibraryRow {
    id: string;
    user_id: string;
    approved: unknown;
    approved_revision: number | null;
    archived_at: string | null;
}

export type UnsendableReason =
    | "library-row-not-yours"      // a row for another contractor was passed in: a caller bug, refused outright
    | "library-tick-malformed"     // starts with the prefix but is not a library id
    | "library-missing"            // no such case study (deleted, or never this contractor's)
    | "library-archived"
    | "library-not-approved"       // a draft that was never approved
    | "library-approved-invalid"   // the stored approved copy is not well formed
    | "ambiguous-with-older-entry" // an older entry's own id is this same value: the contractor must choose
    | "too-many";

export interface ResolvedSource {
    kind: "older" | "library";
    /** For a library study: its id, the revision that was approved, and its tag labels as approved. */
    id?: string;
    approvedRevision?: number;
    disciplines?: string[];
}

export type Resolution =
    | { sendable: true; studies: ProposalCaseStudy[]; sources: ResolvedSource[]; unmatchedOlderTicks: string[] }
    | { sendable: false; studies: []; problems: Array<{ tick: string; reason: UnsendableReason }> };

const orNull = (value: string) => (value.trim() === "" ? null : value.trim());

/** An approved library study in the shape a proposal snapshot holds. Nothing hidden can appear: the approved copy already blanked it. */
function toProposalCaseStudy(approved: ApprovedCaseStudy): ProposalCaseStudy {
    return {
        title: approved.title,
        project_type: orNull(approved.work_type),
        location: orNull(approved.place),
        client: approved.client_display === "hidden" ? null : orNull(approved.client_text),
        contract_value: approved.show_value ? orNull(approved.value_text) : null,
        duration: orNull(approved.duration_text),
        delivered: orNull(approved.delivered),
        value_added: orNull(approved.value_added),
        // Pictures are not part of the library yet.
        photos: [],
    };
}

export function resolveSelectedCaseStudies(input: {
    /** The contractor the proposal belongs to. */
    userId: string;
    /** `profiles.case_studies` as stored. */
    olderStored: unknown[] | null | undefined;
    /** Library rows read for this contractor. Rows for anyone else are refused. */
    libraryRows: readonly LibraryRow[];
    /** `projects.selected_case_study_ids` as stored. */
    selected: unknown[] | null | undefined;
}): Resolution {
    const selected = Array.isArray(input.selected) ? input.selected.map((value) => String(value)) : [];
    const problems: Array<{ tick: string; reason: UnsendableReason }> = [];

    const foreign = input.libraryRows.find((row) => row.user_id !== input.userId);
    if (foreign) return { sendable: false, studies: [], problems: [{ tick: libraryTick(foreign.id), reason: "library-row-not-yours" }] };

    const rows = new Map(input.libraryRows.map((row) => [row.id, row]));
    const olderEntries = Array.isArray(input.olderStored) ? input.olderStored : [];
    const olderIds = new Set(olderEntries.map((entry) => (entry && typeof entry === "object" && !Array.isArray(entry) ? (entry as Record<string, unknown>).id : undefined)).filter((id): id is string => typeof id === "string" && id !== ""));

    // A tick is a library tick only if it has the prefix. If an older entry's
    // own id is that very value, it stays an older tick, as today, unless a
    // library row also answers to it: then it is ambiguous and nobody guesses.
    const prefixed = Array.from(new Set(selected.filter((tick) => tick.startsWith(LIBRARY_TICK_PREFIX))));
    const ambiguous = prefixed.filter((tick) => olderIds.has(tick) && rows.has(tick.slice(LIBRARY_TICK_PREFIX.length)));
    const libraryTicks = prefixed.filter((tick) => !olderIds.has(tick));
    const olderTicks = selected.filter((tick) => !libraryTicks.includes(tick) && !ambiguous.includes(tick));
    for (const tick of ambiguous) problems.push({ tick, reason: "ambiguous-with-older-entry" });

    // Exactly today's rule for older ticks, by calling today's function.
    const older = selectCaseStudies(input.olderStored, olderTicks);
    const matchedOlder = (tick: string) => olderIds.has(tick) || (/^\d+$/.test(tick) && Number(tick) < olderEntries.length && String(Number(tick)) === tick);
    const unmatchedOlderTicks = Array.from(new Set(olderTicks.filter((tick) => !matchedOlder(tick))));

    if (libraryTicks.length === 0 && problems.length === 0) {
        return { sendable: true, studies: older, sources: older.map(() => ({ kind: "older" as const })), unmatchedOlderTicks };
    }

    const library: Array<{ study: ProposalCaseStudy; source: ResolvedSource }> = [];
    for (const tick of libraryTicks) {
        const id = tick.slice(LIBRARY_TICK_PREFIX.length);
        if (!UUID.test(id)) { problems.push({ tick, reason: "library-tick-malformed" }); continue; }
        const row = rows.get(id);
        if (!row) { problems.push({ tick, reason: "library-missing" }); continue; }
        if (row.archived_at !== null) { problems.push({ tick, reason: "library-archived" }); continue; }
        if (row.approved === null || row.approved === undefined || row.approved_revision === null) { problems.push({ tick, reason: "library-not-approved" }); continue; }
        if (approvedProblem(row.approved) !== null) { problems.push({ tick, reason: "library-approved-invalid" }); continue; }
        const approved = row.approved as ApprovedCaseStudy;
        library.push({ study: toProposalCaseStudy(approved), source: { kind: "library", id, approvedRevision: row.approved_revision, disciplines: [...approved.disciplines] } });
    }

    // Today an over-long older list is cut to six without a word. Once the library is involved, it is said.
    if (problems.length === 0 && older.length + library.length > MAX_CASE_STUDIES_PER_PROPOSAL) {
        problems.push({ tick: libraryTicks[libraryTicks.length - 1] ?? "", reason: "too-many" });
    }
    if (problems.length > 0) return { sendable: false, studies: [], problems };

    return {
        sendable: true,
        studies: [...older, ...library.map((entry) => entry.study)],
        sources: [...older.map(() => ({ kind: "older" as const })), ...library.map((entry) => entry.source)],
        unmatchedOlderTicks,
    };
}
