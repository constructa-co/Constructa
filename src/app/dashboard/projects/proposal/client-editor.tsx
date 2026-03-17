"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Save, FileText, AlertCircle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { saveProposalAction, generateAiScopeAction } from "./actions";


interface Props {
    projectId: string;
    initialScope: string;
    initialExclusions: string;
    initialClarifications: string;
}

export default function ClientEditor({ projectId, initialScope, initialExclusions, initialClarifications }: Props) {
    const [scope, setScope] = useState(initialScope);
    const [exclusions, setExclusions] = useState(initialExclusions);
    const [clarifications, setClarifications] = useState(initialClarifications);
    const [generating, setGenerating] = useState(false);

    const handleAutoWrite = async () => {
        setGenerating(true);
        const result = await generateAiScopeAction(projectId);
        // Populate all three fields from the structured AI response
        if (typeof result === 'object' && result.scope_narrative) {
            setScope((prev: string) => prev + (prev ? "\n\n" : "") + result.scope_narrative);
            if (result.suggested_exclusions) {
                setExclusions((prev: string) => prev + (prev ? "\n" : "") + result.suggested_exclusions);
            }
            if (result.suggested_clarifications) {
                setClarifications((prev: string) => prev + (prev ? "\n" : "") + result.suggested_clarifications);
            }
        } else {
            // Fallback for plain string (error messages)
            setScope((prev: string) => prev + (prev ? "\n\n" : "") + String(result));
        }
        setGenerating(false);
    };

    return (
        <form action={async (fd) => { await saveProposalAction(fd); }} className="space-y-8 pb-20">
            <input type="hidden" name="projectId" value={projectId} />

            <div className="grid lg:grid-cols-12 gap-8 items-start">
                {/* LEFT COL: MAIN EDITOR */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    <Card className="border-slate-200 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
                        <CardHeader className="bg-slate-50/50 border-b flex flex-row justify-between items-center px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <FileText className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Scope of Works</CardTitle>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Primary Project Narrative</p>
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleAutoWrite}
                                disabled={generating}
                                className="h-9 px-4 border-purple-200 bg-purple-50/50 text-purple-700 hover:bg-purple-100 shadow-sm font-bold gap-2 group transition-all"
                            >
                                <Sparkles className={`w-4 h-4 transition-transform ${generating ? 'animate-spin' : 'group-hover:scale-110'}`} />
                                {generating ? "AI is Writing..." : "Draft with AI"}
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 flex flex-col">
                            <Textarea
                                name="scope"
                                value={scope}
                                onChange={(e) => setScope(e.target.value)}
                                className="flex-1 w-full p-8 border-none focus-visible:ring-0 shadow-none font-serif text-lg leading-relaxed resize-none min-h-[500px] text-slate-800 placeholder:text-slate-300 transition-colors"
                                placeholder="Describe the physical works to be carried out. Use the AI button to generate a first draft based on your bill of quantities..."
                            />
                        </CardContent>
                    </Card>
                </div>

                {/* RIGHT COL: SIDEBAR / FINE PRINT */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="border-slate-200 shadow-lg">
                        <CardHeader className="py-4 px-6 bg-slate-50/50 border-b">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-orange-500" />
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Exclusions</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Textarea
                                name="exclusions"
                                value={exclusions}
                                onChange={(e) => setExclusions(e.target.value)}
                                className="w-full p-4 text-sm border-none focus-visible:ring-0 shadow-none min-h-[180px] text-slate-700 bg-white"
                                placeholder="List what ISN'T included (e.g. Planning fees, Floor finishes, VAT)..."
                            />
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 shadow-lg">
                        <CardHeader className="py-4 px-6 bg-slate-50/50 border-b">
                            <div className="flex items-center gap-2">
                                <Info className="w-4 h-4 text-blue-500" />
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Clarifications</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Textarea
                                name="clarifications"
                                value={clarifications}
                                onChange={(e) => setClarifications(e.target.value)}
                                className="w-full p-4 text-sm border-none focus-visible:ring-0 shadow-none min-h-[180px] text-slate-700 bg-white"
                                placeholder="Any assumptions made (e.g. Standard working hours, Water/Power provided by client)..."
                            />
                        </CardContent>
                    </Card>

                    <Button type="submit" className="w-full h-14 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-lg shadow-xl shadow-slate-200/50 transition-all active:scale-[0.98] gap-3">
                        <Save className="w-6 h-6" />
                        Save Proposal Changes
                    </Button>
                </div>
            </div>
        </form>
    );
}
