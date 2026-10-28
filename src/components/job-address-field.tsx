"use client";

import ManualAddressEntry from "@/components/manual-address-entry";
import PostcodeAddressPicker from "@/components/postcode-address-picker";
import type { PostcodeLookupFn } from "@/lib/postcode-address";

type SharedProps = {
    idPrefix: string;
    textareaId: string;
    label: string;
    placeholder: string;
    disabled?: boolean;
    value: string;
    onChange: (value: string) => void;
    onStructuredPendingChange: (pending: boolean) => void;
    lookup?: PostcodeLookupFn;
    isDark: boolean;
    labelCls: string;
    inputCls: string;
    textareaCls: string;
    muted: string;
    fieldError?: React.ReactNode;
    textareaAria?: Pick<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "aria-invalid" | "aria-describedby">;
    /** Site-only: show unusual-site guidance without copying from client. */
    showUnusualSiteFallback?: boolean;
};

export default function JobAddressField({
    idPrefix,
    textareaId,
    label,
    placeholder,
    disabled = false,
    value,
    onChange,
    onStructuredPendingChange,
    lookup,
    isDark,
    labelCls,
    inputCls,
    textareaCls,
    muted,
    fieldError,
    textareaAria,
    showUnusualSiteFallback = false,
}: SharedProps) {
    const detailsBorder = isDark ? "border-[#3a3a3a]" : "border-gray-300";

    return (
        <div data-job-address-field={idPrefix}>
            <label htmlFor={textareaId} className={labelCls}>
                {label}
            </label>
            <div className="mt-1.5 space-y-3">
                <PostcodeAddressPicker
                    idPrefix={`${idPrefix}-picker`}
                    disabled={disabled}
                    lookup={lookup}
                    onSelect={onChange}
                    isDark={isDark}
                    inputCls={inputCls}
                    muted={muted}
                />
                <textarea
                    id={textareaId}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    rows={2}
                    maxLength={500}
                    disabled={disabled}
                    placeholder={placeholder}
                    className={textareaCls}
                    {...textareaAria}
                />
                {fieldError}
                {showUnusualSiteFallback && (
                    <details
                        className={`rounded-lg border ${detailsBorder} px-3 py-2`}
                        data-unusual-site-fallback={idPrefix}
                    >
                        <summary className={`cursor-pointer text-sm font-semibold ${isDark ? "text-slate-200" : "text-gray-800"}`}>
                            Unusual site (no normal postal address)
                        </summary>
                        <p className={`mt-2 text-sm ${muted}`}>
                            For plots, courtyards, new builds without a postcode yet, or site descriptions only you use — type exactly what should appear on the job in the box above. We never copy the client&apos;s billing address here.
                        </p>
                    </details>
                )}
                <ManualAddressEntry
                    idPrefix={`${idPrefix}-manual`}
                    disabled={disabled}
                    onApply={(preview) => {
                        onChange(preview);
                        return true;
                    }}
                    onPendingChange={onStructuredPendingChange}
                    isDark={isDark}
                    labelCls={labelCls}
                    inputCls={inputCls}
                    muted={muted}
                />
            </div>
        </div>
    );
}
