"use client";

import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatGbp } from "@/lib/pdf/pdf-money";
import { BRAND } from "@/lib/pdf/pdf-utils";

// Sprint 58 P3.3 — the PDF button only needs a small subset of the
// canonical Invoice/Project/Variation shapes, and the parent component
// (client-billing.tsx) has its own narrower local Invoice interface.
// Use structural subsets here so both callers can satisfy the props
// without forcing a cascade of refactors up the tree.
interface InvoiceLike {
    invoice_number?: string | null;
    type?: "Interim" | "Final" | null;
    amount: number;
    created_at?: string | null;
}

interface ProjectLike {
    name: string;
    client_name?: string | null;
    is_vat_reverse_charge?: boolean | null;
}

interface VariationLike {
    title: string;
    amount: number;
}

interface Props {
    invoice: InvoiceLike;
    project: ProjectLike;
    originalContractSum: number;
    variations: VariationLike[];
}

export default function InvoicePdfButton({ invoice, project, originalContractSum, variations }: Props) {
    const generatePdf = () => {
        // Sprint 58 P3.3 — migrated to the canonical `formatGbp` helper
        // in @/lib/pdf/pdf-money so this PDF can never print "£-0.00"
        // and always uses proper UK formatting. Typed props come from
        // @/types/domain so a renamed field on `projects` would fail the
        // TS build rather than silently rendering "undefined" in the
        // document.
        const doc = new jsPDF() as jsPDF & {
            autoTable: (opts: Record<string, unknown>) => void;
            lastAutoTable: { finalY: number };
        };
        const margin = 20;
        let currentY = 20;

        // --- COMPANY HEADER ---
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("CONSTRUCTA", margin, currentY);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120);
        doc.text("Professional Construction Management", margin, currentY + 7);

        // --- INVOICE INFO ---
        doc.setTextColor(0);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("PAYMENT VALUATION / INVOICE", 120, currentY);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Invoice No: ${invoice.invoice_number ?? ""}`, 120, currentY + 7);
        if (invoice.created_at) {
            doc.text(
                `Date: ${new Date(invoice.created_at).toLocaleDateString("en-GB")}`,
                120,
                currentY + 12,
            );
        }
        doc.text(`Type: ${invoice.type ?? "Interim"} Account`, 120, currentY + 17);

        currentY += 40;

        // --- CLIENT & PROJECT ---
        doc.setFont("helvetica", "bold");
        doc.text("Client:", margin, currentY);
        doc.setFont("helvetica", "normal");
        doc.text(project.client_name || "Valued Client", margin, currentY + 5);

        doc.setFont("helvetica", "bold");
        doc.text("Project:", 120, currentY);
        doc.setFont("helvetica", "normal");
        doc.text(project.name, 120, currentY + 5);

        currentY += 25;

        // --- FINANCIAL DATA TABLE ---
        type Cell = string | { content: string; styles: { fontStyle: string } };
        const tableRows: Cell[][] = [
            ["Original Contract Sum", formatGbp(originalContractSum)],
        ];

        variations.forEach((v) => {
            tableRows.push([`Variation: ${v.title}`, formatGbp(v.amount)]);
        });

        const revisedValue =
            originalContractSum +
            variations.reduce((s, v) => s + Number(v.amount), 0);
        tableRows.push([
            { content: "REVISED CONTRACT VALUE", styles: { fontStyle: "bold" } },
            { content: formatGbp(revisedValue), styles: { fontStyle: "bold" } },
        ]);

        doc.autoTable({
            startY: currentY,
            margin: { left: margin, right: margin },
            head: [["Description", "Amount"]],
            body: tableRows,
            theme: "striped",
            headStyles: { fillStyle: BRAND.navy as any, textColor: 255 },
            styles: { fontSize: 9 },
        });

        currentY = doc.lastAutoTable.finalY + 20;

        // --- TOTAL DUE ---
        const isReverseCharge = project.is_vat_reverse_charge === true;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(
            isReverseCharge ? "CURRENT AMOUNT DUE (VAT REVERSE-CHARGED):" : "CURRENT AMOUNT DUE FOR THIS VALUATION:",
            margin,
            currentY,
        );

        doc.setFontSize(18);
        doc.setTextColor(...BRAND.blue);
        doc.text(formatGbp(invoice.amount), margin, currentY + 10);

        // --- P1-1 VAT Domestic Reverse Charge notice (HMRC VAT Notice 735) ---
        if (isReverseCharge) {
            doc.setFontSize(8);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(100);
            const noteY = currentY + 22;
            doc.text("VAT: Domestic Reverse Charge applies (VAT Act 1994, s.55A — VAT Notice 735).", margin, noteY);
            doc.text("As a VAT-registered subcontractor, this supply is subject to the domestic reverse charge.", margin, noteY + 5);
            doc.text("The customer must account for the VAT due under the domestic reverse charge rules.", margin, noteY + 10);
        }

        // --- FOOTER ---
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150);
        doc.text(
            "All variations have been formally checked and approved. Please remit payment within 14 days.",
            margin,
            280,
        );

        doc.save(`Invoice_${invoice.invoice_number ?? "draft"}_${project.name}.pdf`);
    };

    return (
        <Button variant="ghost" size="sm" onClick={generatePdf} className="h-7 text-blue-600 hover:bg-blue-50 gap-2 font-black uppercase text-[10px]">
            <Download className="w-3.5 h-3.5" />
            PDF
        </Button>
    );
}
