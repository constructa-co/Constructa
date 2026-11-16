"use client";

import { formatPlanDate } from "@/lib/programme-plan";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<"input">, "type"> & {
    mutedClassName?: string;
};

/**
 * CON-035 — native date input with UK locale hint and a written-out preview so
 * contractors see the same words proposals and PDFs use.
 */
export default function UkDateInput({ className, value, defaultValue, id, mutedClassName, "aria-describedby": describedBy, ...props }: Props) {
    const controlled = value !== undefined;
    const iso = (typeof value === "string" ? value : typeof defaultValue === "string" ? defaultValue : "").slice(0, 10);
    const preview = iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? formatPlanDate(iso, "short") : "";
    const helpId = id ? `${id}-uk-date-help` : undefined;
    const described = [describedBy, helpId].filter(Boolean).join(" ") || undefined;

    return (
        <div className="space-y-1" data-uk-date-input={id ?? undefined}>
            <input
                {...props}
                id={id}
                type="date"
                lang="en-GB"
                {...(controlled ? { value: iso } : { defaultValue: iso || undefined })}
                className={cn(className)}
                aria-describedby={described}
            />
            {preview ? (
                <p className={cn("text-sm font-medium", mutedClassName)} data-uk-date-preview>
                    {preview}
                </p>
            ) : null}
            <p id={helpId} className={cn("text-sm", mutedClassName)}>
                {preview
                    ? "Shown on proposals and PDFs in this UK format."
                    : "Pick a date. When your browser shows a calendar, day comes before month (UK order)."}
            </p>
        </div>
    );
}