import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, PackageOpen } from "lucide-react";
import Link from "next/link";
import TemplateItemEditor from "./template-item-editor";
import { TemplateKitItemRemove } from "./template-kit-item-remove";

function isConfirmedTemplateNotFound(error: { code?: string } | null) {
    return error?.code === "PGRST116";
}

function KitLoadUnavailable({ title, detail, reloadHref }: { title: string; detail: string; reloadHref: string }) {
    return (
        <div className="space-y-4 py-16 px-6 max-w-lg mx-auto text-center">
            <h1 className="text-xl font-bold text-slate-900">{title}</h1>
            <p className="text-sm text-slate-600 leading-relaxed">{detail}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Link href="/dashboard/library/templates" className="text-sm font-semibold text-blue-600 hover:underline">
                    Back to kits
                </Link>
                <Link href={reloadHref} className="text-sm text-slate-500 hover:underline">
                    Try loading this kit again
                </Link>
            </div>
        </div>
    );
}

export default async function TemplateDetailsPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const supabase = await createClient();
    const { data: template, error: templateError } = await supabase.from("templates").select("*").eq("id", params.id).single();
    const { data: items, error: itemsError } = await supabase.from("template_items").select("*").eq("template_id", params.id).order("created_at", { ascending: true });
    const { data: libraryItems, error: libraryError } = await supabase.from("library_items").select("*").order("category", { ascending: true });

    if (templateError || !template) {
        if (templateError && !isConfirmedTemplateNotFound(templateError)) {
            return (
                <KitLoadUnavailable
                    title="Could not load this kit"
                    detail="The kit details could not be loaded right now. Go back to your kits list or try loading this kit again."
                    reloadHref={`/dashboard/library/templates/${params.id}`}
                />
            );
        }
        return <div>Template not found.</div>;
    }

    const itemsLoadOk = !itemsError;
    const libraryLoadOk = !libraryError;
    const kitItems = itemsLoadOk ? (items ?? []) : [];

    return (
        <div className="space-y-8 pb-20 max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/library/templates" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6 text-slate-400 font-bold" />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">{template.name}</h1>
                    <p className="text-slate-500 mt-1">Configure the items for this assembly kit.</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-8 space-y-6">
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">Kit Items</CardTitle>
                                <span className="bg-blue-100 text-blue-700 font-bold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-widest">
                                    {itemsLoadOk ? `${kitItems.length} Items` : "Unavailable"}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {!itemsLoadOk ? (
                                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                                    <h3 className="text-lg font-bold text-slate-900">Could not load kit items</h3>
                                    <p className="text-sm text-slate-500 mt-2 max-w-sm">
                                        The item list for this kit is unavailable. Refresh this page to check whether items were added before you try again.
                                    </p>
                                </div>
                            ) : kitItems.length > 0 ? (
                                <div className="divide-y divide-slate-100">
                                    {kitItems.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors group">
                                            <div className="flex-grow">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{item.category}</span>
                                                    <span className="text-slate-300 text-xs">•</span>
                                                    <span className="text-xs text-slate-500 font-medium">Qty: {item.quantity} {item.unit}</span>
                                                </div>
                                                <p className="text-slate-900 font-semibold mt-0.5">{item.description}</p>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-slate-900">£{item.unit_cost.toFixed(2)}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium uppercase">Unit Rate</p>
                                                </div>
                                                <TemplateKitItemRemove itemId={item.id} templateId={template.id} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                                    <div className="p-4 bg-slate-50 rounded-full mb-4">
                                        <PackageOpen className="w-10 h-10 text-slate-300" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900">This kit is empty</h3>
                                    <p className="text-sm text-slate-500 mt-2 max-w-xs">Start adding items from your library to build this assembly.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-4">
                    {libraryLoadOk ? (
                        <TemplateItemEditor
                            templateId={template.id}
                            libraryItems={libraryItems ?? []}
                        />
                    ) : (
                        <Card className="border-slate-200 shadow-xl bg-slate-50/30 sticky top-8">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Pick from Library</CardTitle>
                                <CardDescription>Library registry could not be loaded. Refresh this page before picking items.</CardDescription>
                            </CardHeader>
                            <CardContent />
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
