"use client";

import { addLibraryItemAction, deleteLibraryItemAction } from "./actions";

// Inline UI Components
function Button({ children, className, variant, size }: { children: React.ReactNode; className?: string; variant?: 'default' | 'outline' | 'ghost'; size?: 'sm' | 'default' }) {
    const base = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
    const sizes = size === 'sm' ? "h-6 w-6 p-0 text-xs" : "h-10 px-4 py-2";
    const variants = {
        default: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
        outline: "border border-input hover:bg-accent hover:text-accent-foreground border-slate-200",
        ghost: "hover:bg-slate-100 text-slate-600 hover:text-slate-900"
    };
    const variantStyle = variants[variant || 'default'];

    return <button className={`${base} ${sizes} ${variantStyle} ${className}`}>{children}</button>;
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-slate-200 bg-white ${props.className}`}
        />
    );
}

interface Props {
    data: any[];
    type: "Labour" | "Material" | "Plant"; // <--- Added Plant
}

export default function LibraryTable({ data, type }: Props) {
    // Dynamic placeholder based on type
    const placeholderName =
        type === 'Labour' ? 'Senior Joiner' :
            type === 'Plant' ? '1.5T Excavator' :
                'C24 Timber';

    const placeholderUnit =
        type === 'Labour' ? 'hour' :
            type === 'Plant' ? 'day' :
                'm';

    return (
        <div className="space-y-6">
            {/* ADD NEW ITEM FORM */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h3 className="text-sm font-bold uppercase text-slate-500 mb-4">Add New {type} Rate</h3>
                <form action={addLibraryItemAction} className="flex gap-4 items-end">
                    <input type="hidden" name="type" value={type} />

                    <div className="flex-1 space-y-1">
                        <label className="text-xs font-medium text-slate-700">Description</label>
                        <Input name="name" placeholder={`e.g. ${placeholderName}`} required className="h-9" />
                    </div>

                    <div className="w-24 space-y-1">
                        <label className="text-xs font-medium text-slate-700">Unit</label>
                        <Input name="unit" placeholder={placeholderUnit} required className="h-9" />
                    </div>

                    <div className="w-32 space-y-1">
                        <label className="text-xs font-medium text-slate-700">Rate (£)</label>
                        <Input name="rate" type="number" step="0.01" placeholder="0.00" required className="h-9" />
                    </div>

                    <Button className="h-9 px-4 w-auto">Add Item</Button>
                </form>
            </div>

            {/* DATA TABLE */}
            <div className="border border-slate-200 rounded-md overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3">Unit</th>
                            <th className="px-4 py-3 text-right">Rate (£)</th>
                            <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                                <td className="px-4 py-3 text-slate-500">{item.unit}</td>
                                <td className="px-4 py-3 text-right font-mono text-slate-700">£{item.rate.toFixed(2)}</td>
                                <td className="px-4 py-3 text-right">
                                    <form action={deleteLibraryItemAction}>
                                        <input type="hidden" name="id" value={item.id} />
                                        <Button variant="ghost" size="sm" className="h-8 w-8 text-slate-400 hover:text-red-600">×</Button>
                                    </form>
                                </td>
                            </tr>
                        ))}
                        {data.length === 0 && (
                            <tr><td colSpan={4} className="p-8 text-center text-slate-400">No items found. Add one above.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
