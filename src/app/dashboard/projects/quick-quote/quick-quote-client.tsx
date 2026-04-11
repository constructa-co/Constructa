"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Check, Loader2, Settings2 } from "lucide-react";
import {
    createQuickQuoteFromTemplateAction,
    type QuickQuoteTemplate,
    type TemplateLineItem,
} from "./actions";

/**
 * Sprint 58 Phase 2 item #10 — Quick Quote UI.
 *
 * Two-step flow:
 *   1. Pick a template from the grid
 *   2. Fill in project name + client details → create → redirect to
 *      the Estimates tab of the new project so the contractor can
 *      tweak line items and hit PDF.
 *
 * The "Full Control" button at the bottom drops to /dashboard/projects/new
 * so the existing wizard stays the path for large jobs.
 */

function formatGbp(n: number): string {
    return "£" + Math.round(n).toLocaleString("en-GB");
}

function sumTemplateLines(lines: TemplateLineItem[]): number {
    return lines.reduce(
        (s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_rate) || 0),
        0,
    );
}

function applyMargins(
    direct: number,
    prelimsPct: number,
    overheadPct: number,
    riskPct: number,
    profitPct: number,
): number {
    // Mirrors src/lib/financial.ts computeContractSum exactly. Kept inline
    // for the preview number because the template isn't yet an estimate.
    const prelims = direct * (prelimsPct / 100);
    const totalConstruction = direct + prelims;
    const oh = totalConstruction * (overheadPct / 100);
    const risk = (totalConstruction + oh) * (riskPct / 100);
    const profit = (totalConstruction + oh + risk) * (profitPct / 100);
    return totalConstruction + oh + risk + profit;
}

