"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Sparkles, Loader2, Save, Download, Gavel } from "lucide-react";
import { generateContractAction, saveContractAction } from "./actions";
import { toast } from "sonner";
import ContractPdfButton from "./contract-pdf-button";

interface Props {
    projectId: string;
    initialContract: string;
    projectName: string;
    project: any;
    profile?: any;
}

export default function ClientContractEditor({ projectId, initialContract, projectName, project, profile }: Props) {
    const [contract, setContract] = useState(initialContract);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const text = await generateContractAction(projectId);
            setContract(text);
            toast.success("Contract generated successfully!");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveContractAction(projectId, contract);
            toast.success("Contract saved!");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex-1 overflow-hidden flex flex-col gap-6">
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <Gavel className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Contract Lifecycle</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Draft, Edit, and Formalize</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold gap-2"
                    >
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Generate with AI
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="border-slate-200 font-bold gap-2"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </Button>
                    <ContractPdfButton project={project} contractText={contract} profile={profile} />
                </div>
            </div>

            <Card className="flex-1 flex flex-col overflow-hidden border-slate-200 shadow-lg">
                <CardHeader className="border-b bg-slate-50/50 py-4 px-6 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2 italic">
                        <FileText className="w-5 h-5 text-slate-400" />
                        Formal Agreement Draft
                    </CardTitle>
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest border border-slate-200 px-2 py-1 rounded">
                        UK Standard Form
                    </div>
                </CardHeader>
                <CardContent className="flex-1 p-0">
                    <Textarea
                        value={contract}
                        onChange={(e) => setContract(e.target.value)}
                        placeholder="Generate a contract using the AI tool above to begin..."
                        className="w-full h-full min-h-[500px] border-none focus-visible:ring-0 text-md leading-relaxed p-8 font-serif bg-slate-50/30"
                    />
                </CardContent>
            </Card>
        </div>
    );
}
