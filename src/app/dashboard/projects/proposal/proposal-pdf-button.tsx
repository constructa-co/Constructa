"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";

interface Props {
    estimates: any[];
    project: any;
    profile: any;
    pricingMode: "full" | "summary";
    validityDays: number;
}

// ─── Colour palette ───────────────────────────────────────────
const C = {
    navy: [15, 26, 46] as [number, number, number],       // #0f1a2e
    navyLight: [30, 48, 80] as [number, number, number],  // lighter navy for accents
    slate700: [51, 65, 85] as [number, number, number],
    slate500: [100, 116, 139] as [number, number, number],
    slate300: [203, 213, 225] as [number, number, number],
    slate50: [248, 250, 252] as [number, number, number],
    slate100: [241, 245, 249] as [number, number, number],
    slate200: [226, 232, 240] as [number, number, number],
    border: [226, 232, 240] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    green: [22, 163, 74] as [number, number, number],
};

const GANTT_COLORS: Record<string, [number, number, number]> = {
    blue: [59, 130, 246],
    green: [34, 197, 94],
    orange: [249, 115, 22],
    purple: [168, 85, 247],
    slate: [100, 116, 139],
    red: [239, 68, 68],
};

const PAGE_W = 210;
const PAGE_H = 297;
const ML = 14;
const MR = 196;
const CW = 182;
const HEADER_H = 10;  // slim navy header band height
const FOOTER_H = 10;  // slim footer height
const CONTENT_TOP = HEADER_H + 8; // first y after header
const CONTENT_BOTTOM = PAGE_H - FOOTER_H - 6;

function formatGBP(n: number): string {
    return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: Date): string {
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// Standard 9 T&C clauses
const STANDARD_TC_CLAUSES = [
    ["1 — Jurisdiction", "The law of Contract is the Law of England and Wales. The Language of this Contract is English."],
    ["2 — Responsibilities", "The Works are detailed within the Scope of Works attached to this Proposal. All Works are to meet Statutory Requirements, including all applicable British and European Standards, and industry best practices."],
    ["3 — Alternative Dispute Resolution", "Should any dispute arise which cannot be resolved by negotiation, escalation shall be via Adjudication. The Adjudicating Nominated Body is the Royal Institute of Chartered Surveyors (RICS), under the RICS Homeowner Adjudication Scheme."],
    ["4 — Liability", "The Defect Liability Period is 12 months from the date of Completion Certificate. Any Defects notified within the Defect Period are to be promptly rectified by the Contractor."],
    ["5 — Workmanship", "All Works are to be performed using reasonable skill and care to that of a competent Contractor with experience on projects of similar size and scope."],
    ["6 — Insurances", "The Contractor shall maintain throughout the Works: Public Liability Insurance; Employers Liability Insurance; Contractors All Risk Insurance. Evidence of current policies available on request."],
    ["7 — Payments", "Payment dates are 21 Calendar days from receipt of Application. Any deductions by the Client must be formally notified as a 'Pay-Less-Notice' no later than 7 days following receipt of Application."],
    ["8 — Change Management", "Any Variations to the Scope must be issued in writing. The Contractor will respond within 7 Calendar days with any Cost and/or Time implications."],
    ["9 — Health, Safety & CDM", "The Client is a Domestic Client under the Construction Design Management (CDM) Regulations 2015. The Contractor shall act as Principal Contractor and comply with all CDM requirements."],
];

export default function ProposalPdfButton({ estimates, project, profile, pricingMode, validityDays }: Props) {
    const [generating, setGenerating] = useState(false);

    const generatePDF = async () => {
        setGenerating(true);
        try {
            await buildProposalPDF({ estimates, project, profile, pricingMode, validityDays });
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

// ─── Helpers ─────────────────────────────────────────────────

/** Add page header band (navy) + footer. Returns the y position to start content. */
function addPageHeader(doc: jsPDF, companyName: string, docTitle: string, pageNum: number, totalPagesRef: { n: number }): number {
    // Navy header band
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, PAGE_W, HEADER_H, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.white);
    doc.text(companyName.toUpperCase(), ML, 6.5);
    doc.text(docTitle, PAGE_W / 2, 6.5, { align: "center" });
    doc.text(`${pageNum}`, MR, 6.5, { align: "right" });

    // Slim footer
    doc.setDrawColor(...C.slate300);
    doc.setLineWidth(0.2);
    doc.line(ML, PAGE_H - FOOTER_H, MR, PAGE_H - FOOTER_H);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.slate500);
    doc.text(`Page ${pageNum} | ${companyName} | Confidential`, PAGE_W / 2, PAGE_H - 4, { align: "center" });

    return CONTENT_TOP;
}

/** Section heading with left navy accent bar */
function renderSectionHeading(doc: jsPDF, y: number, text: string): number {
    // Navy accent bar
    doc.setFillColor(...C.navy);
    doc.rect(ML, y - 1, 3, 8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...C.navy);
    doc.text(text, ML + 6, y + 5.5);

    // Thin line below
    doc.setDrawColor(...C.slate200);
    doc.setLineWidth(0.3);
    doc.line(ML, y + 10, MR, y + 10);

    return y + 16;
}

/** Render body text with wrapping */
function renderBodyText(doc: jsPDF, y: number, text: string, maxWidth = CW): number {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...C.slate700);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, ML, y);
    return y + lines.length * 5.5;
}

