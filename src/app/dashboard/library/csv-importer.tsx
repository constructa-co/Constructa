"use client";

import { useState } from "react";
import Papa from "papaparse";
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
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { bulkAddMoMItemsAction } from "./actions";
import { useRouter } from "next/navigation";

export default function CSVImporter() {
    const [isOpen, setIsOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);
    const router = useRouter();

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setResult(null);
        setIsUploading(true);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const data = results.data as any[];

                // Mapping: Level 1 Category, Level 2 Category, Item Code, Description, Unit, Rate
                const itemsToInsert = data.map(row => {
                    const l1 = row['Level 1 Category'] || row['Level 1'] || row['L1'];
                    const l2 = row['Level 2 Category'] || row['Level 2'] || row['L2'];
                    const code = row['Item Code'] || row['Code'];
                    const description = row.Description || row.description;
                    const unit = row.Unit || row.unit;
                    const rate = row.Rate || row.rate || row['Unit Cost'];

                    return {
                        levels: [l1, l2].filter(Boolean),
                        code: code?.trim(),
                        description: description?.trim(),
                        unit: unit?.trim(),
                        rate: parseFloat(rate) || 0
                    };
                }).filter(item => item.levels.length > 0 && item.description);

                if (itemsToInsert.length === 0) {
                    setResult({ success: false, message: "No valid items found. Headers: Level 1 Category, Level 2 Category, Item Code, Description, Unit, Rate." });
                    setIsUploading(false);
                    return;
                }

                try {
                    const response = await bulkAddMoMItemsAction(itemsToInsert);
                    setResult({ success: true, message: `Successfully imported ${response.count} items`, count: response.count });
                    router.refresh();
                } catch (error: any) {
                    setResult({ success: false, message: error.message || "Failed to upload items." });
                } finally {
                    setIsUploading(false);
                }
            },
            error: (error) => {
                setResult({ success: false, message: "Failed to parse CSV: " + error.message });
                setIsUploading(false);
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50 font-bold gap-2">
                    <Upload className="w-4 h-4" />
                    Import CSV
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Bulk Import Library Items</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file to add multiple rates to your library at once.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-8 bg-slate-50 gap-4 transition-colors hover:bg-slate-100/50">
                        <div className="p-3 bg-white rounded-full shadow-sm border border-slate-100">
                            <FileSpreadsheet className="w-8 h-8 text-blue-500" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold text-slate-700">Choose a MoM CSV file</p>
                            <p className="text-[10px] text-slate-400 mt-1 leading-tight">Headers: Level 1 Category, Level 2 Category, Item Code, Description, Unit, Rate</p>
                        </div>
                        <Input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            id="csv-upload"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                        />
                        <Button
                            asChild
                            variant="secondary"
                            className="h-9 px-6 font-bold"
                            disabled={isUploading}
                        >
                            <label htmlFor="csv-upload" className="cursor-pointer">
                                {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                {isUploading ? "Uploading..." : "Select File"}
                            </label>
                        </Button>
                    </div>

                    {result && (
                        <div className={`p-4 rounded-lg flex items-start gap-3 ${result.success ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-red-50 text-red-800 border border-red-100"}`}>
                            {result.success ? <CheckCircle2 className="w-5 h-5 mt-0.5" /> : <AlertCircle className="w-5 h-5 mt-0.5" />}
                            <div>
                                <p className="font-bold text-sm">{result.success ? "Success!" : "Import Error"}</p>
                                <p className="text-xs opacity-90">{result.message} {result.count ? `(${result.count} items)` : ""}</p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isUploading}>
                        {result?.success ? "Close" : "Cancel"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
