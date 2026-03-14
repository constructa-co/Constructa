"use client";

import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

interface Props {
    project: any;
    contractText: string;
    profile?: any;
}

export default function ContractPdfButton({ project, contractText, profile }: Props) {

    const generatePDF = async () => {
        const doc = new jsPDF();
        let currentY = 25;

        // --- HEADER ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42);
        doc.text(profile?.company_name || "CONSTRUCTA", 14, currentY);

        currentY += 15;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text("CONSTRUCTION AGREEMENT", 14, currentY);

        currentY += 10;
        doc.setDrawColor(226, 232, 240);
        doc.line(14, currentY, 196, currentY);

        // --- CONTENT ---
        currentY += 15;
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("Project: " + (project?.name || "Ref: Agreement"), 14, currentY);

        currentY += 10;
        doc.setFontSize(10);
        doc.setFont("times", "normal"); // Using serif font for legal look
        doc.setTextColor(30, 41, 59);

        const splitText = doc.splitTextToSize(contractText || "No contract text found.", 180);

        // Loop through lines and handle page breaks
        splitText.forEach((line: string) => {
            if (currentY > 275) {
                doc.addPage();
                currentY = 25;
            }
            doc.text(line, 14, currentY);
            currentY += 6;
        });

        doc.save(`CONTRACT-${project?.name.replace(/\s+/g, '_')}.pdf`);
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
