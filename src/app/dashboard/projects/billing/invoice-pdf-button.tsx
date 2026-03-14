"use client";

import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";

interface Props {
    invoice: any;
    project: any;
    originalContractSum: number;
    variations: any[];
}

export default function InvoicePdfButton({ invoice, project, originalContractSum, variations }: Props) {
    const generatePdf = () => {
        const doc = new jsPDF() as any;
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
        doc.text(`Invoice No: ${invoice.invoice_number}`, 120, currentY + 7);
        doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, 120, currentY + 12);
        doc.text(`Type: ${invoice.type} Account`, 120, currentY + 17);

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
        const tableRows: any[][] = [
            ["Original Contract Sum", `GBP ${originalContractSum.toLocaleString()}`]
        ];

        variations.forEach((v, index) => {
            tableRows.push([`Variation: ${v.title}`, `GBP ${v.amount.toLocaleString()}`]);
        });

        tableRows.push([{ content: "REVISED CONTRACT VALUE", styles: { fontStyle: 'bold' } }, { content: `GBP ${(originalContractSum + variations.reduce((s, v) => s + Number(v.amount), 0)).toLocaleString()}`, styles: { fontStyle: 'bold' } }]);

        doc.autoTable({
            startY: currentY,
            margin: { left: margin, right: margin },
            head: [['Description', 'Amount']],
            body: tableRows,
            theme: 'striped',
            headStyles: { fillStyle: [15, 23, 42], textColor: 255 },
            styles: { fontSize: 9 }
        });

        currentY = doc.lastAutoTable.finalY + 20;

        // --- TOTAL DUE ---
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("CURRENT AMOUNT DUE FOR THIS VALUATION:", margin, currentY);

        doc.setFontSize(18);
        doc.setTextColor(37, 99, 235); // Blue-600
        doc.text(`GBP ${invoice.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, margin, currentY + 10);

        // --- FOOTER ---
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("All variations have been formally checked and approved. Please remit payment within 14 days.", margin, 280);

        doc.save(`Invoice_${invoice.invoice_number}_${project.name}.pdf`);
    };

    return (
        <Button variant="ghost" size="sm" onClick={generatePdf} className="h-7 text-blue-600 hover:bg-blue-50 gap-2 font-black uppercase text-[10px]">
            <Download className="w-3.5 h-3.5" />
            PDF
        </Button>
    );
}
