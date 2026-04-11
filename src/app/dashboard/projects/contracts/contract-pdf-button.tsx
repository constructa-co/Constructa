"use client";

/**
 * Constructa — Contract PDF Button
 * Uses shared pdf-utils for consistent branding.
 */

import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import {
    buildDocHeader,
    buildDocFooter,
    checkPageBreak,
    BRAND,
} from "@/lib/pdf/pdf-utils";

// Sprint 58 P3.3 — structural subset so the parent doesn't need to
// know about every domain field, but the common ones are type-checked.
interface ProjectLike {
    name?: string | null;
}

interface ProfileLike {
    company_name?: string | null;
    address_line1?: string | null;
    city?: string | null;
    postcode?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
}

interface Props {
    project: ProjectLike;
    contractText: string;
    profile?: ProfileLike;
}

export default function ContractPdfButton({ project, contractText, profile }: Props) {

    const generatePDF = async () => {
        const doc = new jsPDF();

        let y = buildDocHeader(doc, {
            documentTitle: "Construction Agreement",
            profile,
            rightBlockLines: [
                `Date: ${new Date().toLocaleDateString("en-GB")}`,
                `Project: ${project?.name || "N/A"}`,
            ],
        });

        y += 4;

        // Render contract text with serif font for legal look, with page breaks
        doc.setFont("times", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...BRAND.slate);

        const lines = doc.splitTextToSize(contractText || "No contract text found.", BRAND.contentW);
        lines.forEach((line: string) => {
            y = checkPageBreak(doc, y, 7);
            doc.text(line, BRAND.marginL, y);
            y += 6;
        });

        // Footers on all pages
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            buildDocFooter(doc, i, totalPages, "Constructa — Construction Agreement");
        }

        doc.save(`CONTRACT-${(project?.name || "Agreement").replace(/\s+/g, "_")}.pdf`);
    };

    return (
        <Button
            onClick={generatePDF}
            disabled={!contractText}
            variant="outline"
            className="border-slate-200 font-bold gap-2"
        >
            <FileDown className="w-4 h-4" />
            Download PDF
        </Button>
    );
}
