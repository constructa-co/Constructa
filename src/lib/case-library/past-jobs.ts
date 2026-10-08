/**
 * Case-study library: what the review screen's "past jobs" block needs to
 * say. Pure. It uses the same resolver publication uses, so what it reports
 * as sendable, blocked or cut is what would really happen.
 *
 * A tick is not a case study. One tick can match more than one older entry,
 * and older entries beyond the sixth are dropped by the product today. So
 * nothing here counts ticks: it counts what the resolver and the older-entry
 * rule actually return.
 */

import { approvedProblem, type ApprovedCaseStudy } from "./content";
import { legacyCaseStudies } from "./legacy";
import { unsendableMessage } from "./messages";
import { LIBRARY_TICK_PREFIX, MAX_CASE_STUDIES_PER_PROPOSAL, libraryTick, resolveSelectedCaseStudies, type LibraryRow, type Resolution } from "./resolve";

export interface ProposalLibrary {
    /** The contractor these rows were read for. */
    userId: string;
    /** Approved copies, plus status-only rows for ticked case studies that cannot be sent. No drafts. */
    rows: LibraryRow[];
    /** For an approved case study started from an older one: that older entry's place. */
    legacyIndexById: Record<string, number>;
    /** False when the library could not be read (switched off, or its tables are missing). */
    available: boolean;
    /** Case studies not yet approved. A count only. */
    unapproved: number;
}

export interface LibraryOption {
    tick: string;
    title: string;
    /** The kinds of work as approved, as words. */
    labels: string[];
    ticked: boolean;
    /** An older case study this was started from is also on the list. */
    startedFromOlder: boolean;
}

export interface PastJobs {
    library: LibraryOption[];
    /** Places of older entries that an approved library case study was started from. */
    olderWithNewVersion: number[];
    /** Library ticks that cannot be sent, each with why. They stay ticked until the contractor unticks them. */
    cannotSend: Array<{ tick: string; message: string }>;
    /** Older case studies the ticks match, before the product's cut to six. */
    olderMatched: number;
    /** Older case studies that would actually be shown. */
    olderShown: number;
    /** Distinct library case studies chosen that can be sent. */
    libraryChosen: number;
    /** Why this selection cannot be sent, or null. Sending is blocked while this is set. */
    blocked: string | null;
    /** Things that are true and worth saying, but do not block sending. */
    notes: string[];
    resolution: Resolution;
}

export const NO_PROPOSAL_LIBRARY: ProposalLibrary = { userId: "", rows: [], legacyIndexById: {}, available: false, unapproved: 0 };

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function buildPastJobs(input: { olderStored: unknown[] | null | undefined; selected: unknown[] | null | undefined; library?: ProposalLibrary | null }): PastJobs {
    const library = input.library ?? NO_PROPOSAL_LIBRARY;
    const selected = Array.isArray(input.selected) ? input.selected.map((value) => String(value)) : [];
    const resolution = resolveSelectedCaseStudies({ userId: library.userId, olderStored: input.olderStored, libraryRows: library.rows, selected });

    const older = legacyCaseStudies(input.olderStored);
    const olderIds = new Set(older.map((entry) => entry.id).filter((id): id is string => id !== null));
    // As the resolver reads them: a prefixed value that is an older entry's own id is an older tick.
    const olderTicks = selected.filter((tick) => !tick.startsWith(LIBRARY_TICK_PREFIX) || olderIds.has(tick));
    const olderMatched = older.filter((entry) => entry.matchedBy.some((tick) => olderTicks.includes(tick))).length;
    const olderShown = Math.min(olderMatched, MAX_CASE_STUDIES_PER_PROPOSAL);
    const multiMatch = Array.from(new Set(olderTicks)).some((tick) => older.filter((entry) => entry.matchedBy.includes(tick)).length > 1);

    const approvedRows = library.rows.filter((row) => row.archived_at === null && row.approved !== null && row.approved !== undefined && approvedProblem(row.approved) === null);
    const olderPlaces = new Set(older.map((entry) => entry.index));
    const options: LibraryOption[] = approvedRows.map((row) => {
        const approved = row.approved as ApprovedCaseStudy;
        const tick = libraryTick(row.id);
        return { tick, title: approved.title, labels: [...approved.disciplines], ticked: selected.includes(tick), startedFromOlder: olderPlaces.has(library.legacyIndexById[row.id] ?? -1) };
    });
    const olderWithNewVersion = approvedRows.map((row) => library.legacyIndexById[row.id]).filter((index): index is number => typeof index === "number" && olderPlaces.has(index));

    const problems = resolution.sendable ? [] : resolution.problems;
    const cannotSend = problems.filter((problem) => problem.reason !== "too-many").map((problem) => ({ tick: problem.tick, message: unsendableMessage(problem.reason, library.available) }));
    const libraryChosen = options.filter((option) => option.ticked).length;

    const cutNote = olderMatched > MAX_CASE_STUDIES_PER_PROPOSAL
        ? `Your ticks match ${olderMatched} older case studies. A proposal shows the first ${MAX_CASE_STUDIES_PER_PROPOSAL} of them, in the order they are saved; the rest are left out.`
        : null;
    let blocked: string | null = null;
    if (cannotSend.length > 0) {
        blocked = cannotSend.length === 1 ? "One past job you chose can't be sent. See below." : `${cannotSend.length} past jobs you chose can't be sent. See below.`;
    } else if (problems.some((problem) => problem.reason === "too-many")) {
        const total = olderShown + libraryChosen;
        blocked = `You've chosen ${plural(total, "past job", "past jobs")} to show (${olderShown} older and ${libraryChosen} new). A proposal shows up to ${MAX_CASE_STUDIES_PER_PROPOSAL}. Untick ${total - MAX_CASE_STUDIES_PER_PROPOSAL}.`
            + (cutNote ? ` Only ${MAX_CASE_STUDIES_PER_PROPOSAL} of your ${olderMatched} older ones are counted, because only ${MAX_CASE_STUDIES_PER_PROPOSAL} are ever shown.` : "");
    }

    const notes: string[] = [];
    if (cutNote && !blocked) notes.push(cutNote);
    if (multiMatch) notes.push("One of your ticks matches more than one older case study, so each of them is shown.");
    if (options.some((option) => option.ticked && option.startedFromOlder && older.some((entry) => entry.index === library.legacyIndexById[option.tick.slice(LIBRARY_TICK_PREFIX.length)] && entry.matchedBy.some((tick) => olderTicks.includes(tick))))) {
        notes.push("You've ticked both the older and the new version of the same job, so it would appear twice.");
    }

    return { library: options, olderWithNewVersion, cannotSend, olderMatched, olderShown, libraryChosen, blocked, notes, resolution };
}
