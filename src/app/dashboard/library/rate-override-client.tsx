"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, RotateCcw, Check, X } from "lucide-react";
import { upsertRateOverrideAction, deleteRateOverrideAction } from "./actions";
import { toast } from "sonner";

interface RateOverrideItemProps {
    item: {
        id: string;
        code: string;
        description: string;
        unit: string;
        base_rate: number;
        is_featured: boolean;
        override?: {
            custom_rate: number;
            notes?: string;
        } | null;
    };
}

export default function RateOverrideItem({ item }: RateOverrideItemProps) {
    const [editing, setEditing] = useState(false);
    const [rateInput, setRateInput] = useState(
        item.override ? String(item.override.custom_rate) : String(item.base_rate)
    );
    const [saving, setSaving] = useState(false);

    const effectiveRate = item.override ? item.override.custom_rate : item.base_rate;
    const hasOverride = !!item.override;

    const handleSave = async () => {
        setSaving(true);
        const fd = new FormData();
        fd.append("mom_item_id", item.id);
        fd.append("custom_rate", rateInput);
        const result = await upsertRateOverrideAction(fd);
        setSaving(false);
        if (result?.error) {
            toast.error(result.error);
        } else {
            toast.success("Rate updated");
            setEditing(false);
        }
    };

    const handleReset = async () => {
        const fd = new FormData();
        fd.append("mom_item_id", item.id);
        const result = await deleteRateOverrideAction(fd);
        if ("error" in result) {
            toast.error("Failed to reset rate");
        } else {
            toast.success("Rate reset to benchmark");
            setRateInput(String(item.base_rate));
        }
    };

    return (
        <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-800/50 group transition-colors">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500">{item.code}</span>
                    <span className="text-sm text-slate-200 truncate">{item.description}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500">{item.unit}</span>
                    {hasOverride ? (
                        <span className="text-xs text-amber-400">
                            Your rate: £{Number(effectiveRate).toFixed(2)}
                            <span className="text-slate-500 ml-1">(Benchmark: £{Number(item.base_rate).toFixed(2)})</span>
                        </span>
                    ) : (
                        <span className="text-xs text-slate-400">
                            Market benchmark: £{Number(effectiveRate).toFixed(2)}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
                {editing ? (
                    <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 text-sm">£</span>
                        <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={rateInput}
                            onChange={(e) => setRateInput(e.target.value)}
                            className="w-24 h-7 text-sm bg-slate-900 border-slate-600 text-white"
                            autoFocus
                        />
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleSave}
                            disabled={saving}
                            className="h-7 px-2 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditing(false); setRateInput(String(effectiveRate)); }}
                            className="h-7 px-2 text-slate-400 hover:text-white"
                        >
                            <X className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(true)}
                            className="h-7 px-2 text-slate-400 hover:text-white hover:bg-slate-700"
                        >
                            <Pencil className="w-3 h-3 mr-1" />
                            <span className="text-xs">Set my rate</span>
                        </Button>
                        {hasOverride && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleReset}
                                className="h-7 px-2 text-slate-500 hover:text-slate-300 hover:bg-slate-700"
                            >
                                <RotateCcw className="w-3 h-3" />
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
