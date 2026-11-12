/**
 * Case-study library: what a proposal needs to read. Uses the contractor's
 * own session. Approved copies only; drafts, hidden clients and unshown
 * prices are never read here. The number not yet approved is a separate
 * count that carries no content.
 */

import type { ProposalLibrary } from "./past-jobs";
import { LIBRARY_TICK_PREFIX } from "./resolve";
import type { LibraryReader } from "./store";

export async function readProposalLibrary(reader: LibraryReader, userId: string, selected: unknown): Promise<ProposalLibrary> {
    const ticked = (Array.isArray(selected) ? selected : [])
        .map((value) => String(value))
        .filter((tick) => tick.startsWith(LIBRARY_TICK_PREFIX))
        .map((tick) => tick.slice(LIBRARY_TICK_PREFIX.length));
    try {
        const [rows, counts] = await Promise.all([reader.forProposal(userId, ticked), reader.counts(userId)]);
        // Unreadable is "not available". It is never an empty library.
        if (rows.state !== "ok") return { userId, rows: [], legacyIndexById: {}, available: false, unapproved: 0 };
        return { userId, rows: rows.value.rows, legacyIndexById: rows.value.legacyIndexById, available: true, unapproved: counts.state === "ok" ? counts.value.unapproved : 0 };
    } catch {
        return { userId, rows: [], legacyIndexById: {}, available: false, unapproved: 0 };
    }
}
