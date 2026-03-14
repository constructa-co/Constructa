"use client";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Trash2, Plus, Calculator, Save, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function EditableTable({ data, saveAction, resourceLibrary = [], globalLibrary = [] }: { data: any, saveAction: any, resourceLibrary?: any[], globalLibrary?: any[] }) {
    const [lines, setLines] = useState(data.draftLines || data.lineItems || []);
    const [markups, setMarkups] = useState(data.markups);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const netTotal = lines.reduce((sum: number, l: any) => sum + (l.qty * l.rate), 0);
    const totalCost = netTotal * (1 + (markups.overhead + markups.risk + markups.profit) / 100);

    const updateLine = (index: number, field: string, value: any) => {
        const newLines = [...lines];
        newLines[index] = { ...newLines[index], [field]: value };
        setLines(newLines);
    };

    const deleteLine = (index: number) => {
        setLines(lines.filter((_: any, i: number) => i !== index));
    };

    const addEmptyRow = () => {
        setLines([...lines, { desc: "New Item", unit: "item", qty: 1, rate: 0, total: 0 }]);
    };

    const addFromGlobalLibrary = (itemId: string) => {
        const item = globalLibrary.find(i => i.id === itemId);
        if (!item) return;
        setLines([...lines, {
            desc: item.description,
            unit: item.unit,
            qty: 1,
            rate: item.unit_cost,
            total: item.unit_cost
        }]);
    };

    const handleSubmit = (formData: FormData) => {
        setError(null);
        startTransition(async () => {
            try {
                await saveAction(formData);
            } catch (e: any) {
                setError(e.message || "An error occurred while saving.");
            }
        });
    };

    const groupedLibrary = globalLibrary.reduce((acc: any, item: any) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {});

    return (
        <Card className="border-slate-200 bg-white shadow-xl relative z-0 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row justify-between items-center px-6 py-4">
                <div className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-blue-600" />
                    <div>
                        <CardTitle className="text-lg font-bold text-slate-900 leading-tight">2. Review & Edit Draft</CardTitle>
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-0.5">Live Editable Mode</p>
                    </div>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 flex gap-1.5 items-center px-2 py-1 border-none font-bold">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
                    Interactive
                </Badge>
            </CardHeader>
            <CardContent className="p-0">
                <form action={handleSubmit}>
                    <input type="hidden" name="assemblyId" value={data.assemblyId} />
                    <input type="hidden" name="assemblyName" value={data.assemblyName} />
                    <input type="hidden" name="overhead" value={markups.overhead} />
                    <input type="hidden" name="risk" value={markups.risk} />
                    <input type="hidden" name="profit" value={markups.profit} />

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/30">
                                <TableRow>
                                    <TableHead className="w-auto pl-6 font-bold text-slate-400 text-[10px] uppercase tracking-wider">Description</TableHead>
                                    <TableHead className="w-20 text-center font-bold text-slate-400 text-[10px] uppercase tracking-wider">Unit</TableHead>
                                    <TableHead className="w-24 text-right font-bold text-slate-400 text-[10px] uppercase tracking-wider">Qty</TableHead>
                                    <TableHead className="w-24 text-right font-bold text-slate-400 text-[10px] uppercase tracking-wider">Rate (£)</TableHead>
                                    <TableHead className="w-24 text-right font-bold text-slate-400 text-[10px] uppercase tracking-wider">Total</TableHead>
                                    <TableHead className="w-12"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lines.map((l: any, i: number) => (
                                    <TableRow key={i} className="group hover:bg-slate-50/50 transition-colors border-slate-100">
                                        <TableCell className="pl-6 py-3">
                                            <Input
                                                name="desc"
                                                value={l.desc}
                                                onChange={e => updateLine(i, 'desc', e.target.value)}
                                                className="h-9 w-full border-none shadow-none bg-transparent hover:bg-white hover:border-slate-200 transition-all font-semibold text-slate-900 px-2 -ml-2"
                                                placeholder="Item description"
                                            />
                                            <input type="hidden" name="unit" value={l.unit} />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-none font-bold text-[10px] uppercase">
                                                {l.unit}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                name="qty"
                                                type="number" step="0.01"
                                                value={l.qty}
                                                onChange={e => updateLine(i, 'qty', parseFloat(e.target.value))}
                                                className="h-9 text-right border-none shadow-none bg-transparent hover:bg-white hover:border-slate-200 transition-all font-bold text-slate-700 font-mono"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                name="rate"
                                                type="number" step="0.01"
                                                value={l.rate}
                                                onChange={e => updateLine(i, 'rate', parseFloat(e.target.value))}
                                                className="h-9 text-right border-none shadow-none bg-transparent hover:bg-white hover:border-slate-200 transition-all font-bold text-slate-700 font-mono"
                                            />
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-slate-900 tabular-nums">
                                            £{(l.qty * l.rate).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="pr-4 text-center">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => deleteLine(i)}
                                                className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="p-4 border-t border-slate-100 bg-slate-50/30">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addEmptyRow}
                                    className="h-9 px-4 border-slate-200 text-slate-600 font-bold hover:bg-white shadow-sm"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Custom Row
                                </Button>

                                <Separator orientation="vertical" className="h-6 hidden md:block" />

                                <div className="flex items-center gap-2 flex-grow">
                                    <Select
                                        onValueChange={(value) => { if (value) addFromGlobalLibrary(value); }}
                                    >
                                        <SelectTrigger className="h-9 w-full md:w-[280px] bg-white border-slate-200 text-slate-500 font-medium">
                                            <div className="flex items-center gap-2">
                                                <Database className="w-3.5 h-3.5 text-blue-500" />
                                                <SelectValue placeholder="Add from Master Library..." />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {globalLibrary.length > 0 ? (
                                                Object.keys(groupedLibrary).map(category => (
                                                    <SelectGroup key={category}>
                                                        <SelectLabel className="text-blue-600 text-[10px] font-bold uppercase tracking-widest">{category}</SelectLabel>
                                                        {groupedLibrary[category].map((item: any) => (
                                                            <SelectItem key={item.id} value={item.id}>
                                                                <div className="flex justify-between items-center w-full min-w-[200px]">
                                                                    <span>{item.description}</span>
                                                                    <span className="ml-4 font-bold text-slate-400">£{item.unit_cost}/{item.unit}</span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                ))
                                            ) : (
                                                <SelectItem value="none" disabled>No library items found</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="text-right shrink-0 bg-white px-6 py-2 rounded-xl border border-slate-100 shadow-sm min-w-[120px]">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Net Total</div>
                                <div className="text-xl font-bold text-blue-900 tabular-nums">£{netTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 pt-2 bg-slate-50 shadow-inner">
                        <div className="flex items-center justify-between mb-4 px-1">
                            <div className="space-y-1">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Grand Project Total</div>
                                <div className="text-3xl font-black text-slate-900 tracking-tight flex items-baseline gap-2">
                                    £{totalCost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    <span className="text-sm font-medium text-slate-400 uppercase tracking-normal">GBP</span>
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <Badge className="bg-emerald-50 text-emerald-700 border-none px-2 py-0 font-bold mb-1">
                                    +{(markups.overhead + markups.risk + markups.profit)}% Markups
                                </Badge>
                                <div className="text-[10px] text-slate-400 font-medium">Incl. OH, Risk & Profit</div>
                            </div>
                        </div>

                        {error && (
                            <div className="mb-4 p-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                <span className="font-medium">{error}</span>
                            </div>
                        )}

                        <Button type="submit" disabled={isPending} className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-200/50 rounded-2xl font-black text-lg transition-all active:scale-[0.98] group">
                            {isPending ? (
                                "Saving to Project..."
                            ) : (
                                <div className="flex items-center justify-center gap-3">
                                    <Save className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                    Finalise & Save to Project
                                </div>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
