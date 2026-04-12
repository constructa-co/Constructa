"use client";

import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { buildProposalPDF, type BuildProposalPDFProps } from "@/lib/pdf/build-proposal-doc";

interface Props {
    estimates: any[];
    project: any;
    profile: any;
    pricingMode: "full" | "summary";
    validityDays: number;
}

export default function ProposalPdfButton({ estimates, project, profile, pricingMode, validityDays }: Props) {
    const [generating, setGenerating] = useState(false);

    const generatePDF = async () => {
        setGenerating(true);
        try {
            // Fetch fresh profile so pdf_theme reflects current saved value
            const supabase = createClient();
            const { data: freshProfile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", profile?.id)
                .single();
            const effectiveProfile = freshProfile ?? profile;
            await buildProposalPDF({ estimates, project, profile: effectiveProfile, pricingMode, validityDays });
            toast.success("PDF generated successfully");
        } catch (err) {
            console.error("[PDF Generation Error]", err);
            toast.error(
                err instanceof Error
                    ? `PDF generation failed: ${err.message}`
                    : "PDF generation failed — check the console for details"
            );
        } finally {
            setGenerating(false);
        }
    };

    return (
        <Button
            onClick={generatePDF}
            disabled={generating}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow-lg h-12 px-6 w-full text-sm"
        >
            {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <FileDown className="w-4 h-4" />
            )}
            {generating ? "Generating PDF..." : "Generate PDF"}
        </Button>
    );
}
