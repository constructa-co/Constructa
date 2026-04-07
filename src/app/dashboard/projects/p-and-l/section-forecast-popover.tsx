"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { upsertSectionForecastAction } from "./actions";
import { useRouter } from "next/navigation";

interface Props {
    projectId: string;
    section: string;
    currentForecast: number | null;
    budget: number;
}

export default function SectionForecastPopover({ projectId, section, currentForecast, budget }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState(currentForecast != null ? String(currentForecast) : "");
    const [isPending, startTransition] = useTransition();

    const handleSave = () => {
        const num = value === "" ? null : parseFloat(value);
        if (value !== "" && (isNaN(num!) || num! < 0)) return;
        startTransition(async () => {
            await upsertSectionForecastAction(projectId, section, num);
            setOpen(false);
            router.refresh();
        });
    };

    const handleClear = () => {
        setValue("");
        startTransition(async () => {
            await upsertSectionForecastAction(projectId, section, null);
            setOpen(false);
            router.refresh();
        });
    };

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="ml-1.5 text-slate-600 hover:text-slate-300 transition-colors opacity-0 group-hover:opacity-100"
                title="Set forecast"
            >
                <Pencil className="w-3 h-3" />
            </button>
        );
    }

    return (
        <div className="inline-flex items-center gap-1 ml-1.5">
            <span className="text-slate-500 text-xs">£</span>
            <input
                autoFocus
                type="number"
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setOpen(false); }}
                placeholder={budget > 0 ? String(Math.round(budget)) : "0"}
                className="w-24 bg-slate-700 border border-slate-500 rounded px-1.5 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
            <button type="button" onClick={handleSave} disabled={isPending} className="text-emerald-400 hover:text-emerald-300">
                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            </button>
            {currentForecast != null && (
                <button type="button" onClick={handleClear} className="text-slate-500 hover:text-slate-300">
                    <X className="w-3 h-3" />
                </button>
            )}
            <button type="button" onClick={() => setOpen(false)} className="text-slate-600 hover:text-slate-400">
                <X className="w-3 h-3" />
            </button>
        </div>
    );
}
