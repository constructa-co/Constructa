"use client";

import { useState } from "react";
import { formatPlanDate } from "@/lib/programme-plan";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<"input">, "type"> & {
    mutedClassName?: string;
};

/**
 * CON-035 — native date input with a written-out preview ("6 November 2026").
 * The browser and device decide the order of the native day/month boxes; `lang`
 * is only a hint and does not change it. The preview is what removes the doubt.
 */
export default function UkDateInput({
    className,
    value,
    defaultValue,
    id,
    mutedClassName,
    onChange,
    "aria-describedby": describedBy,
    ...props
}: Props) {
    const controlled = value !== undefined;
    const [uncontrolledIso, setUncontrolledIso] = useState(() =>
        (typeof defaultValue === "string" ? defaultValue : "").slice(0, 10),
    );
    const iso = (controlled
        ? typeof value === "string"
            ? value
            : ""
        : uncontrolledIso).slice(0, 10);
    const preview = iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? formatPlanDate(iso, "short-month-long") : "";
    const helpId = id ? `${id}-uk-date-help` : undefined;
    const described = [describedBy, helpId].filter(Boolean).join(" ") || undefined;

    return (
        <div className="space-y-1" data-uk-date-input={id ?? undefined}>
            <input
                {...props}
                id={id}
                type="date"
                lang="en-GB"
                value={iso}
                onChange={(event) => {
                    const next = event.target.value.slice(0, 10);
                    if (!controlled) setUncontrolledIso(next);
                    onChange?.(event);
                }}
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
                    ? "This is the date you picked, written out with the day first. Check it is the one you meant."
                    : "Pick a date. It will be written out here so you can check the day and month."}
            </p>
        </div>
    );
}