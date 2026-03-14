"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { calculateAction, saveToProjectAction } from "./actions";
import EditableTable from "./editable-table";
import * as XLSX from 'xlsx';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    FileText,
    Download,
    LayoutGrid,
    ArrowRight,
    Settings2,
    Package,
    Sparkles,
    CheckCircle2,
    Hammer
} from "lucide-react";
import { applyTemplateAction } from "../library/templates-actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner"; // Assuming sonner is used or we use simple feedback


import PdfGeneratorButton from "./pdf-generator";
import VisionTakeoff from "./vision-takeoff";

const exportToExcel = (estimates: any[]) => {
    // 1. Flatten the Data
    const rows: any[] = [];

    estimates.forEach(est => {
        // Add a Header Row for the Estimate
        rows.push({ Description: `--- ${est.version_name} ---`, Quantity: '', Rate: '', Total: '' });

        // Add Lines
        est.estimate_lines.forEach((l: any) => {
            rows.push({
                Description: l.description,
                Quantity: l.quantity,
                Unit: l.unit,
                Rate: l.unit_rate,
                Total: l.line_total,
                Type: l.mom_item_id ? 'Standard' : 'Custom' // Simple tag
            });
        });

        // Add Subtotal
        rows.push({ Description: 'SUBTOTAL', Total: est.total_cost });
        rows.push({}); // Empty row for spacing
    });

    // Add Grand Total
    const grandTotal = estimates.reduce((sum, e) => sum + e.total_cost, 0);
    rows.push({ Description: 'PROJECT TOTAL', Total: grandTotal });

    // 2. Create Sheet
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Estimate");

    // 3. Download
    XLSX.writeFile(workbook, "Constructa_Quote.xlsx");
};


