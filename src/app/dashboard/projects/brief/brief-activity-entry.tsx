"use client";

import type { WorkspaceStyles } from "@/lib/workspace-styles";

export default function BriefActivityEntry({ text, error, locked, onChange, onAdd, onClear, s }: {
    text: string;
    error: string | null;
    locked: boolean;
    onChange: (text: string) => void;
    onAdd: () => void;
    onClear: () => void;
    s: WorkspaceStyles;
}) {
    const idle = locked || text.length === 0;
    return (
        <div className="space-y-3">
            <label htmlFor="brief-activity-entry" className={s.label}>Activity to add</label>
            <textarea
                id="brief-activity-entry"
                rows={2}
                className={s.input}
                value={text}
                readOnly={locked}
                onChange={event => onChange(event.target.value)}
            />
            <p className={`text-sm ${s.muted}`}>An entry joins this Brief only when you choose Add activity. The existing Save is what keeps it. Nothing is priced automatically.</p>
            {error !== null && <p role="alert" className={`text-sm ${s.errorText}`}>{error}</p>}
            <div className="flex flex-wrap gap-3">
                <button type="button" className={s.primaryButton} disabled={idle} onClick={onAdd}>Add activity</button>
                <button type="button" className={s.quietButton} disabled={idle} onClick={onClear}>Clear entry</button>
            </div>
        </div>
    );
}
