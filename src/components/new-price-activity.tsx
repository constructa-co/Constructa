"use client";

import { MAX_PRICE_ACTIVITY_LENGTH } from "@/lib/simple-estimate";
import type { WorkspaceStyles } from "@/lib/workspace-styles";

export default function NewPriceActivity({ id, value, names, disabled, error, form, onChange, s }: {
    id: string;
    value: string;
    names: readonly string[];
    disabled: boolean;
    error?: string;
    form?: string;
    onChange: (activity: string) => void;
    s: WorkspaceStyles;
}) {
    return <details className="mt-3" data-new-price-activity open={error ? true : undefined}>
        <summary className={`min-h-11 flex items-center cursor-pointer text-sm ${s.body}`}>Activity: {value.trim() || "General"} (optional)</summary>
        <label htmlFor={id} className={`block mt-2 ${s.label}`}>Activity for this new line</label>
        <input id={id} form={form} list={`${id}-names`} value={value} disabled={disabled} maxLength={MAX_PRICE_ACTIVITY_LENGTH}
            aria-invalid={error ? true : undefined} aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
            autoComplete="off" className={`${s.input} mt-1.5`} placeholder="General if left blank"
            onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }}
            onChange={event => onChange(event.target.value)} />
        <datalist id={`${id}-names`}>{names.map(name => <option key={name} value={name} />)}</datalist>
        <p id={`${id}-help`} className={`mt-2 text-sm ${s.muted}`}>Choose a saved activity or write your own. Blank keeps General. Saved with this line only; the next line starts without an activity choice. Manage Preliminaries in Advanced estimating.</p>
        {error && <p id={`${id}-error`} role="alert" className={`mt-2 text-sm ${s.errorText}`}>{error}</p>}
    </details>;
}
