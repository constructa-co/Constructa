"use client";

import { FileDown } from "lucide-react";
// Sprint 58 P3.3 — use the canonical formatter from @/lib/pdf/pdf-money
// so every document in the app shares one implementation.
import { formatGbp as gbp } from "@/lib/pdf/pdf-money";

const fmtDate = (d?: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB") : "—";

interface Props {
    project:              any;
    profile:              any;
    originalContractSum:  number;
    variations:           any[];   // approved only
    adjustments:          any[];
    invoices:             any[];
    adjustedContractSum:  number;
    totalCertified:       number;
    totalPaid:            number;
    retOutstanding:       number;
    balanceDue:           number;
    finalAccount:         any;
}

export default function FinalAccountPdfButton({
    project, profile, originalContractSum, variations, adjustments, invoices,
    adjustedContractSum, totalCertified, totalPaid, retOutstanding, balanceDue, finalAccount,
}: Props) {

    const handleGenerate = async () => {
        const { default: jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");

        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const W = 210; const margin = 16;
        let y = 0;

        // ── Header band ──────────────────────────────────────────────────────
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(0, 0, W, 42, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255);
        doc.text("FINAL ACCOUNT STATEMENT", margin, 16);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(profile?.company_name ?? "", margin, 24);
        doc.text(`${profile?.address ?? ""}  |  ${profile?.phone ?? ""}  |  ${profile?.email ?? ""}`, margin, 30);

        // Status badge (top-right)
        const status = finalAccount?.status ?? "Draft";
        const badgeColors: Record<string, [number, number, number]> = {
            Draft:    [71, 85, 105],
            Agreed:   [16, 185, 129],
            Disputed: [239, 68, 68],
            Signed:   [59, 130, 246],
        };
        const [br, bg, bb] = badgeColors[status] ?? badgeColors.Draft;
        doc.setFillColor(br, bg, bb);
        const badgeLabel = status.toUpperCase();
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        const badgeW = doc.getTextWidth(badgeLabel) + 8;
        doc.roundedRect(W - margin - badgeW, 9, badgeW, 7, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.text(badgeLabel, W - margin - badgeW / 2, 14.2, { align: "center" });

        y = 50;

        // ── Project details block ─────────────────────────────────────────────
        doc.setFillColor(30, 41, 59); // slate-800
        doc.roundedRect(margin, y, W - margin * 2, 34, 3, 3, "F");

        const col1 = margin + 6;
        const col2 = margin + 6 + (W - margin * 2) / 2;

        const detailRow = (label: string, value: string, x: number, yy: number) => {
            doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139);
            doc.text(label.toUpperCase(), x, yy);
            doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(226, 232, 240);
            doc.text(value || "—", x, yy + 5);
        };

        detailRow("Project", project?.name ?? "", col1, y + 8);
        detailRow("Client", project?.client_name ?? "", col2, y + 8);
        detailRow("Agreement Reference", finalAccount?.agreement_reference ?? "—", col1, y + 22);
        detailRow("Agreed Date", fmtDate(finalAccount?.agreed_date), col2, y + 22);

        y += 42;

        // ── Financial Statement table ─────────────────────────────────────────
        doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(226, 232, 240);
        doc.text("Financial Statement", margin, y);
        y += 5;

        const stmtRows: [string, string, string][] = [
            ["Original Contract Sum", "", gbp(originalContractSum)],
            ...variations.map(v => [
                `  Variation: ${v.variation_number ?? "VAR"} — ${v.title}`,
                "",
                (v.amount >= 0 ? "+" : "") + gbp(Math.abs(v.amount)),
            ] as [string, string, string]),
            ...adjustments.map(a => [
                `  ${a.type}: ${a.description}`,
                "",
                (a.type === "Addition" ? "+" : "-") + gbp(a.amount),
            ] as [string, string, string]),
        ];
        // Sprint 58 P3.1 — deductions only get parentheses when non-zero.
        // A zero row renders as a plain "£0.00" so we don't advertise
        // "(£0.00)" which reads as a loss to anyone skimming the PDF.
        const fmtDeduction = (n: number) => (n > 0 ? `(${gbp(n)})` : gbp(0));

        stmtRows.push(["Adjusted Contract Sum", "", gbp(adjustedContractSum)]);
        stmtRows.push(["Less: Total Certified to Date", "", fmtDeduction(totalCertified)]);
        stmtRows.push(["Add: Retention Outstanding", "", gbp(retOutstanding)]);
        stmtRows.push(["Balance of Account", "", gbp(balanceDue)]);

        if (finalAccount?.agreed_amount != null) {
            stmtRows.push(["", "", ""]);
            stmtRows.push(["Agreed Final Sum", "", gbp(finalAccount.agreed_amount)]);
            stmtRows.push(["Less: Total Paid to Date", "", fmtDeduction(totalPaid)]);
            stmtRows.push(["Final Balance Due", "", gbp(finalAccount.agreed_amount - totalPaid)]);
        }

        const boldRowLabels = new Set([
            "Adjusted Contract Sum", "Balance of Account", "Agreed Final Sum", "Final Balance Due",
        ]);

        autoTable(doc, {
            startY: y,
            head: [["Description", "", "Amount"]],
            body: stmtRows,
            margin: { left: margin, right: margin },
            styles: {
                fontSize: 9,
                cellPadding: 3,
                textColor: [203, 213, 225],
                fillColor: [30, 41, 59],
                lineColor: [51, 65, 85],
                lineWidth: 0.3,
            },
            headStyles: {
                fillColor: [15, 23, 42],
                textColor: [148, 163, 184],
                fontSize: 8,
                fontStyle: "bold",
            },
            columnStyles: {
                0: { cellWidth: "auto" },
                1: { cellWidth: 10 },
                2: { cellWidth: 38, halign: "right" },
            },
            didParseCell: (data) => {
                if (data.section === "body") {
                    const raw = data.row.raw as string[];
                    const label = String(raw?.[0] ?? "");
                    if (boldRowLabels.has(label)) {
                        data.cell.styles.fontStyle = "bold";
                        data.cell.styles.textColor = [255, 255, 255] as any;
                        data.cell.styles.fillColor = [15, 23, 42] as any;
                    }
                }
            },
            theme: "grid",
        });

        y = (doc as any).lastAutoTable.finalY + 8;

        // ── Certification history ─────────────────────────────────────────────
        const normalInvoices = invoices.filter(i => !i.is_retention_release);
        if (normalInvoices.length > 0) {
            doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(226, 232, 240);
            doc.text("Certification History", margin, y);
            y += 4;

            autoTable(doc, {
                startY: y,
                head: [["Period", "Date", "Gross Valuation", "Retention Held", "Net Certified", "Status"]],
                body: normalInvoices.map((inv, i) => [
                    inv.period_number ?? (i + 1),
                    fmtDate(inv.invoice_date),
                    gbp(inv.gross_valuation ?? inv.amount ?? 0),
                    gbp(inv.retention_held ?? 0),
                    gbp(inv.net_due ?? inv.amount ?? 0),
                    inv.status ?? "—",
                ]),
                margin: { left: margin, right: margin },
                styles: { fontSize: 8, cellPadding: 2.5, textColor: [203, 213, 225], fillColor: [30, 41, 59], lineColor: [51, 65, 85], lineWidth: 0.3 },
                headStyles: { fillColor: [15, 23, 42], textColor: [148, 163, 184], fontSize: 7.5, fontStyle: "bold" },
                theme: "grid",
            });

            y = (doc as any).lastAutoTable.finalY + 8;
        }

        // ── Notes ─────────────────────────────────────────────────────────────
        if (finalAccount?.notes) {
            doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(226, 232, 240);
            doc.text("Notes", margin, y);
            y += 5;
            doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(148, 163, 184);
            const lines = doc.splitTextToSize(finalAccount.notes, W - margin * 2);
            doc.text(lines, margin, y);
            y += lines.length * 4.5 + 6;
        }

        // ── Dispute notice (if applicable) ────────────────────────────────────
        if (status === "Disputed" && finalAccount?.dispute_notes) {
            doc.setFillColor(127, 29, 29);
            doc.roundedRect(margin, y, W - margin * 2, 18, 2, 2, "F");
            doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(252, 165, 165);
            doc.text("DISPUTED AMOUNT: " + gbp(finalAccount.disputed_amount ?? 0), margin + 4, y + 7);
            doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(252, 165, 165);
            const dnLines = doc.splitTextToSize(finalAccount.dispute_notes, W - margin * 2 - 8);
            doc.text(dnLines, margin + 4, y + 13);
            y += 24;
        }

        // ── Signature block ───────────────────────────────────────────────────
        // Guard: ensure we have enough space on current page; if not, add new page
        if (y + 55 > 270) {
            doc.addPage();
            y = 20;
        }

        doc.setFillColor(15, 23, 42);
        doc.roundedRect(margin, y, W - margin * 2, 52, 3, 3, "F");

        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(148, 163, 184);
        doc.text("AGREED AND SIGNED", margin + 6, y + 9);

        const halfW = (W - margin * 2 - 12) / 2;

        const sigBlock = (label: string, name: string, x: number, yy: number) => {
            doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
            doc.text(label, x, yy);
            doc.setDrawColor(51, 65, 85);
            doc.line(x, yy + 12, x + halfW, yy + 12);
            doc.setFontSize(7.5); doc.setTextColor(71, 85, 105);
            doc.text(name, x, yy + 17);
            doc.line(x, yy + 26, x + halfW, yy + 26);
            doc.setFontSize(7); doc.setTextColor(71, 85, 105);
            doc.text("Date", x, yy + 31);
        };

        sigBlock("For and on behalf of " + (profile?.company_name ?? "Contractor"), "Authorised Signatory", margin + 6, y + 16);
        sigBlock("For and on behalf of " + (project?.client_name ?? "Client"), "Authorised Signatory", margin + 6 + halfW + 12, y + 16);

        y += 58;

        // ── Footer ────────────────────────────────────────────────────────────
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let p = 1; p <= pageCount; p++) {
            doc.setPage(p);
            doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(71, 85, 105);
            doc.text(
                `Generated ${new Date().toLocaleDateString("en-GB")}  |  ${profile?.company_name ?? ""}  |  Page ${p} of ${pageCount}`,
                W / 2, 290, { align: "center" }
            );
        }

        const fileName = `FinalAccount_${project?.name?.replace(/[^a-z0-9]/gi, "_") ?? "Project"}.pdf`;
        doc.save(fileName);
    };

    return (
        <button
            onClick={handleGenerate}
            className="flex items-center gap-2 px-4 py-2 border border-slate-600 text-slate-300 rounded-lg text-sm font-semibold hover:border-slate-500 hover:text-white transition-colors"
        >
            <FileDown className="w-4 h-4" />
            Export PDF
        </button>
    );
}
