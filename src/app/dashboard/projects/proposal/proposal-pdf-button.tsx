"use client";

import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

interface Props {
    estimates: any[];
    project: any;
    profile?: any;
}

export default function ProposalPdfButton({ estimates, project, profile }: Props) {

    const generatePDF = async () => {
        const doc = new jsPDF();
        let currentY = 25;

        const checkPageBreak = (y: number, heightNeeded: number) => {
            if (y + heightNeeded > 275) {
                doc.addPage();
                return 25;
            }
            return y;
        };

        // --- PAGE 1: COVER PAGE ---
        // Header / Logo
        doc.setFont("helvetica", "bold");
        doc.setFontSize(28);
        doc.setTextColor(15, 23, 42); // Slate-900
        doc.text(profile?.company_name || "CONSTRUCTA", 14, currentY);

        doc.setDrawColor(30, 64, 175); // Blue-800
        doc.setLineWidth(1.5);
        doc.line(14, currentY + 4, 40, currentY + 4);

        currentY += 40;
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100);
        doc.text("FORMAL PROPOSAL & CONTRACT", 14, currentY);

        currentY += 15;
        doc.setFontSize(36);
        doc.setTextColor(15, 23, 42);
        const titleLines = doc.splitTextToSize(project?.name || "Project Proposal", 180);
        doc.text(titleLines, 14, currentY);
        currentY += (titleLines.length * 12);

        currentY += 20;
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text("PREPARED FOR:", 14, currentY);

        currentY += 8;
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(project?.client_name || "Valued Client", 14, currentY);

        currentY += 25;
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text("DATE ISSUED:", 14, currentY);
        doc.text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), 14, currentY + 8);

        // --- PAGE 2: EXECUTIVE SUMMARY ---
        doc.addPage();
        currentY = 25;

        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("1. Scope of Works", 14, currentY);

        currentY += 15;
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50);
        const scopeText = project.scope_text || "No scope provided.";
        const splitScope = doc.splitTextToSize(scopeText, 180);
        doc.text(splitScope, 14, currentY, { lineHeightFactor: 1.5 });
        currentY += (splitScope.length * 7) + 20;

        // --- PAGE 3: FINANCIALS ---
        currentY = checkPageBreak(currentY, 60);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("2. Investment Summary", 14, currentY);

        currentY += 15;

        const grandTotal = estimates.reduce((sum, est) => {
            const markup = 1 + ((est.profit_pct || 0) + (est.overhead_pct || 0) + (est.risk_pct || 0)) / 100;
            return sum + (est.total_cost * markup);
        }, 0);

        estimates.forEach((est, idx) => {
            const markup = 1 + ((est.profit_pct || 0) + (est.overhead_pct || 0) + (est.risk_pct || 0)) / 100;
            const total = est.total_cost * markup;

            currentY = checkPageBreak(currentY, 30);

            doc.setFillColor(248, 250, 252); // Slate-50
            doc.rect(14, currentY - 6, 180, 10, 'F');

            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(30, 41, 59);
            doc.text(`${idx + 1}. ${est.version_name}`, 18, currentY);
            doc.text(`£${total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, 190, currentY, { align: 'right' });

            currentY += 10;

            if (est.estimate_lines) {
                est.estimate_lines.forEach((line: any) => {
                    currentY = checkPageBreak(currentY, 10);
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(9);
                    doc.setTextColor(100);
                    doc.text(`• ${line.description}`, 22, currentY);
                    doc.text(`${line.quantity} ${line.unit}`, 150, currentY);
                    currentY += 6;
                });
            }
            currentY += 10;
        });

        currentY = checkPageBreak(currentY, 30);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(14, currentY, 194, currentY);
        currentY += 15;

        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("Total Contract Sum (Excl. VAT)", 14, currentY);
        doc.text(`£${grandTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, 190, currentY, { align: 'right' });

        // --- PAGE 4: FINE PRINT & SIGNATURES ---
        doc.addPage();
        currentY = 25;

        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("3. Terms & Conditions", 14, currentY);

        currentY += 15;
        if (project.clarifications_text) {
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text("CLARIFICATIONS & ASSUMPTIONS", 14, currentY);
            currentY += 8;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            const lines = doc.splitTextToSize(project.clarifications_text, 180);
            doc.text(lines, 14, currentY);
            currentY += (lines.length * 6) + 15;
        }

        if (project.exclusions_text) {
            currentY = checkPageBreak(currentY, 30);
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text("EXCLUSIONS", 14, currentY);
            currentY += 8;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            const lines = doc.splitTextToSize(project.exclusions_text, 180);
            doc.text(lines, 14, currentY);
            currentY += (lines.length * 6) + 20;
        }

        currentY = checkPageBreak(currentY, 60);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("ACCEPTANCE", 14, currentY);
        currentY += 15;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("I hereby accept the scope of works and financial terms outlined in this proposal.", 14, currentY);

        currentY += 20;
        doc.setDrawColor(200);
        doc.line(14, currentY, 80, currentY);
        doc.line(110, currentY, 176, currentY);

        doc.text("Signed on behalf of " + (profile?.company_name || "The Contractor"), 14, currentY + 5);
        doc.text("Signed on behalf of " + (project?.client_name || "The Client"), 110, currentY + 5);

        doc.save(`PROPOSAL-${project?.name.replace(/\s+/g, '_')}.pdf`);
    };

    return (
        <Button
            onClick={generatePDF}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow-lg shadow-blue-100"
        >
            <FileDown className="w-4 h-4" />
            Download Proposal PDF
        </Button>
    );
}
