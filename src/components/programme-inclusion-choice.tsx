"use client";

import { useRef, useState } from "react";
import type { SaveProgrammeInclusion } from "@/app/dashboard/projects/schedule/inclusion-actions";
import type { WorkspaceStyles } from "@/lib/workspace-styles";

interface Props {
    included: boolean;
    disabled: boolean;
    canChange: () => boolean;
    save: SaveProgrammeInclusion;
    onConfirmed: (phases: unknown[]) => void;
    onPending: (pending: boolean) => void;
    s: WorkspaceStyles;
}

export default function ProgrammeInclusionChoice({ included, disabled, canChange, save, onConfirmed, onPending, s }: Props) {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inFlight = useRef(false);
    const change = async () => {
        if (disabled || inFlight.current) return;
        if (!canChange()) { setError("Save your programme edits before changing whether it is included."); return; }
        inFlight.current = true; setPending(true); onPending(true); setError(null);
        try {
            const result = await save(!included);
            if (!result.success) { setError(result.error); return; }
            if (!canChange()) {
                setError("The choice saved, but newer unsaved edits were retained here. Reload Programme before changing it again.");
                return;
            }
            onConfirmed(result.programmePhases);
        } catch { setError("The choice wasn't confirmed and may already have saved. Reload Programme before retrying."); }
        finally { inFlight.current = false; setPending(false); onPending(false); }
    };
    return (
        <section className={`${s.card} p-4 sm:p-6 space-y-3`} aria-labelledby="programme-inclusion-title" aria-busy={pending}>
            <h2 id="programme-inclusion-title" className={`text-lg font-bold ${s.heading}`}>Programme on the proposal</h2>
            <p className={`text-sm ${s.body}`}>
                {included ? "Included by default. A missing or invalid programme still needs attention before the proposal can be sent."
                    : "Deliberately omitted. Saved activities are retained, but no programme or timing summary is included in the proposal."}
            </p>
            <button type="button" disabled={disabled || pending} onClick={() => void change()} className={`${s.secondaryButton} min-h-11`}>
                {pending ? "Saving choice..." : included ? "Omit programme from proposal" : "Include programme in proposal"}
            </button>
            {error && <p role="alert" className={`text-sm ${s.errorText}`}>{error}</p>}
        </section>
    );
}
