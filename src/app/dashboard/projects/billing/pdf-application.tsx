"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Simple Inline Button to avoid import issues
function Button({ children, size, variant, onClick }: { children: React.ReactNode; size?: string; variant?: string; onClick: () => void }) {
    const base = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-8 px-3";
    const bg = variant === 'outline' ? "border border-input hover:bg-slate-100 bg-white" : "bg-primary text-primary-foreground hover:bg-primary/90";
    return <button type="button" onClick={onClick} className={`${base} ${bg}`}>{children}</button>;
}

interface Props {
    valuation: any;
    project: any;
    lines: any[];
    estimates: any[];
    previousGross: number; // To show movement
}

export default function PdfApplicationButton({ valuation, project, lines, estimates, previousGross }: Props) {

    const generatePDF = () => {
        const doc = new jsPDF();

        // --- HEADER ---
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text(`APPLICATION FOR PAYMENT #${valuation.application_number}`, 14, 20);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Date: ${new Date(valuation.valuation_date).toLocaleDateString()}`, 14, 28);
        doc.text(`Project: ${project.name}`, 14, 33);
        doc.text(`Client: ${project.client_name || "N/A"}`, 14, 38);

        // --- FINANCIAL SUMMARY BOX ---
        doc.setDrawColor(0);
        doc.setFillColor(245, 245, 245);
        doc.rect(120, 15, 80, 45, 'F');
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Valuation Summary", 125, 22);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");

        let y = 30;
        const row = (label: string, val: string, bold = false) => {
            doc.setFont("helvetica", bold ? "bold" : "normal");
            doc.text(label, 125, y);
            doc.text(val, 195, y, { align: "right" });
            y += 6;
        };

        const retentionVal = valuation.retention_amount;
        const gross = valuation.gross_total;
        // Simplified logic for Previous Payments: Gross - Retention - Net Due
        // (In a full system we would sum actual previous payment records)
        const prevNet = (gross - retentionVal) - valuation.net_amount;

        row("Gross Valuation:", `£${gross.toFixed(2)}`);
        row("Less Retention:", `-£${retentionVal.toFixed(2)}`);
        row("Sub-Total:", `£${(gross - retentionVal).toFixed(2)}`, true);
        y += 2;
        row("Less Previous:", `-£${prevNet.toFixed(2)}`);
        y += 2;
        doc.setFontSize(12);
        doc.setTextColor(0, 50, 150);
        row("NET AMOUNT DUE:", `£${valuation.net_amount.toFixed(2)}`, true);

        // --- FIX: FORCE RESET TO BLACK ---
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");

        // --- DETAILED SCHEDULE ---
        const tableData = lines.map(line => {
            const est = estimates.find(e => e.id === line.estimate_id);
            const markup = 1 + ((est?.profit_pct || 0) + (est?.overhead_pct || 0) + (est?.risk_pct || 0)) / 100;
            const contractVal = (est?.total_cost || 0) * markup;

            return [
                est?.version_name || "Item",
                `£${contractVal.toFixed(2)}`,
                `${line.progress_percent}%`,
                `£${line.line_value.toFixed(2)}`
            ];
        });

        autoTable(doc, {
            startY: 70,
            head: [["Activity / Works", "Contract Sum", "Progress", "Current Value"]],
            body: tableData,
            theme: 'grid',
            // Explicitly set text color for body to black to be safe
            styles: { textColor: [0, 0, 0] },
            headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255] }, // White text on Blue header
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center' }, 3: { halign: 'right' } },
        });

        // --- FOOTER / TERMS ---
        // @ts-ignore
        const finalY = (doc as any).lastAutoTable.finalY + 15;

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Payment Terms & Obligations:", 14, finalY);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");

        const terms = [
            `1. Payment Due: ${project.payment_terms || "Within 14 Days"}`,
            `2. Retention Released: 50% on Practical Completion, 50% after Defects Period.`,
            `3. Please make payments to: Constructa Ltd, Sort: 00-00-00, Acc: 12345678`
        ];
        doc.text(terms.join("\n"), 14, finalY + 7);

        doc.save(`Valuation_${valuation.application_number}_${project.name}.pdf`);
    };

    return <Button size="sm" variant="outline" onClick={generatePDF}>📄 Download PDF</Button>;
}
