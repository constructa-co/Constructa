import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, LayoutGrid, Trash2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { createTemplateAction } from "../templates-actions";

export default async function TemplatesPage() {
    const supabase = createClient();
    const { data: templates } = await supabase.from("templates").select("*").order("created_at", { ascending: false });

    return (
        <div className="space-y-8 pb-20 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Kits & Templates</h1>
                    <p className="text-slate-500 mt-1">Group your standard rates into reusable assembly kits.</p>
                </div>
                {/* Create Template Dialog would go here, using a simple form for now for speed */}
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Create New Kit Card */}
                <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer group flex flex-col items-center justify-center p-8 h-full min-h-[240px]">
                    <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                        <Plus className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="mt-4 font-bold text-slate-900 text-lg">Create New Kit</h3>
                    <p className="text-slate-400 text-sm mt-1 text-center">Start a fresh assembly recipe</p>
                    <form action={createTemplateAction} className="mt-6 w-full space-y-3">
                        <input name="name" placeholder="e.g. Groundworks" required className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <Button type="submit" className="w-full bg-slate-900 hover:bg-black text-white rounded-lg">Initialize Kit</Button>
                    </form>
                </Card>

                {templates?.map((template) => (
                    <Card key={template.id} className="border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group">
                        <CardHeader className="pb-4">
                            <div className="flex justify-between items-start">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <LayoutGrid className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="flex gap-2">
                                    {/* Delete button logic would be here */}
                                </div>
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
                ))}
            </div>
        </div>
    );
}