export default function ClientEstimator({
    assemblies,
    savedEstimates,
    selectedAssembly,
    assemblyOptions,
    resultJson,
    resourceLibrary = [],
    globalLibrary = [],
    activeProject,
    dependencies = [],
    templates = [],
    approvedVariationsTotal
}: {
    assemblies: any[],
    savedEstimates: any[],
    selectedAssembly: any,
    assemblyOptions: any[],
    resultJson?: string,
    resourceLibrary?: any[],
    globalLibrary?: any[],
    activeProject?: any,
    dependencies?: any[],
    templates?: any[],
    approvedVariationsTotal?: number
}) {
    const router = useRouter();
    const [applyingKit, setApplyingKit] = useState<string | null>(null);

    // Parse initial result if present
    const initialResult = resultJson ? (() => {
        try { return JSON.parse(resultJson); } catch (e) { return null; }
    })() : null;

    const [draft, setDraft] = useState<any>(initialResult);

    // Update draft if URL result changes (e.g. after calculation)
    useEffect(() => {
        if (initialResult) setDraft(initialResult);
    }, [resultJson]);

    const requiredInputs = (selectedAssembly?.required_inputs as string[]) || [];

    const handleApplyKit = async (templateId: string) => {
        if (!activeProject) return;
        setApplyingKit(templateId);
        try {
            const result = await applyTemplateAction(templateId, activeProject.id);
            // We'll use a simple alert if toast isn't set up, but let's assume router.refresh() is enough for UX
            router.refresh();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setApplyingKit(null);
        }
    };

    const handleAddVisionItem = (item: any) => {
        const newItem = {
            costItemId: null,
            desc: item.description,
            unit: item.unit,
            qty: item.quantity,
            rate: item.unit_rate,
            total: item.quantity * item.unit_rate
        };

        if (draft) {
            setDraft({
                ...draft,
                draftLines: [...draft.draftLines, newItem]
            });
        } else {
            setDraft({
                assemblyId: "manual",
                assemblyName: "AI Takeoff Extract",
                draftLines: [newItem],
                markups: { overhead: 10, risk: 5, profit: 15 }
            });
        }
    };

    return (
        <div className="space-y-8 pb-20">
            {/* THE KIT SELECTOR & AI SCANNER */}
            <Card className="border-blue-200 bg-blue-50/30 overflow-hidden shadow-lg shadow-blue-100/20 mb-8">
                <CardHeader className="py-4 border-b border-blue-100 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Package className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-blue-900">Accelerate Pricing</CardTitle>
                                <p className="text-[10px] text-blue-500 font-bold uppercase tracking-tighter">Apply Kits or scan drawings with AI</p>
                            </div>
                        </div>

                        {templates && templates.length > 0 && (
                            <div className="flex items-center gap-3 border-l border-blue-100 pl-6">
                                <Select onValueChange={handleApplyKit}>
                                    <SelectTrigger className="w-[240px] bg-white border-blue-200">
                                        <SelectValue placeholder="Apply a Kit..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {templates.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <VisionTakeoff onAddItem={handleAddVisionItem} />
                        {applyingKit && <div className="flex items-center gap-2 text-xs text-blue-600 animate-pulse font-bold"><Sparkles className="w-3 h-3" /> Populating...</div>}
                    </div>
                </CardHeader>
            </Card>

            <div className="grid xl:grid-cols-12 gap-8 text-black">
                {/* 1. CALCULATOR FORM (Left - 4 cols) */}
                <div className="xl:col-span-4 space-y-6">
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-2 text-blue-600 mb-1">
                                <Settings2 className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Configuration</span>
                            </div>
                            <CardTitle className="text-xl">1. Input Dimensions</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="mb-6 space-y-2">
                                <Label className="text-slate-600 font-bold uppercase text-[10px] tracking-wider">Select Construction Task</Label>
                                <Select
                                    defaultValue={selectedAssembly?.id}
                                    onValueChange={(value) => { window.location.href = `?asm=${value}`; }}
                                >
                                    <SelectTrigger className="w-full h-11 bg-white border-slate-200">
                                        <SelectValue placeholder="Select an assembly" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {assemblies?.map(a => (
                                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <form action={async (fd) => {
                                const res = await calculateAction(fd);
                                window.location.href = `?asm=${selectedAssembly.id}&res=${encodeURIComponent(JSON.stringify(res))}`;
                            }}>
                                <input type="hidden" name="assemblyId" value={selectedAssembly?.id || ""} />

                                {/* Dimensions */}
                                <div className="space-y-5 mb-8">
                                    {requiredInputs.map(f => (
                                        <div key={f} className="space-y-2">
                                            <Label className="capitalize text-slate-700 font-semibold">{f.replace(/_/g, " ").replace(" m", "")} (m)</Label>
                                            <Input name={f} placeholder="0.00" type="number" step="0.01" required className="h-11 bg-white border-slate-200" />
                                        </div>
                                    ))}
                                </div>

                                {/* Options */}
                                {assemblyOptions && assemblyOptions.length > 0 && (
                                    <div className="mb-8 p-5 bg-blue-50/30 rounded-xl border border-blue-100/50 ring-1 ring-blue-50">
                                        <h3 className="text-xs font-bold text-blue-600 mb-4 uppercase tracking-widest flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                                            Task Add-ons
                                        </h3>
                                        <div className="space-y-4">
                                            {assemblyOptions.map(opt => (
                                                <div key={opt.id} className="flex items-center space-x-3 group cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        name={`opt_${opt.id}`}
                                                        id={`opt_${opt.id}`}
                                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                                                    />
                                                    <label htmlFor={`opt_${opt.id}`} className="text-sm font-medium text-slate-700 cursor-pointer group-hover:text-slate-900 transition-colors">
                                                        {opt.label}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-3 mb-8">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">OH %</Label>
                                        <Input name="overhead_pct" defaultValue="10" className="h-10 bg-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Risk %</Label>
                                        <Input name="risk_pct" defaultValue="5" className="h-10 bg-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Profit %</Label>
                                        <Input name="profit_pct" defaultValue="15" className="h-10 bg-white" />
                                    </div>
                                </div>

                                <Button type="submit" className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-lg shadow-blue-100 rounded-xl transition-all">
                                    Generate Draft Estimate
                                    <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* 2. EDITABLE TABLE (Middle - 5 cols) */}
                <div className="xl:col-span-5 space-y-6">
                    {draft ? (
                        <EditableTable data={draft} saveAction={saveToProjectAction} resourceLibrary={resourceLibrary || []} globalLibrary={globalLibrary || []} />
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 min-h-[400px]">
                            <div className="text-center">
                                <div className="text-4xl mb-2">📋</div>
                                <div>Enter dimensions to generate a draft.</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. PROJECT BASKET (Right - 3 cols) */}
                <div className="xl:col-span-3 space-y-4">
                    {savedEstimates.length > 0 && (
                        <div className="flex flex-col gap-6 mb-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xl overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-1 px-2 bg-slate-900 text-[8px] font-black text-white uppercase tracking-widest rounded-bl-lg">Financial Command</div>

                            <div className="flex items-center justify-between">
                                <h2 className="font-black text-sm uppercase tracking-widest text-slate-900 flex items-center gap-2">
                                    <LayoutGrid className="w-4 h-4 text-blue-600" />
                                    Project Totals
                                </h2>
                                <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 px-2 py-0 border text-[10px] uppercase font-black">
                                    {savedEstimates.length} Phased Items
                                </Badge>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-slate-400 uppercase tracking-tighter">Original Estimate</span>
                                    <span className="font-mono font-black text-slate-900">
                                        £{savedEstimates.reduce((sum, e) => sum + e.total_cost, 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-emerald-600 uppercase tracking-tighter flex items-center gap-1">
                                        <Hammer className="w-3 h-3" /> Approved Variations
                                    </span>
                                    <span className="font-mono font-black text-emerald-600">
                                        + £{(approvedVariationsTotal || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Revised Contract Sum</span>
                                    <span className="text-2xl font-black italic text-blue-600">
                                        £{(savedEstimates.reduce((sum, e) => sum + e.total_cost, 0) + (approvedVariationsTotal || 0)).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2 pt-2">
                                <Button variant="outline" className="h-10 text-xs font-black uppercase text-slate-600 border-slate-200 hover:bg-slate-50 flex-1 gap-2" onClick={() => exportToExcel(savedEstimates)}>
                                    <Download className="w-3.5 h-3.5" />
                                    Export CSV/Excel
                                </Button>
                                <PdfGeneratorButton estimates={savedEstimates} project={activeProject} dependencies={dependencies} />
                                {activeProject && (
                                    <Link href={`/dashboard/projects/costs?projectId=${activeProject.id}`} className="w-full">
                                        <Button className="w-full h-10 text-xs font-black uppercase bg-slate-900 hover:bg-black text-white rounded-lg gap-2">
                                            Open Cost Control
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        {savedEstimates.length === 0 && (
                            <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-2xl">
                                <div className="text-3xl mb-2 opacity-50">🛒</div>
                                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Basket Empty</h2>
                            </div>
                        )}
                        {savedEstimates.map(est => (
                            <Card key={est.id} className="text-sm shadow-sm border-slate-200 hover:border-blue-200 transition-colors group overflow-hidden">
                                <CardHeader className="py-3 px-4 bg-slate-50/50 border-b flex flex-row justify-between items-center group-hover:bg-blue-50/30 transition-colors">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <FileText className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
                                        <span className="font-bold text-slate-800 truncate">{est.version_name}</span>
                                    </div>
                                    <span className="font-bold text-blue-600 shrink-0 ml-2">£{est.total_cost.toFixed(2)}</span>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <ul className="space-y-2">
                                        {est.estimate_lines.slice(0, 3).map((l: any) => (
                                            <li key={l.id} className="flex justify-between text-[11px] text-slate-500 font-medium">
                                                <span className="truncate max-w-[140px]">{l.description}</span>
                                                <span className="text-slate-400">{l.quantity.toFixed(1)} {l.unit}</span>
                                            </li>
                                        ))}
                                        {est.estimate_lines.length > 3 && (
                                            <li className="text-[10px] text-center text-slate-400 italic pt-2 border-t border-slate-50 mt-2">
                                                + {est.estimate_lines.length - 3} more line items
                                            </li>
                                        )}
                                    </ul>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
