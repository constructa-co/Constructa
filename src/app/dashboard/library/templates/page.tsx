import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, LayoutGrid, ArrowRight } from "lucide-react";
import Link from "next/link";
import CreateKitForm from "./create-kit-form";

type TemplateRow = {
    id: string;
    name: string;
    description: string | null;
};

export default async function TemplatesPage() {
    const supabase = await createClient();
    let templates: TemplateRow[] | null = null;
    let listLoadFailed = false;
    let listLoadDetail: string | null = null;

    try {
        const { data, error } = await supabase.from("templates").select("*").order("created_at", { ascending: false });
        if (error) {
            listLoadFailed = true;
            listLoadDetail = error.message || "Unknown error";
        } else {
            templates = (data ?? []) as TemplateRow[];
        }
    } catch (error) {
        listLoadFailed = true;
        listLoadDetail = error instanceof Error ? (error.message || "Unknown error") : "Unknown error";
    }

    return (
        <div className="space-y-8 pb-20 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Kits & Templates</h1>
                    <p className="text-slate-500 mt-1">Group your standard rates into reusable assembly kits.</p>
                </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer group flex flex-col items-center justify-center p-8 h-full min-h-[240px]">
                    <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                        <Plus className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="mt-4 font-bold text-slate-900 text-lg">Create New Kit</h3>
                    <p className="text-slate-400 text-sm mt-1 text-center">Start a fresh assembly recipe</p>
                    <CreateKitForm />
                </Card>

                {listLoadFailed ? (
                    <Card className="md:col-span-1 lg:col-span-2 border-red-200 bg-red-50/40 flex flex-col justify-center p-8 min-h-[240px]">
                        <CardHeader className="p-0">
                            <CardTitle className="text-lg text-slate-900">Saved kits unavailable</CardTitle>
                            <CardDescription className="text-sm text-slate-700 leading-relaxed mt-2">
                                <span role="alert">
                                    Could not load your saved kits. Refresh this page to check whether kits were saved before you try again.
                                    {listLoadDetail ? ` (${listLoadDetail})` : null}
                                </span>
                            </CardDescription>
                        </CardHeader>
                    </Card>
                ) : (
                    templates?.map((template) => (
                        <Card key={template.id} className="border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group">
                            <CardHeader className="pb-4">
                                <div className="flex justify-between items-start">
                                    <div className="p-2 bg-blue-50 rounded-lg">
                                        <LayoutGrid className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div className="flex gap-2" />
                                </div>
                                <CardTitle className="mt-4 text-xl">{template.name}</CardTitle>
                                <CardDescription className="line-clamp-2">{template.description || "No description provided."}</CardDescription>
                            </CardHeader>
                            <CardContent className="mt-auto pt-0">
                                <Link href={`./templates/${template.id}`} className="inline-flex items-center justify-center w-full h-11 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 gap-2 transition-all">
                                    Edit Recipe
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
