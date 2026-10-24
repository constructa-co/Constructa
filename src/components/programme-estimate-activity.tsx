"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_STAGE_NAME_LENGTH } from "@/lib/simple-programme";
import type { WorkspaceStyles } from "@/lib/workspace-styles";

export default function ProgrammeEstimateActivity({ id, names, disabled, copy, s }: {
    id: string;
    names: readonly string[];
    disabled: boolean;
    copy: (name: string) => boolean;
    s: WorkspaceStyles;
}) {
    const [selected, setSelected] = useState("");
    const [refused, setRefused] = useState(false);
    const choice = useRef("");
    const active = useRef(true);
    useEffect(() => {
        active.current = true;
        return () => { active.current = false; };
    }, []);
    const tooLong = selected.length > MAX_STAGE_NAME_LENGTH;

    return (
        <details className="mt-3" data-estimate-stage-choice>
            <summary className={`min-h-11 flex items-center cursor-pointer text-sm font-semibold ${s.body}`}>Reuse a saved estimate activity</summary>
            <div className="mt-2 space-y-3">
                <p className={`text-sm ${s.muted}`}>From this job&apos;s selected estimate. Copies only the name into this empty stage. Set its duration yourself, then Save programme. No new stages or prices are created.</p>
                <label htmlFor={`${id}-activity`} className={s.label}>Saved activity name</label>
                <select id={`${id}-activity`} className={s.input} value={selected} disabled={disabled}
                    onChange={event => { choice.current = event.target.value; setSelected(event.target.value); setRefused(false); }}>
                    <option value="">Choose an activity to review</option>
                    {names.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                {selected && <p className={`text-sm break-words ${s.body}`} data-estimate-stage-review>Review name: <strong>{selected}</strong></p>}
                {tooLong && <p role="status" className={`text-sm ${s.muted}`}>This saved name exceeds {MAX_STAGE_NAME_LENGTH} characters. Write a shorter stage name above; nothing has been shortened or copied.</p>}
                <button type="button" className={`${s.secondaryButton} min-h-11 text-sm`} disabled={disabled || !selected || tooLong}
                    onClick={() => {
                        if (!active.current || disabled || choice.current !== selected || !selected || tooLong) return;
                        setRefused(!copy(selected));
                    }}>Use activity name</button>
                {refused && <p role="alert" className={`text-sm ${s.errorText}`}>The programme changed after this review. Review the current empty stage again; nothing was replaced.</p>}
            </div>
        </details>
    );
}
