"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Upload, Loader2, CheckCircle2, AlertCircle, FileImage, Plus } from "lucide-react";
import { analyzeDrawingAction } from "./vision-actions";
import type { VisionResultItem } from "./vision-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function VisionTakeoff({ onAddItem }: { onAddItem: (item: any) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [results, setResults] = useState<VisionResultItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        setResults([]);

        // Show preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);

        setIsAnalyzing(true);

        try {
            // Convert to base64 for server action
            const base64 = await new Promise<string>((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result as string);
                r.onerror = reject;
                r.readAsDataURL(file);
            });

            const aiResults = await analyzeDrawingAction(base64);
            setResults(aiResults);
        } catch (err: any) {
            setError(err.message || "Failed to analyze image. Please try again.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50 font-bold gap-2 shadow-sm transition-all hover:shadow-md">
                    <Sparkles className="w-4 h-4" />
                    Scan Drawing (AI)
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        AI Vision Takeoff
                    </DialogTitle>
                    <DialogDescription>
                        Upload a floor plan, site drawing, or napkin sketch. AI will extract quantities and match them to your cost library.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {!preview ? (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-12 bg-slate-50 gap-4 transition-colors hover:bg-slate-100/50">
                            <div className="p-4 bg-white rounded-full shadow-md border border-slate-100">
                                <FileImage className="w-10 h-10 text-purple-500" />
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-slate-700">Drop your plan here</p>
                                <p className="text-sm text-slate-400 mt-1">PNG, JPG, or WebP</p>
                            </div>
                            <Input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                id="vision-upload"
                                onChange={handleFileUpload}
                                disabled={isAnalyzing}
                            />
                            <Button asChild variant="secondary" className="font-bold h-11 px-8 rounded-xl shadow-sm">
                                <label htmlFor="vision-upload" className="cursor-pointer">
                                    Select Drawing
                                </label>
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={preview} alt="Plan Preview" className="object-contain w-full h-full" />
                                {isAnalyzing && (
                                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                                        <div className="relative">
                                            <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
                                            <Sparkles className="w-4 h-4 text-purple-400 absolute top-0 right-0 animate-pulse" />
                                        </div>
                                        <p className="font-bold text-purple-900 animate-pulse tracking-tight">AI is Reading Plan...</p>
                                    </div>
                                )}
                            </div>

                            {results.length > 0 && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                            Takeoff Results
                                        </h3>
                                        <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">{results.length} Found</span>
                                    </div>
                                    <div className="border rounded-xl overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-slate-50">
                                                <TableRow>
                                                    <TableHead className="font-bold uppercase tracking-tighter text-[10px]">Item</TableHead>
                                                    <TableHead className="text-right font-bold uppercase tracking-tighter text-[10px]">Qty</TableHead>
                                                    <TableHead className="font-bold uppercase tracking-tighter text-[10px]">Unit</TableHead>
                                                    <TableHead className="text-right font-bold uppercase tracking-tighter text-[10px]">Rate</TableHead>
                                                    <TableHead className="text-right font-bold uppercase tracking-tighter text-[10px]">Total</TableHead>
                                                    <TableHead className="w-[80px]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {results.map((item, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="font-medium text-slate-700">
                                                            {item.item_name}
                                                            {item.library_match && (
                                                                <div className="text-xs text-green-600">Matched: {item.library_match}</div>
                                                            )}
                                                            {!item.library_match && (
                                                                <div className="text-xs text-amber-500">No match — rate set to {"\u00A3"}0</div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-slate-900">{item.estimated_quantity}</TableCell>
                                                        <TableCell className="text-slate-600">{item.unit || "nr"}</TableCell>
                                                        <TableCell className="text-right text-slate-700">{"\u00A3"}{(item.suggested_rate || 0).toFixed(2)}</TableCell>
                                                        <TableCell className="text-right font-bold text-slate-900">
                                                            {"\u00A3"}{((item.estimated_quantity || 0) * (item.suggested_rate || 0)).toFixed(2)}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1 rounded-lg"
                                                                onClick={() => onAddItem({
                                                                    description: item.item_name,
                                                                    quantity: item.estimated_quantity,
                                                                    unit: item.unit || "nr",
                                                                    unit_rate: item.suggested_rate || 0,
                                                                })}
                                                            >
                                                                <Plus className="w-3 h-3" />
                                                                Add
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Add all button */}
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => results.forEach(item => onAddItem({
                                                description: item.item_name,
                                                quantity: item.estimated_quantity,
                                                unit: item.unit || "nr",
                                                unit_rate: item.suggested_rate || 0,
                                            }))}
                                            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700"
                                        >
                                            Add All {results.length} Items to BoQ
                                        </button>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-800">
                                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                    <div className="text-sm">
                                        <p className="font-bold">Extraction Failed</p>
                                        <p className="opacity-90">{error}</p>
                                    </div>
                                </div>
                            )}

                            {!isAnalyzing && (
                                <Button
                                    variant="outline"
                                    className="w-full h-11 rounded-xl text-slate-400 font-bold border-slate-200 hover:bg-slate-50"
                                    onClick={() => {
                                        setPreview(null);
                                        setResults([]);
                                        setError(null);
                                    }}
                                >
                                    Upload Different Drawing
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsOpen(false)}>
                        {results.length > 0 ? "Done" : "Cancel"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