export default function QuickQuoteClient({
    templates,
}: {
    templates: QuickQuoteTemplate[];
}) {
    const router = useRouter();
    const [selectedTemplate, setSelectedTemplate] =
        useState<QuickQuoteTemplate | null>(null);
    const [form, setForm] = useState({
        name: "",
        client_name: "",
        client_email: "",
        client_phone: "",
        site_address: "",
        postcode: "",
    });
    const [isPending, startTransition] = useTransition();

    const estimatedValue = useMemo(() => {
        if (!selectedTemplate) return 0;
        const direct = sumTemplateLines(selectedTemplate.default_line_items ?? []);
        return applyMargins(
            direct,
            Number(selectedTemplate.default_prelims_pct),
            Number(selectedTemplate.default_overhead_pct),
            Number(selectedTemplate.default_risk_pct),
            Number(selectedTemplate.default_profit_pct),
        );
    }, [selectedTemplate]);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedTemplate) return;
        if (!form.name.trim()) {
            toast.error("Give this quote a name so you can find it again.");
            return;
        }
        startTransition(async () => {
            const res = await createQuickQuoteFromTemplateAction({
                templateId:      selectedTemplate.id,
                name:            form.name.trim(),
                client_name:     form.client_name.trim(),
                client_email:    form.client_email.trim(),
                client_phone:    form.client_phone.trim(),
                site_address:    form.site_address.trim(),
                postcode:        form.postcode.trim(),
                potential_value: estimatedValue > 0 ? Math.round(estimatedValue) : null,
            });
            if (!res.success) {
                toast.error(res.error || "Could not create Quick Quote");
                return;
            }
            toast.success("Quick Quote created — opening estimate");
            router.push(`/dashboard/projects/costs?projectId=${res.projectId}`);
        });
    }

    // ── Step 1: template picker ─────────────────────────────────────────
    if (!selectedTemplate) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map((tpl) => {
                        const direct = sumTemplateLines(tpl.default_line_items ?? []);
                        const value = applyMargins(
                            direct,
                            Number(tpl.default_prelims_pct),
                            Number(tpl.default_overhead_pct),
                            Number(tpl.default_risk_pct),
                            Number(tpl.default_profit_pct),
                        );
                        return (
                            <button
                                key={tpl.id}
                                type="button"
                                onClick={() => setSelectedTemplate(tpl)}
                                className="group text-left bg-slate-900 border border-slate-800 hover:border-purple-600 rounded-2xl p-5 transition-all hover:-translate-y-0.5"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="h-10 w-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xl">
                                        {tpl.icon ?? "📋"}
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-purple-400 transition-colors">
                                        {tpl.project_type}
                                    </span>
                                </div>
                                <h3 className="text-base font-bold text-slate-100 mb-1">
                                    {tpl.name}
                                </h3>
                                <p className="text-xs text-slate-500 line-clamp-3 mb-3 leading-relaxed">
                                    {tpl.description}
                                </p>
                                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                                            Typical value
                                        </p>
                                        <p className="text-sm font-bold text-slate-200">
                                            {formatGbp(value)}
                                        </p>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Full wizard fallback */}
                <div className="flex items-center justify-between bg-slate-900/50 border border-slate-800 rounded-xl px-5 py-4">
                    <div className="flex items-center gap-3">
                        <Settings2 className="w-5 h-5 text-slate-500" />
                        <div>
                            <p className="text-sm font-semibold text-slate-200">
                                Need the full wizard?
                            </p>
                            <p className="text-xs text-slate-500">
                                For larger or more bespoke jobs — step through brief, estimate,
                                programme, contracts and proposal.
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/dashboard/projects/new"
                        className="text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg border border-slate-700 transition-colors"
                    >
                        Full Control →
                    </Link>
                </div>
            </div>
        );
    }

    // ── Step 2: fill in details ─────────────────────────────────────────
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Details form */}
            <form
                onSubmit={handleSubmit}
                className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5"
            >
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{selectedTemplate.icon ?? "📋"}</span>
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider">
                                Template
                            </p>
                            <h2 className="text-base font-bold text-slate-100">
                                {selectedTemplate.name}
                            </h2>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSelectedTemplate(null)}
                        className="text-xs text-slate-500 hover:text-slate-300"
                    >
                        Change template
                    </button>
                </div>

                <Field label="Project name" required>
                    <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g. 22 Birchwood Avenue — Kitchen Extension"
                        className={inputCls}
                        required
                        autoFocus
                    />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field label="Client name">
                        <input
                            type="text"
                            value={form.client_name}
                            onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                            placeholder="e.g. Mr & Mrs Patel"
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Client email">
                        <input
                            type="email"
                            value={form.client_email}
                            onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                            placeholder="e.g. patel@example.com"
                            className={inputCls}
                        />
                    </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field label="Client phone">
                        <input
                            type="tel"
                            value={form.client_phone}
                            onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                            placeholder="e.g. 01234 567890"
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Postcode">
                        <input
                            type="text"
                            value={form.postcode}
                            onChange={(e) => setForm({ ...form, postcode: e.target.value })}
                            placeholder="e.g. M21 9LN"
                            className={inputCls}
                        />
                    </Field>
                </div>

                <Field label="Site address">
                    <input
                        type="text"
                        value={form.site_address}
                        onChange={(e) => setForm({ ...form, site_address: e.target.value })}
                        placeholder="e.g. 22 Birchwood Avenue, Chorlton, Manchester"
                        className={inputCls}
                    />
                </Field>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                    <button
                        type="button"
                        onClick={() => setSelectedTemplate(null)}
                        className="h-10 px-4 rounded-lg text-sm font-semibold text-slate-400 hover:text-slate-200"
                    >
                        Back
                    </button>
                    <button
                        type="submit"
                        disabled={isPending}
                        className="h-10 px-5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-60"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Creating…
                            </>
                        ) : (
                            <>
                                Create Quick Quote
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* Preview sidebar */}
            <aside className="space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-slate-500">
                            Estimated contract value
                        </p>
                        <p className="text-2xl font-bold text-purple-400">
                            {formatGbp(estimatedValue)}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                            Based on the template&apos;s placeholder line items and default margins.
                            You can tweak every line on the next screen.
                        </p>
                    </div>
                    <div className="pt-4 border-t border-slate-800 space-y-2">
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
                            Includes
                        </p>
                        {(selectedTemplate.default_trade_sections ?? [])
                            .slice(0, 6)
                            .map((sec) => (
                                <div key={sec} className="flex items-center gap-2 text-xs text-slate-400">
                                    <Check className="w-3 h-3 text-purple-500 flex-shrink-0" />
                                    <span className="truncate">{sec}</span>
                                </div>
                            ))}
                        {(selectedTemplate.default_trade_sections?.length ?? 0) > 6 && (
                            <p className="text-[10px] text-slate-600 mt-1">
                                +{(selectedTemplate.default_trade_sections?.length ?? 0) - 6} more
                            </p>
                        )}
                    </div>
                </div>

                <div className="bg-purple-950/20 border border-purple-900/40 rounded-2xl p-4 text-xs text-purple-300 leading-relaxed">
                    <strong className="block font-semibold text-purple-200 mb-1">
                        What happens next
                    </strong>
                    We create the project, seed the estimate with template line items, and
                    drop you into the Estimates tab. From there it&apos;s two clicks to the
                    branded PDF.
                </div>
            </aside>
        </div>
    );
}

// ── Shared form primitives ──────────────────────────────────────────────────

const inputCls =
    "w-full h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-600";

function Field({
    label,
    required,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {label}
                {required && <span className="text-purple-400 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}
