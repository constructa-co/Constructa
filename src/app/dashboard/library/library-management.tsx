"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Tag, Hash } from "lucide-react";

export type CostLibraryItem = {
    id: string;
    category: string;
    sub_category: string;
    item_code: string;
    short_name: string;
    description: string;
    unit: string;
    rate: number;
    is_system: boolean;
};

interface Props {
    items: CostLibraryItem[];
}

export default function LibraryManagement({ items }: Props) {
    const columns: ColumnDef<CostLibraryItem>[] = [
        {
            accessorKey: "category",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="px-0 hover:bg-transparent uppercase text-[10px] font-black tracking-widest"
                    >
                        Category
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => <div className="font-black text-blue-600 uppercase text-[10px] tracking-wider">{row.getValue("category")}</div>,
        },
        {
            accessorKey: "sub_category",
            header: "Sub-Category",
            cell: ({ row }) => <div className="font-bold text-slate-500 uppercase text-[9px] tracking-tight">{row.getValue("sub_category")}</div>,
        },
        {
            accessorKey: "item_code",
            header: "Code",
            cell: ({ row }) => <div className="font-mono text-[10px] text-slate-400">{row.getValue("item_code")}</div>,
        },
        {
            accessorKey: "short_name",
            header: "Item Name",
            cell: ({ row }) => <div className="font-semibold text-slate-900">{row.getValue("short_name")}</div>,
        },
        {
            accessorKey: "unit",
            header: "Unit",
            cell: ({ row }) => <div className="text-slate-500 text-[10px] uppercase font-bold">{row.getValue("unit")}</div>,
        },
        {
            accessorKey: "rate",
            header: ({ column }) => {
                return (
                    <div className="text-right">
                        <Button
                            variant="ghost"
                            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                            className="px-0 hover:bg-transparent uppercase text-[10px] font-black tracking-widest"
                        >
                            Rate (£)
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                )
            },
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("rate"))
                const formatted = new Intl.NumberFormat("en-GB", {
                    style: "currency",
                    currency: "GBP",
                }).format(amount)
                return <div className="text-right font-black italic text-blue-700">{formatted}</div>
            },
        },
    ];

    return (
        <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 mb-6 text-black">
                    <Tag className="w-5 h-5 text-blue-500" />
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Items Registry</h2>
                </div>
                <div className="text-black">
                    <DataTable columns={columns} data={items} searchKey="short_name" />
                </div>
            </div>

            {/* Lean MVP Premium Callout */}
            <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl relative p-8">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[120px] opacity-20 translate-x-1/2 -translate-y-1/2"></div>
                <div className="relative z-10 flex items-center gap-4">
                    <Hash className="w-8 h-8 text-blue-400" />
                    <div>
                        <h3 className="text-xl font-bold text-white uppercase tracking-tighter italic">Secured by RLS</h3>
                        <p className="text-slate-400 text-xs">Standard rates are managed centrally to ensure commercial consistency across your pipeline.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
