"use client";

import { useState } from "react";
import { ChevronDown, FileDown, Loader2 } from "lucide-react";
import type { ProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { describeRecordedResponse, type RecordedResponseKind } from "@/lib/proposal-response";
import type { WorkspaceStyles } from "@/lib/workspace-styles";

export interface ProposalPublicationHistoryRow {
    id: string;
    version_number: number;
    status: "sent" | "viewed" | "acknowledged" | "accepted" | "declined" | "revoked";
    sent_at: string;
    expires_at: string;
    first_viewed_at: string | null;
    responded_at: string | null;
    responded_by: string | null;
    superseded_by: string | null;
    snapshot_hash: string;
    /** What the publication asked the client for, read from its snapshot. */
    response_kind?: string | null;
    response_mode?: string | null;
}

type LoadPublication = (publicationId: string) => Promise<
    { success: true; snapshot: ProposalPublicationSnapshot; snapshotHash: string } | { success: false; error: string }
>;

function formatDate(value: string | null) {
    if (!value) return null;
    return new Date(value).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/London",
    });
}

export function publicationResponseKind(row: Pick<ProposalPublicationHistoryRow, "response_kind" | "response_mode">): RecordedResponseKind {
    if (row.response_kind === "non_binding_intent" || row.response_kind === "acknowledgement") return row.response_kind;
    return row.response_mode === "binding_acceptance" ? "binding_acceptance" : "acknowledgement";
}

const ASKED_FOR: Record<RecordedResponseKind, string> = {
    acknowledgement: "confirmation of receipt",
    non_binding_intent: "a non-binding intention to proceed",
    binding_acceptance: "acceptance (no longer offered)",
};

/** The status in plain words. A recorded response is described by what that version asked for. */
export function publicationStatusLabel(row: ProposalPublicationHistoryRow): string {
    switch (row.status) {
        case "sent": return "Sent, not opened yet";
        case "viewed": return "Opened by the client";
        case "revoked": return "Replaced by a newer version";
        default: return describeRecordedResponse(row.status, publicationResponseKind(row)).label;
    }
}

/**
 * Every version that has been sent. Each one is a fixed record: it shows
 * what was sent and what the client did, and its PDF is drawn from that
 * version's own snapshot, whatever the draft says now.
 */
export default function PublicationHistoryPanel({
    publications, s, loadPublication,
}: {
    publications: ProposalPublicationHistoryRow[];
    s: WorkspaceStyles;
    loadPublication: LoadPublication;
}) {
    const [open, setOpen] = useState(false);
    const [pdf, setPdf] = useState<{ id: string | null; note: string; failed: boolean }>({ id: null, note: "", failed: false });

    const download = async (publicationId: string) => {
        setPdf({ id: publicationId, note: "", failed: false });
        try {
            const publication = await loadPublication(publicationId);
            if (!publication.success) {
                setPdf({ id: null, note: publication.error, failed: true });
                return;
            }
            const { downloadProposalPdf } = await import("@/lib/pdf/proposal-brochure");
            const result = await downloadProposalPdf(publication.snapshot, publication.snapshotHash);
            setPdf({
                id: null,
                failed: false,
                note: result.skippedImages > 0
                    ? `The PDF was made without ${result.skippedImages} ${result.skippedImages === 1 ? "image" : "images"} that could not be loaded.`
                    : "",
            });
        } catch {
            setPdf({ id: null, note: "The PDF could not be made. Try again.", failed: true });
        }
    };

    return (
        <section className={s.card} aria-labelledby="sent-versions-title" data-publication-history>
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-controls="sent-versions"
                className={`w-full min-h-14 px-4 sm:px-5 py-3 flex items-center justify-between gap-3 text-left ${s.body}`}
            >
                <span>
                    <span id="sent-versions-title" className={`block text-base font-bold ${s.heading}`}>
                        Sent versions ({publications.length})
                    </span>
                    <span className={`block text-sm ${s.muted}`}>Each version is kept exactly as it was sent.</span>
                </span>
                <ChevronDown className={`w-5 h-5 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>

            {open && (
                <div id="sent-versions" className="px-4 sm:px-5 pb-5">
                    {pdf.note && (
                        <p role={pdf.failed ? "alert" : "status"} className={`mb-3 text-sm ${pdf.failed ? s.errorBox : s.noticeBox}`}>{pdf.note}</p>
                    )}
                    <ul className={`divide-y ${s.divider}`}>
                        {publications.map((publication) => (
                            <li key={publication.id} className="py-4 space-y-1" data-publication-version={publication.version_number}>
                                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                    <p className={`text-base font-bold ${s.heading}`}>Version {publication.version_number}</p>
                                    <p className={`text-sm font-semibold ${s.body}`}>{publicationStatusLabel(publication)}</p>
                                </div>
                                <p className={`text-sm ${s.muted}`}>Sent {formatDate(publication.sent_at)}. Valid until {formatDate(publication.expires_at)}.</p>
                                <p className={`text-sm ${s.muted}`}>Asked the client for {ASKED_FOR[publicationResponseKind(publication)]}.</p>
                                {publication.first_viewed_at && (
                                    <p className={`text-sm ${s.muted}`}>First opened {formatDate(publication.first_viewed_at)}.</p>
                                )}
                                {publication.responded_at && (
                                    <p className={`text-sm ${s.muted}`}>
                                        Response recorded {formatDate(publication.responded_at)}
                                        {publication.responded_by ? ` by ${publication.responded_by}` : ""}.
                                    </p>
                                )}
                                <p className={`font-mono text-xs break-all ${s.muted}`}>Snapshot {publication.snapshot_hash.slice(0, 12)}</p>
                                <button
                                    type="button"
                                    onClick={() => void download(publication.id)}
                                    disabled={pdf.id !== null}
                                    className={`${s.quietButton} -ml-3`}
                                >
                                    {pdf.id === publication.id
                                        ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Making the PDF…</>
                                        : <><FileDown className="w-4 h-4" aria-hidden="true" /> Download version {publication.version_number} as a PDF</>}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}
