"use client";

import { useRef, useState } from "react";
import {
    canUseManualAddressPreview,
    EMPTY_MANUAL_ADDRESS_PARTS,
    joinManualAddressPreview,
    manualAddressDraftPending,
    manualAddressPreviewTooLong,
    type ManualAddressParts,
} from "@/lib/manual-address";
import { coreFocusVisibleRing, coreSuggestionPrimary } from "@/lib/core-editing-palette";

type Props = {
    idPrefix: string;
    disabled?: boolean;
    onApply: (preview: string) => void | boolean;
    onPendingChange: (pending: boolean) => void;
    isDark: boolean;
    labelCls: string;
    inputCls: string;
    muted: string;
};

const PART_FIELDS: { key: keyof ManualAddressParts; label: string }[] = [
    { key: "line1", label: "Address line 1" },
    { key: "line2", label: "Address line 2" },
    { key: "townCity", label: "Town or city" },
    { key: "postcode", label: "Postcode" },
];

export default function ManualAddressEntry({
    idPrefix,
    disabled = false,
    onApply,
    onPendingChange,
    isDark,
    labelCls,
    inputCls,
    muted,
}: Props) {
    const [parts, setParts] = useState<ManualAddressParts>(EMPTY_MANUAL_ADDRESS_PARTS);
    const [lastUsedPreview, setLastUsedPreview] = useState("");
    const latest = useRef({ onApply, onPendingChange, disabled });
    latest.current = { onApply, onPendingChange, disabled };

    const preview = joinManualAddressPreview(parts);
    const overLimit = manualAddressPreviewTooLong(preview);
    const useEnabled = !disabled && canUseManualAddressPreview(preview);

    const syncParts = (next: ManualAddressParts) => {
        setParts(next);
        latest.current.onPendingChange(manualAddressDraftPending(next, lastUsedPreview));
    };

    const applyPreview = () => {
        if (latest.current.disabled || !canUseManualAddressPreview(preview)) return;
        const applied = latest.current.onApply(preview);
        if (applied === false) return;
        setLastUsedPreview(preview);
        latest.current.onPendingChange(false);
    };

    const detailsBorder = isDark ? "border-[#3a3a3a]" : "border-gray-300";

    return (
        <details
            className={`mt-3 rounded-lg border ${detailsBorder} px-3 py-2`}
            data-manual-address-entry={idPrefix}
        >
            <summary className={`cursor-pointer text-sm font-semibold ${isDark ? "text-slate-200" : "text-gray-800"}`}>
                Enter address in parts (optional)
            </summary>
            <div className="mt-3 space-y-3 pb-1">
                <p className={`text-sm ${muted}`}>
                    Build a multi-line address, preview it, then use it in the box above. Free typing in the box is unchanged until you choose Use this address.
                </p>
                {PART_FIELDS.map(({ key, label }) => (
                    <div key={key}>
                        <label htmlFor={`${idPrefix}-${key}`} className={labelCls}>
                            {label}
                        </label>
                        <input
                            id={`${idPrefix}-${key}`}
                            type="text"
                            autoComplete="off"
                            disabled={disabled}
                            value={parts[key]}
                            onChange={(event) => syncParts({ ...parts, [key]: event.target.value })}
                            className={`${inputCls} mt-1.5`}
                        />
                    </div>
                ))}
                <div>
                    <p id={`${idPrefix}-preview-label`} className={labelCls}>Preview</p>
                    <pre
                        id={`${idPrefix}-preview`}
                        aria-labelledby={`${idPrefix}-preview-label`}
                        className={`mt-1.5 whitespace-pre-wrap break-words rounded-lg border px-3 py-2 text-sm ${
                            isDark ? "border-[#3a3a3a] bg-[#0d0d0d]/80 text-slate-100" : "border-gray-300 bg-gray-50 text-gray-900"
                        }`}
                    >
                        {preview || "—"}
                    </pre>
                </div>
                {overLimit && (
                    <p id={`${idPrefix}-over-limit`} role="alert" className="text-sm text-red-500">
                        Joined address is over 500 characters. Shorten the parts or edit the box above directly.
                    </p>
                )}
                <button
                    type="button"
                    id={`${idPrefix}-use`}
                    disabled={!useEnabled}
                    onClick={applyPreview}
                    className={`${coreSuggestionPrimary} disabled:cursor-not-allowed disabled:opacity-50 ${coreFocusVisibleRing}`}
                >
                    Use this address
                </button>
            </div>
        </details>
    );
}
