"use client";

import { useState } from "react";
import type { ProposalPublicationSnapshot } from "@/lib/proposal-publication";

/**
 * Lets the client keep a copy. The PDF is drawn in the browser from the
 * same snapshot this page was rendered from.
 */
export default function PublicPdfButton({ snapshot }: { snapshot: ProposalPublicationSnapshot }) {
    const [state, setState] = useState<{ status: "idle" | "working" | "failed"; note: string }>({ status: "idle", note: "" });

    const download = async () => {
        setState({ status: "working", note: "" });
        try {
            const { downloadProposalPdf } = await import("@/lib/pdf/proposal-brochure");
            const result = await downloadProposalPdf(snapshot);
            setState({
                status: "idle",
                note: result.skippedImages > 0
                    ? `The PDF was made without ${result.skippedImages} ${result.skippedImages === 1 ? "image" : "images"} that could not be loaded.`
                    : "",
            });
        } catch {
            setState({ status: "failed", note: "The PDF could not be made. Please try again." });
        }
    };

    return (
        <div className="mt-8 border-t border-stone-200 pt-6">
            <button
                type="button"
                onClick={download}
                disabled={state.status === "working"}
                className="min-h-12 w-full sm:w-auto px-5 border border-stone-400 text-base font-semibold text-stone-900 hover:bg-stone-50 disabled:opacity-60"
            >
                {state.status === "working" ? "Making the PDF…" : "Download this proposal as a PDF"}
            </button>
            {state.note && (
                <p role={state.status === "failed" ? "alert" : "status"} className="mt-2 text-sm text-stone-600">{state.note}</p>
            )}
        </div>
    );
}
