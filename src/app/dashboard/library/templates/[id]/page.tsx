import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, ArrowLeft, MoreHorizontal, PackageOpen } from "lucide-react";
import Link from "next/link";
import { removeTemplateItemAction } from "../../templates-actions";
import TemplateItemEditor from "./template-item-editor";

export default async function TemplateDetailsPage({ params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: template } = await supabase.from("templates").select("*").eq("id", params.id).single();
    const { data: items } = await supabase.from("template_items").select("*").eq("template_id", params.id).order("created_at", { ascending: true });
    const { data: libraryItems } = await supabase.from("library_items").select("*").order("category", { ascending: true });

    if (!template) return <div>Template not found.</div>;

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
                                <span className="bg-blue-100 text-blue-700 font-bold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-widest">{items?.length || 0} Items</span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {items && items.length > 0 ? (
                                <div className="divide-y divide-slate-100">
                                    {items.map((item) => (
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
                                                <form action={async () => {
                                                    "use server";
                                                    await removeTemplateItemAction(item.id, template.id);
                                                }}>
                                                    <Button variant="ghost" size="icon" className="text-slate-300 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </form>
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
                    <TemplateItemEditor
                        templateId={template.id}
                        libraryItems={libraryItems || []}
                    />
                </div>
            </div>
        </div>
    );
}