/** Ensure there's enough space, add page if not */
function ensureSpace(doc: jsPDF, y: number, needed: number, companyName: string, docTitle: string, totalPagesRef: { n: number }): number {
    if (y + needed > CONTENT_BOTTOM) {
        doc.addPage();
        totalPagesRef.n++;
        return addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef);
    }
    return y;
}

// ─── Main PDF builder ─────────────────────────────────────────
async function buildProposalPDF({ estimates, project, profile, pricingMode, validityDays }: Props) {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const companyName = profile?.company_name || "The Contractor";
    const clientName = project?.client_name || "Valued Client";
    const projectName = project?.name || "Project Proposal";
    const address = project?.site_address || project?.client_address || "";
    const clientAddress = project?.client_address || address;
    const projectType = project?.project_type || "Construction Works";
    const today = new Date();
    const validUntil = new Date(Date.now() + validityDays * 86400000);
    const refCode = (project?.id || "00000000").substring(0, 8).toUpperCase();
    const docTitle = `Proposal — ${projectName}`;
    const totalPagesRef = { n: 1 };

    const grandTotal = estimates.reduce((sum, est) => {
        const markup = 1 + ((est.profit_pct || 0) + (est.overhead_pct || 0) + (est.risk_pct || 0)) / 100;
        return sum + ((est.total_cost || 0) * markup);
    }, 0);

    const contractValue = project?.potential_value || grandTotal || 0;

    // ═══════════════════════════════════════════════════════════
    // PAGE 1 — COVER PAGE
    // ═══════════════════════════════════════════════════════════
    const coverNavyH = PAGE_H * 0.40; // 40% navy

    // Navy top block
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, PAGE_W, coverNavyH, "F");

    // Company logo or name (in navy area)
    let logoLoaded = false;
    if (profile?.logo_url) {
        try {
            doc.addImage(profile.logo_url, "PNG", ML + 4, 18, 60, 20);
            logoLoaded = true;
        } catch {
            logoLoaded = false;
        }
    }
    if (!logoLoaded) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(26);
        doc.setTextColor(...C.white);
        doc.text(companyName.toUpperCase(), ML + 4, 36);
    }

    // "PROPOSAL & FEE PROPOSAL" small caps
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(180, 200, 220);
    doc.text("PROPOSAL & FEE PROPOSAL", ML + 4, logoLoaded ? 46 : 48);

    // Thin white rule
    doc.setDrawColor(...C.white);
    doc.setLineWidth(0.3);
    doc.line(ML + 4, logoLoaded ? 52 : 54, MR - 4, logoLoaded ? 52 : 54);

    // White area content
    let y = coverNavyH + 18;

    // Project name — very large
    doc.setFont("helvetica", "bold");
    doc.setFontSize(34);
    doc.setTextColor(...C.navy);
    const titleLines = doc.splitTextToSize(projectName, CW);
    doc.text(titleLines, ML, y);
    y += titleLines.length * 13 + 10;

    // "Prepared for:"
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.slate500);
    doc.text("PREPARED FOR:", ML, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(...C.navy);
    doc.text(clientName, ML, y);
    y += 7;

    if (clientAddress) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...C.slate700);
        const addrLines = doc.splitTextToSize(clientAddress, 100);
        doc.text(addrLines, ML, y);
        y += addrLines.length * 5 + 6;
    }

    // Two-column bottom info
    y += 4;
    const col2X = PAGE_W / 2 + 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.slate500);
    doc.text("DATE ISSUED:", ML, y);
    doc.text("REFERENCE:", col2X, y);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...C.navy);
    doc.text(formatDate(today), ML, y);
    doc.text(refCode, col2X, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.slate500);
    doc.text("VALID UNTIL:", ML, y);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...C.navy);
    doc.text(formatDate(validUntil), ML, y);

    // Company footer bar (thin navy strip at bottom)
    doc.setFillColor(...C.navy);
    doc.rect(0, PAGE_H - 12, PAGE_W, 12, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.white);
    doc.text(companyName, ML, PAGE_H - 4.5);
    doc.text("Confidential", MR, PAGE_H - 4.5, { align: "right" });

    // ═══════════════════════════════════════════════════════════
    // PAGE 2 — ABOUT US (only if capability_statement exists)
    // ═══════════════════════════════════════════════════════════
    if (profile?.capability_statement) {
        doc.addPage();
        totalPagesRef.n++;
        y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef);

        y = renderSectionHeading(doc, y, `About ${companyName}`);

        // Years trading badge
        if (profile.years_trading) {
            doc.setFillColor(...C.slate100);
            doc.roundedRect(ML, y, 50, 10, 2, 2, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(...C.navy);
            doc.text(`${profile.years_trading} years trading`, ML + 4, y + 6.5);
            y += 15;
        }

        // Specialisms as bullet list
        if (profile.specialisms) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(...C.navy);
            doc.text("Specialisms", ML, y);
            y += 6;
            const specs = profile.specialisms.split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
            specs.forEach((spec: string) => {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9.5);
                doc.setTextColor(...C.slate700);
                doc.text(`• ${spec}`, ML + 3, y);
                y += 5.5;
            });
            y += 4;
        }

        // Capability statement
        y = renderBodyText(doc, y, profile.capability_statement);
        y += 8;

        // Insurance / accreditation info box
        const infoRows: string[][] = [];
        if (profile.years_trading) infoRows.push(["Years Trading", String(profile.years_trading)]);
        if (profile.accreditations) infoRows.push(["Accreditations", profile.accreditations]);
        if (profile.insurance_details) infoRows.push(["Insurance", profile.insurance_details]);
        if (profile.company_number) infoRows.push(["Company Reg.", profile.company_number]);
        if (profile.vat_number) infoRows.push(["VAT Number", profile.vat_number]);
        if (profile.website) infoRows.push(["Website", profile.website]);
        if (profile.phone) infoRows.push(["Phone", profile.phone]);

        if (infoRows.length > 0) {
            autoTable(doc, {
                startY: y,
                body: infoRows,
                theme: "plain",
                margin: { left: ML, right: PAGE_W - MR },
                bodyStyles: { fontSize: 9.5, textColor: C.slate700, cellPadding: 3.5 },
                columnStyles: {
                    0: { fontStyle: "bold", cellWidth: 45, textColor: C.slate500, fontSize: 8.5 },
                },
                alternateRowStyles: { fillColor: C.slate50 },
                didDrawPage: () => { totalPagesRef.n = doc.getNumberOfPages(); },
            });
            y = (doc as any).lastAutoTable.finalY + 8;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PAGE 3 — INTRODUCTION
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    totalPagesRef.n++;
    y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef);

    y = renderSectionHeading(doc, y, "Introduction");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C.navy);
    doc.text(`Dear ${clientName},`, ML, y);
    y += 9;

    if (project?.proposal_introduction) {
        y = renderBodyText(doc, y, project.proposal_introduction);
    } else {
        const para1 = `Thank you for the opportunity to submit this Proposal for ${projectName} at ${address || "the project site"}. We have carefully reviewed your requirements and are pleased to present our comprehensive fee proposal for the Works described herein.`;
        const para2 = `This document sets out our Scope of Works, commercial terms, and the basis upon which we propose to undertake this project. We are committed to delivering these Works to the highest standard, on time and within budget.`;
        y = renderBodyText(doc, y, para1);
        y += 4;
        y = renderBodyText(doc, y, para2);
    }
    y += 12;

    // Project Overview Table
    y = renderSectionHeading(doc, y, "Project Overview");

    const startDate = project?.start_date
        ? formatDate(new Date(project.start_date))
        : "TBC — to be agreed on acceptance";

    const overviewRows = [
        ["Project", projectName],
        ["Client", clientName],
        ["Site Address", address || "—"],
        ["Project Type", projectType],
        ["Proposed Start", startDate],
    ];
    if (contractValue > 0) {
        overviewRows.push(["Contract Sum (exc. VAT)", formatGBP(contractValue)]);
    }

    autoTable(doc, {
        startY: y,
        body: overviewRows,
        theme: "plain",
        margin: { left: ML, right: PAGE_W - MR },
        bodyStyles: { fontSize: 10, textColor: C.slate700, cellPadding: 4 },
        columnStyles: {
            0: { fontStyle: "bold", cellWidth: 55, textColor: C.slate500, fontSize: 8.5 },
        },
        alternateRowStyles: { fillColor: C.slate50 },
        tableLineColor: C.border,
        tableLineWidth: 0.2,
        didDrawPage: () => { totalPagesRef.n = doc.getNumberOfPages(); },
    });

    // ═══════════════════════════════════════════════════════════
    // PAGE 4 — SCOPE OF WORKS
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    totalPagesRef.n++;
    y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef);

    y = renderSectionHeading(doc, y, "Scope of Works");

    if (project?.scope_text) {
        y = renderBodyText(doc, y, project.scope_text);
    } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(...C.slate500);
        doc.text("Scope to be completed in the Proposal Editor.", ML, y);
        y += 8;
    }

    // ═══════════════════════════════════════════════════════════
    // PAGE 5+ — FEE PROPOSAL
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    totalPagesRef.n++;
    y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef);

    y = renderSectionHeading(doc, y, "Fee Proposal");

    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...C.slate500);
    doc.text("All prices exclusive of VAT unless stated.", ML, y);
    y += 10;

    if (pricingMode === "full") {
        estimates.forEach((est) => {
            const markup = 1 + ((est.profit_pct || 0) + (est.overhead_pct || 0) + (est.risk_pct || 0)) / 100;
            const estTotal = (est.total_cost || 0) * markup;
            const lines = est.estimate_lines || [];

            const bodyRows = lines.map((line: any) => {
                const desc = line.mom_item_code ? `[${line.mom_item_code}] ${line.description}` : line.description;
                return [
                    desc || "—",
                    String(line.quantity ?? ""),
                    line.unit || "",
                    formatGBP(line.unit_rate || 0),
                    formatGBP(line.line_total || 0),
                ];
            });

            autoTable(doc, {
                startY: y,
                head: [[{ content: est.version_name || "Estimate", colSpan: 5, styles: { halign: "left" as const } }]],
                body: bodyRows,
                foot: [["Subtotal", "", "", "", formatGBP(estTotal)]],
                theme: "grid",
                margin: { left: ML, right: PAGE_W - MR },
                headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: "bold", fontSize: 9 },
                bodyStyles: { fontSize: 9, textColor: C.slate700, cellPadding: 3 },
                footStyles: { fillColor: C.slate100, textColor: C.navy, fontStyle: "bold", fontSize: 9 },
                columnStyles: {
                    0: { cellWidth: 70 },
                    1: { cellWidth: 18, halign: "center" as const },
                    2: { cellWidth: 20, halign: "center" as const },
                    3: { cellWidth: 30, halign: "right" as const },
                    4: { cellWidth: 30, halign: "right" as const },
                },
                alternateRowStyles: { fillColor: C.slate50 },
                tableLineColor: C.border,
                tableLineWidth: 0.2,
                didDrawPage: () => { totalPagesRef.n = doc.getNumberOfPages(); },
            });

            y = (doc as any).lastAutoTable.finalY + 3;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(...C.slate500);
            doc.text(
                `Overhead: ${est.overhead_pct || 0}%  |  Profit: ${est.profit_pct || 0}%  |  Risk: ${est.risk_pct || 0}%`,
                ML, y
            );
            y += 9;
        });

        // Grand total box
        y = ensureSpace(doc, y, 20, companyName, docTitle, totalPagesRef);
        doc.setFillColor(...C.navy);
        doc.rect(ML, y, CW, 13, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...C.white);
        doc.text("TOTAL CONTRACT SUM (EXC. VAT):", ML + 4, y + 8.5);
        doc.text(formatGBP(grandTotal), MR - 4, y + 8.5, { align: "right" });
        y += 20;
    } else {
        const summaryRows = estimates.map((est) => {
            const markup = 1 + ((est.profit_pct || 0) + (est.overhead_pct || 0) + (est.risk_pct || 0)) / 100;
            return [est.version_name || "Estimate", formatGBP((est.total_cost || 0) * markup)];
        });

        autoTable(doc, {
            startY: y,
            head: [["Trade / Phase", "Total (£)"]],
            body: summaryRows,
            foot: [["TOTAL CONTRACT SUM (EXC. VAT)", formatGBP(grandTotal)]],
            theme: "grid",
            margin: { left: ML, right: PAGE_W - MR },
            headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: "bold", fontSize: 9 },
            bodyStyles: { fontSize: 10, textColor: C.slate700, cellPadding: 4 },
            footStyles: { fillColor: C.navy, textColor: C.white, fontStyle: "bold", fontSize: 10 },
            columnStyles: { 1: { halign: "right" as const, cellWidth: 45 } },
            alternateRowStyles: { fillColor: C.slate50 },
            tableLineColor: C.border,
            tableLineWidth: 0.2,
            didDrawPage: () => { totalPagesRef.n = doc.getNumberOfPages(); },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Payment Schedule (if present) — at bottom of fee section
    const paymentSchedule = project?.payment_schedule;
    if (paymentSchedule && paymentSchedule.length > 0) {
        y = ensureSpace(doc, y, 30, companyName, docTitle, totalPagesRef);
        y += 4;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...C.navy);
        doc.text("Payment Schedule", ML, y);
        y += 8;

        const payRows = paymentSchedule.map((row: any) => {
            const amount = contractValue ? (contractValue * row.percentage) / 100 : 0;
            return [
                row.stage || "",
                row.description || "",
                `${row.percentage}%`,
                amount > 0 ? formatGBP(amount) : "—",
            ];
        });

        autoTable(doc, {
            startY: y,
            head: [["Stage", "Description", "%", "£ Amount"]],
            body: payRows,
            theme: "grid",
            margin: { left: ML, right: PAGE_W - MR },
            headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: "bold", fontSize: 9 },
            bodyStyles: { fontSize: 9.5, textColor: C.slate700, cellPadding: 3.5 },
            columnStyles: {
                0: { cellWidth: 45, fontStyle: "bold" },
                2: { cellWidth: 18, halign: "center" as const },
                3: { cellWidth: 35, halign: "right" as const, fontStyle: "bold" },
            },
            alternateRowStyles: { fillColor: C.slate50 },
            tableLineColor: C.border,
            tableLineWidth: 0.2,
            didDrawPage: () => { totalPagesRef.n = doc.getNumberOfPages(); },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Validity statement
    y = ensureSpace(doc, y, 15, companyName, docTitle, totalPagesRef);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.slate500);
    const validityText = `This Proposal is valid for ${validityDays} days from the date of issue (${formatDate(today)}). After this period, rates may be subject to review.`;
    const validityLines = doc.splitTextToSize(validityText, CW);
    doc.text(validityLines, ML, y);

    // ═══════════════════════════════════════════════════════════
    // TIMELINE / GANTT
    // ═══════════════════════════════════════════════════════════
    const phases: any[] = project?.gantt_phases || [];
    if (phases.length > 0) {
        doc.addPage();
        totalPagesRef.n++;
        y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef);

        y = renderSectionHeading(doc, y, "Project Timeline");

        const allPhasesWithDates = phases.map((p: any, idx: number) => {
            let startMs: number;
            if (p.start_date) {
                startMs = new Date(p.start_date).getTime();
            } else if (project?.start_date) {
                const projectStart = new Date(project.start_date).getTime();
                const prevDays = phases.slice(0, idx).reduce((sum: number, prev: any) => sum + (prev.duration_days || 7), 0);
                startMs = projectStart + prevDays * 86400000;
            } else {
                const baseDate = Date.now();
                const prevDays = phases.slice(0, idx).reduce((sum: number, prev: any) => sum + (prev.duration_days || 7), 0);
                startMs = baseDate + prevDays * 86400000;
            }
            return {
                ...p,
                startMs,
                endMs: startMs + (p.duration_days || 7) * 86400000,
            };
        });

        const timelineStart = Math.min(...allPhasesWithDates.map((p: any) => p.startMs));
        const timelineEnd = Math.max(...allPhasesWithDates.map((p: any) => p.endMs));
        const totalDays = Math.max(1, Math.ceil((timelineEnd - timelineStart) / 86400000));
        const totalWeeks = Math.ceil(totalDays / 7);

        const labelColW = 55;
        const durationColW = 25;
        const chartX = ML + labelColW + durationColW;
        const chartW = CW - labelColW - durationColW;
        const rowH = 11;
        const headerH = 13;

        // Navy header bar
        doc.setFillColor(...C.navy);
        doc.rect(ML, y, CW, headerH, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...C.white);
        doc.text("Phase", ML + 3, y + 8);
        doc.text("Duration", ML + labelColW + 3, y + 8);

        // Week labels
        const weekW = chartW / Math.max(1, Math.min(totalWeeks, 24));
        for (let w = 0; w < Math.min(totalWeeks, 24); w++) {
            const wx = chartX + w * weekW;
            const label = `W${w + 1}`;
            if (weekW > 6) {
                doc.text(label, wx + weekW / 2, y + 8, { align: "center" });
            } else if (w % 2 === 0) {
                doc.text(label, wx + weekW / 2, y + 8, { align: "center" });
            }
        }
        y += headerH;

        allPhasesWithDates.forEach((phase: any, idx: number) => {
            if (idx % 2 === 0) {
                doc.setFillColor(...C.slate50);
                doc.rect(ML, y, CW, rowH, "F");
            }

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(...C.slate700);
            doc.text(
                doc.splitTextToSize(phase.name || `Phase ${idx + 1}`, labelColW - 4)[0],
                ML + 3, y + 7
            );

            // Duration label
            const weeks = Math.round((phase.duration_days || 7) / 7);
            doc.setFontSize(7.5);
            doc.setTextColor(...C.slate500);
            doc.text(`${weeks} wk${weeks !== 1 ? "s" : ""}`, ML + labelColW + 3, y + 7);

            // Bar
            const startOffset = (phase.startMs - timelineStart) / 86400000;
            const cappedWeeks = Math.min(totalWeeks, 24);
            const cappedTotalDays = cappedWeeks * 7;
            const barX = chartX + Math.min(startOffset / cappedTotalDays, 0.95) * chartW;
            const barW = Math.max(3, Math.min((phase.duration_days / cappedTotalDays) * chartW, chartW * 0.98));
            const barColor = GANTT_COLORS[phase.color] || GANTT_COLORS.blue;

            doc.setFillColor(...barColor);
            doc.roundedRect(barX, y + 2, barW, rowH - 4, 1.5, 1.5, "F");

            // Start date label on bar if space
            if (phase.start_date && barW > 20) {
                const startLabel = new Date(phase.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                doc.setFont("helvetica", "bold");
                doc.setFontSize(6);
                doc.setTextColor(...C.white);
                doc.text(startLabel, barX + 3, y + 7);
            }

            y += rowH;
        });

        // Border
        doc.setDrawColor(...C.slate200);
        doc.setLineWidth(0.3);
        doc.rect(ML, y - phases.length * rowH - headerH, CW, phases.length * rowH + headerH, "S");

        // Legend
        y += 5;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(...C.slate500);
        doc.text("Note: Timeline is indicative. Final programme subject to agreement on acceptance.", ML, y);
    }

    // ═══════════════════════════════════════════════════════════
    // EXCLUSIONS & CLARIFICATIONS
    // ═══════════════════════════════════════════════════════════
    if (project?.exclusions_text || project?.clarifications_text) {
        doc.addPage();
        totalPagesRef.n++;
        y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef);

        y = renderSectionHeading(doc, y, "Exclusions & Clarifications");

        // Two side-by-side boxes
        const halfW = (CW - 8) / 2;
        const boxX2 = ML + halfW + 8;
        const boxStartY = y;
        let leftY = y + 8;
        let rightY = y + 8;

        // Exclusions box (left)
        if (project?.exclusions_text) {
            doc.setFillColor(...C.navy);
            doc.rect(ML, y, halfW, 10, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(...C.white);
            doc.text("EXCLUSIONS", ML + 4, y + 6.5);
            leftY = y + 14;

            const exclItems = project.exclusions_text.split("\n").filter((s: string) => s.trim());
            exclItems.forEach((item: string) => {
                const bulletLines = doc.splitTextToSize(`•  ${item.trim()}`, halfW - 6);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                doc.setTextColor(...C.slate700);
                doc.text(bulletLines, ML + 4, leftY);
                leftY += bulletLines.length * 4.8 + 1.5;
            });
        }

        // Clarifications box (right)
        if (project?.clarifications_text) {
            doc.setFillColor(...C.navy);
            doc.rect(boxX2, boxStartY, halfW, 10, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(...C.white);
            doc.text("CLARIFICATIONS", boxX2 + 4, boxStartY + 6.5);
            rightY = boxStartY + 14;

            const clarItems = project.clarifications_text.split("\n").filter((s: string) => s.trim());
            clarItems.forEach((item: string) => {
                const bulletLines = doc.splitTextToSize(`•  ${item.trim()}`, halfW - 6);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                doc.setTextColor(...C.slate700);
                doc.text(bulletLines, boxX2 + 4, rightY);
                rightY += bulletLines.length * 4.8 + 1.5;
            });
        }
    }

    // ═══════════════════════════════════════════════════════════
    // SITE PHOTOS (only if photos exist)
    // ═══════════════════════════════════════════════════════════
    const sitePhotos: any[] = project?.site_photos || [];
    const hasPhotos = sitePhotos.some((p: any) => p.url);

    if (hasPhotos) {
        doc.addPage();
        totalPagesRef.n++;
        y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef);

        y = renderSectionHeading(doc, y, "Site Photographs");

        const introText = "Photographs captured during the site visit and survey are included below for reference.";
        y = renderBodyText(doc, y, introText);
        y += 6;

        const boxW = (CW - 8) / 2;
        const boxH = 58;
        const gap = 8;
        const startX1 = ML;
        const startX2 = ML + boxW + gap;

        const photosToRender = sitePhotos.filter((p: any) => p.url).slice(0, 6);

        for (let i = 0; i < photosToRender.length; i++) {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const bx = col === 0 ? startX1 : startX2;
            const by = y + row * (boxH + gap + 6);

            if (by + boxH > CONTENT_BOTTOM) break;

            const photo = photosToRender[i];
            try {
                doc.addImage(photo.url, "JPEG", bx, by, boxW, boxH);
            } catch {
                doc.setFillColor(...C.slate100);
                doc.rect(bx, by, boxW, boxH, "F");
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
                doc.setTextColor(...C.slate500);
                doc.text(photo.caption || "Photo", bx + boxW / 2, by + boxH / 2, { align: "center" });
            }

            if (photo.caption) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(7);
                doc.setTextColor(...C.slate500);
                doc.text(photo.caption, bx + boxW / 2, by + boxH + 4, { align: "center" });
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // TERMS & CONDITIONS
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    totalPagesRef.n++;
    y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef);

    y = renderSectionHeading(doc, y, "Terms & Conditions of Contract");

    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...C.slate500);
    doc.text("The following standard clauses form part of this Proposal and the Contract upon acceptance.", ML, y);
    y += 10;

    const tcClauses = project?.tc_overrides || STANDARD_TC_CLAUSES.map(([t, b]) => ({ title: t, body: b }));
    const tcRows = tcClauses.map((c: any) => {
        const title = c.title || (Array.isArray(c) ? c[0] : "");
        const body = c.body || (Array.isArray(c) ? c[1] : "");
        return [title, body];
    });

    autoTable(doc, {
        startY: y,
        head: [["Clause", "Terms"]],
        body: tcRows,
        theme: "grid",
        margin: { left: ML, right: PAGE_W - MR },
        headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 8.5, textColor: C.slate700, cellPadding: 4 },
        columnStyles: {
            0: { cellWidth: 55, fontStyle: "bold", textColor: C.navy, fontSize: 8.5 },
        },
        alternateRowStyles: { fillColor: C.slate50 },
        tableLineColor: C.border,
        tableLineWidth: 0.2,
        didDrawPage: () => { totalPagesRef.n = doc.getNumberOfPages(); },
    });

    // ═══════════════════════════════════════════════════════════
    // SIGNATURE PAGE
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    totalPagesRef.n++;
    y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef);

    y = renderSectionHeading(doc, y, "Acceptance & Signatures");

    // Summary box
    doc.setFillColor(...C.slate50);
    doc.roundedRect(ML, y, CW, 28, 3, 3, "F");
    doc.setDrawColor(...C.slate200);
    doc.setLineWidth(0.3);
    doc.roundedRect(ML, y, CW, 28, 3, 3, "S");

    const sumCol2 = ML + CW / 3;
    const sumCol3 = ML + (CW * 2) / 3;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...C.slate500);
    doc.text("CONTRACT VALUE", ML + 6, y + 8);
    doc.text("PROPOSED START", sumCol2 + 3, y + 8);
    doc.text("VALID UNTIL", sumCol3 + 3, y + 8);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...C.navy);
    doc.text(contractValue > 0 ? formatGBP(contractValue) : "TBC", ML + 6, y + 21);

    doc.setFontSize(11);
    doc.text(
        project?.start_date ? formatDate(new Date(project.start_date)) : "TBC",
        sumCol2 + 3, y + 21
    );
    doc.text(formatDate(validUntil), sumCol3 + 3, y + 21);

    y += 36;

    // Signing statement
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...C.slate700);
    const sigText = "By signing below, both parties agree to the Scope of Works, Fee Proposal, and Terms & Conditions set out in this document.";
    const sigLines = doc.splitTextToSize(sigText, CW);
    doc.text(sigLines, ML, y);
    y += sigLines.length * 5.5 + 10;

    // Two signature blocks side by side
    const sigBoxW = (CW - 10) / 2;
    const sigBoxX2 = ML + sigBoxW + 10;

    // Left: Contractor
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.navy);
    doc.text("FOR AND ON BEHALF OF THE CONTRACTOR", ML, y);
    y += 6;
    doc.text(companyName, ML, y);
    y += 16;

    doc.setDrawColor(...C.slate700);
    doc.setLineWidth(0.5);
    doc.line(ML, y, ML + sigBoxW, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.slate500);
    doc.text("Signature", ML, y);
    y += 8;
    doc.setDrawColor(...C.slate300);
    doc.setLineWidth(0.3);
    doc.line(ML, y, ML + sigBoxW, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Print Name", ML, y);
    y += 8;
    doc.line(ML, y, ML + sigBoxW, y);
    y += 5;
    doc.text("Date", ML, y);

    // Right: Client (reset y to same row start)
    const rightStartY = y - 26 - 8 - 8 - 5 - 5 - 5 - 16 - 5 - 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.navy);
    doc.text("FOR AND ON BEHALF OF THE CLIENT", sigBoxX2, rightStartY);
    doc.text(clientName, sigBoxX2, rightStartY + 6);

    doc.setDrawColor(...C.slate700);
    doc.setLineWidth(0.5);
    doc.line(sigBoxX2, rightStartY + 22, sigBoxX2 + sigBoxW, rightStartY + 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.slate500);
    doc.text("Signature", sigBoxX2, rightStartY + 27);

    doc.setDrawColor(...C.slate300);
    doc.setLineWidth(0.3);
    doc.line(sigBoxX2, rightStartY + 35, sigBoxX2 + sigBoxW, rightStartY + 35);
    doc.text("Print Name", sigBoxX2, rightStartY + 40);

    doc.line(sigBoxX2, rightStartY + 48, sigBoxX2 + sigBoxW, rightStartY + 48);
    doc.text("Date", sigBoxX2, rightStartY + 53);

    // Small print footer
    y += 16;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.slate500);
    const smallPrint = `This Proposal was generated by ${companyName} using Constructa. Acceptance of this proposal constitutes a binding agreement to the stated terms. Ref: ${refCode}.`;
    const spLines = doc.splitTextToSize(smallPrint, CW);
    doc.text(spLines, ML, y);

    // ─── Retroactively update page numbers ───────────────────
    // (jsPDF doesn't support this natively without a second pass,
    //  but our page numbers are already accurate from totalPagesRef.n)

    const filename = `${projectName.replace(/[^a-z0-9]/gi, "_")}_Proposal_${refCode}.pdf`;
    doc.save(filename);
}
