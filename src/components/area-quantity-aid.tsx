"use client";

import { useState } from "react";
import { areaQuantity } from "@/lib/area-quantity";

export interface AreaQuantityAidProps {
    idPrefix: string;
    unit: string;
    disabled: boolean;
    onUse: (quantity: string) => void;
}

export default function AreaQuantityAid({ idPrefix, unit, disabled, onUse }: AreaQuantityAidProps) {
    const [open, setOpen] = useState(false);
    if (unit !== "m2") return null;

    return (
        <details className="rounded-xl border border-current/30 p-3 text-sm"
            onToggle={event => setOpen(event.currentTarget.open)}>
            <summary className="cursor-pointer font-semibold">Calculate an area: length x width</summary>
            <p className="mt-2">Enter both measurements in metres for m2. Dimensions are not retained when this aid is closed or the line is reopened. No unit conversion, waste or deductions are added.</p>
            {open && <AreaQuantityInputs idPrefix={idPrefix} disabled={disabled} onUse={onUse} />}
        </details>
    );
}

export function AreaQuantityInputs({ idPrefix, disabled, onUse }: Omit<AreaQuantityAidProps, "unit">) {
    const [length, setLength] = useState("");
    const [width, setWidth] = useState("");
    const result = areaQuantity(length, width);
    const helpId = `${idPrefix}-area-help`;

    return (
        <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
                {([
                    { name: "length", label: "Length (m)", value: length, change: setLength },
                    { name: "width", label: "Width (m)", value: width, change: setWidth },
                ]).map(field => (
                    <div key={field.name}>
                        <label htmlFor={`${idPrefix}-${field.name}`} className="block text-sm font-semibold">{field.label}</label>
                        <input id={`${idPrefix}-${field.name}`} value={field.value} inputMode="decimal" autoComplete="off"
                            disabled={disabled} maxLength={64} aria-describedby={helpId}
                            onChange={event => field.change(event.target.value)}
                            onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); } }}
                            className="mt-1.5 w-full rounded-lg border border-current bg-transparent px-3 py-2 text-base" />
                    </div>
                ))}
            </div>
            <p id={helpId} role="status">{result.ok ? `Exact area: ${result.quantity} m2` : result.error}</p>
            <button type="button" disabled={disabled || !result.ok}
                onClick={() => { if (!disabled && result.ok) onUse(result.quantity); }}
                className="min-h-11 rounded-lg border border-current px-3 py-2 font-semibold disabled:opacity-50">
                Use quantity
            </button>
            <p>Use quantity replaces only the draft quantity. Unit and rate stay unchanged. Save line is still a separate step.</p>
        </div>
    );
}
