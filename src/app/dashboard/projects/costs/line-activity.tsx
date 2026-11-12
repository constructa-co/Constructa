"use client";

import { useRef, useState } from "react";
import type { WorkspaceStyles } from "@/lib/workspace-styles";
import { savePriceLineActivityAction, type ActivitySaveResult } from "./activity-actions";

interface Props {
    lineId: string; estimateId: string; section: string | null; choices: string[];
    styles: WorkspaceStyles; blocked: boolean;
    onBegin: () => boolean;
    onWork: (status: "editing" | "saving" | "confirmed" | "uncertain") => void;
    onSaved: (result: Extract<ActivitySaveResult, { ok: true }>, expected: string | null) => boolean;
    save?: typeof savePriceLineActivityAction;
    helpText?: string;
}

export default function LineActivity({ lineId, estimateId, section, choices, styles, blocked, onBegin, onWork, onSaved, save = savePriceLineActivityAction, helpText }: Props) {
    const [draft, setDraft] = useState<string | null>(null);
    const [status, setStatus] = useState<"editing" | "saving" | "uncertain" | "confirmed">("confirmed");
    const [message, setMessage] = useState("");
    const pending = useRef(false);
    const phase = useRef<"closed" | "editing" | "saving" | "uncertain">("closed");
    const draftRef = useRef("");
    const [session, setSession] = useState(0);
    const sessionRef = useRef(0);
    const name = draft?.trim() ?? "";
    const prefix = `line-activity-${lineId}`;
    if (draft === null) return <button type="button" data-line-activity={lineId} disabled={blocked}
        className={`${styles.quietButton} mt-1 text-sm`} onClick={() => {
            if (blocked || !onBegin()) return;
            sessionRef.current++; setSession(sessionRef.current);
            phase.current = "editing"; draftRef.current = section ?? ""; setDraft(section ?? ""); setStatus("editing"); setMessage("");
        }}>Activity: {section || "General"} · Change</button>;
    return <div className={`${styles.inset} mt-3 min-w-0 p-3`} data-line-activity-editor={lineId}>
        <label htmlFor={prefix} className={`block text-sm font-semibold ${styles.body}`}>Work activity for this line</label>
        <input id={prefix} list={`${prefix}-choices`} type="text" value={draft} disabled={status !== "editing" || blocked}
            className={`${styles.input} mt-2 w-full min-w-0 text-base`} aria-describedby={`${prefix}-help`}
            onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }}
            onChange={event => { if (sessionRef.current !== session || phase.current !== "editing" || blocked) return; draftRef.current = event.currentTarget.value; setDraft(event.currentTarget.value); setMessage(""); }} />
        <datalist id={`${prefix}-choices`}>{choices.map(choice => <option key={choice} value={choice} />)}</datalist>
        <p id={`${prefix}-help`} className={`mt-2 text-sm ${styles.muted}`}>{helpText ?? "Use your own activity name or an existing one, up to 100 characters. Only this line moves; its price and resources stay unchanged. Preliminaries affects calculations and stays in Advanced estimating."}</p>
        <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={styles.secondaryButton} disabled={blocked || status !== "editing" || !name || name.length > 100}
                onClick={async () => {
                    const submitted = draftRef.current.trim();
                    if (sessionRef.current !== session || blocked || pending.current || phase.current !== "editing" || !submitted || submitted.length > 100) return;
                    pending.current = true; phase.current = "saving"; setStatus("saving"); onWork("saving"); setMessage("");
                    try {
                        const result = await save({ estimateId, lineId, expectedSection: section, section: submitted });
                        if (sessionRef.current !== session) return;
                        if (!result.ok) {
                            phase.current = result.uncertain ? "uncertain" : "editing";
                            setStatus(result.uncertain ? "uncertain" : "editing"); onWork(result.uncertain ? "uncertain" : "editing"); setMessage(result.error); return;
                        }
                        if (result.lineId !== lineId || result.estimateId !== estimateId || result.section !== submitted || !onSaved(result, section)) {
                            phase.current = "uncertain"; setStatus("uncertain"); onWork("uncertain"); setMessage("The saved activity no longer matches this view. Reload to reconcile it before continuing."); return;
                        }
                        phase.current = "closed"; setDraft(null); setStatus("confirmed"); onWork("confirmed"); setMessage("");
                    } catch {
                        if (sessionRef.current !== session) return;
                        phase.current = "uncertain"; setStatus("uncertain"); onWork("uncertain"); setMessage("The activity may have saved. Your draft is still here. Reload to reconcile it before retrying.");
                    } finally { pending.current = false; }
                }}>{status === "saving" ? "Saving activity…" : "Save activity"}</button>
            <button type="button" className={styles.quietButton} disabled={status !== "editing" || blocked} onClick={() => {
                if (sessionRef.current !== session || pending.current || phase.current !== "editing") return;
                phase.current = "closed"; setDraft(null); setStatus("confirmed"); setMessage(""); onWork("confirmed");
            }}>Cancel</button>
        </div>
        {name.length > 100 && <p role="alert" className={`mt-2 text-sm ${styles.errorText}`}>Keep the activity within 100 characters. Nothing is truncated.</p>}
        {message && <p role="alert" className={`mt-2 break-words text-sm ${styles.errorText}`}>{message}</p>}
    </div>;
}
