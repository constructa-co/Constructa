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
    navy: [15, 23, 42] as [number, number, number],       // #0F172A
    slate700: [51, 65, 85] as [number, number, number],    // #334155
    slate500: [100, 116, 139] as [number, number, number], // #64748B
    slate50: [248, 250, 252] as [number, number, number],  // #F8FAFC
    slate100: [241, 245, 249] as [number, number, number], // #F1F5F9
    border: [226, 232, 240] as [number, number, number],   // #E2E8F0
    white: [255, 255, 255] as [number, number, number],
};

const PAGE_W = 210;
const PAGE_H = 297;
const ML = 14;   // margin left
const MR = 196;  // margin right
const CW = 182;  // content width

function formatGBP(n: number): string {
    return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: Date): string {
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

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
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold gap-2 shadow-lg h-12 px-6"
        >
            {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <FileDown className="w-4 h-4" />
            )}
            {generating ? "Generating..." : "Generate Proposal PDF"}
        </Button>
    );
}

// ─── Main PDF builder ─────────────────────────────────────────
async function buildProposalPDF({ estimates, project, profile, pricingMode, validityDays }: Props) {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const companyName = profile?.company_name || "CONSTRUCTA";
    const clientName = project?.client_name || "Valued Client";
    const projectName = project?.name || "Project Proposal";
    const address = project?.address || "";
    const projectType = project?.project_type || "Construction Works";
    const today = new Date();
    const validUntil = new Date(Date.now() + validityDays * 86400000);
    const refCode = (project?.id || "00000000").substring(0, 8).toUpperCase();
    const docTitle = `Proposal — ${projectName}`;

    // Track page content sections so we can add headers/footers after
    let totalPages = 1;

    // ═══════════════════════════════════════════════════════════
    // PAGE 1 — COVER PAGE
    // ═══════════════════════════════════════════════════════════

    // Dark navy top block (top 40%)
    const navyBlockH = 120;
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, PAGE_W, navyBlockH, "F");

    // Company name in white
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(...C.white);
    doc.text(companyName, ML + 4, 40);

    // Label
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 210, 230);
    doc.text("PROPOSAL & FEE PROPOSAL", ML + 4, 55);

    // Thin white separator line
    doc.setDrawColor(...C.white);
    doc.setLineWidth(0.3);
    doc.line(ML + 4, 62, 120, 62);

    // Bottom 60%: white area
    let y = navyBlockH + 20;

    // Project name (large)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(36);
    doc.setTextColor(...C.navy);
    const titleLines = doc.splitTextToSize(projectName, CW);
    doc.text(titleLines, ML, y);
    y += titleLines.length * 14 + 12;

    // PREPARED FOR label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...C.slate500);
    doc.text("PREPARED FOR:", ML, y);
    y += 8;

    // Client name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...C.navy);
    doc.text(clientName, ML, y);
    y += 8;

    // Address
    if (address) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(...C.slate700);
        const addrLines = doc.splitTextToSize(address, CW);
        doc.text(addrLines, ML, y);
        y += addrLines.length * 5 + 8;
    } else {
        y += 8;
    }

    y += 6;

    // Date issued
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...C.slate500);
    doc.text("DATE ISSUED:", ML, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...C.navy);
    doc.text(formatDate(today), ML + 30, y);
    y += 8;

    // Valid until
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...C.slate500);
    doc.text("QUOTE VALID UNTIL:", ML, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...C.navy);
    doc.text(formatDate(validUntil), ML + 38, y);

    // Reference number (bottom right)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...C.slate500);
    doc.text(`Ref: ${refCode}`, MR, PAGE_H - 25, { align: "right" });

    // Bottom border & footer
    doc.setDrawColor(...C.navy);
    doc.setLineWidth(0.5);
    doc.line(ML, PAGE_H - 18, MR, PAGE_H - 18);

    doc.setFontSize(7);
    doc.setTextColor(...C.slate500);
    doc.text(companyName, ML, PAGE_H - 12);
    doc.text("Confidential", MR, PAGE_H - 12, { align: "right" });

    // ═══════════════════════════════════════════════════════════
    // PAGE 2 — INTRODUCTION
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    totalPages++;
    y = addPageHeader(doc, companyName, docTitle, totalPages);

    // Section heading
    y = renderSectionHeading(doc, y, "Introduction");

    // Dear client letter
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C.navy);
    doc.text(`Dear ${clientName},`, ML, y);
    y += 10;

    const para1 = `Thank you for the opportunity to submit this Proposal for ${projectName} at ${address || "the project site"}. We have carefully reviewed your requirements and are pleased to present our comprehensive fee proposal for the Works described herein.`;
    const para2 = `This document sets out our Scope of Works, commercial terms, and the basis upon which we propose to undertake this project. We are committed to delivering these Works to the highest standard, on time and within budget. We look forward to working with you.`;

    y = renderBodyText(doc, y, para1);
    y += 4;
    y = renderBodyText(doc, y, para2);
    y += 12;

    // Project Overview Table
    y = renderSectionHeading(doc, y, "Project Overview");

    const overviewRows = [
        ["Project", projectName],
        ["Client", clientName],
        ["Site Address", address || "—"],
        ["Project Type", projectType],
        ["Proposed Start", "TBC — to be agreed on acceptance"],
        ["Contract Duration", "TBC — to be confirmed following acceptance"],
    ];

    autoTable(doc, {
        startY: y,
        head: [["Item", "Detail"]],
        body: overviewRows,
        theme: "plain",
        margin: { left: ML, right: PAGE_W - MR },
        headStyles: {
            fillColor: C.navy,
            textColor: C.white,
            fontStyle: "bold",
            fontSize: 9,
        },
        bodyStyles: {
            fontSize: 10,
            textColor: C.slate700,
            cellPadding: 4,
        },
        columnStyles: {
            0: { fontStyle: "bold", cellWidth: 45, textColor: C.slate500 },
        },
        alternateRowStyles: { fillColor: C.slate50 },
    });

    // ═══════════════════════════════════════════════════════════
    // PAGE 3+ — SCOPE OF WORKS
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    totalPages++;
    y = addPageHeader(doc, companyName, docTitle, totalPages);

    y = renderSectionHeading(doc, y, "Scope of Works");

    const scopeText = project?.scope_text;
    if (scopeText) {
        y = renderBodyText(doc, y, scopeText);
    } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(...C.slate500);
        doc.text("Scope to be completed in the Proposal Editor.", ML, y);
        y += 8;
    }

    // ═══════════════════════════════════════════════════════════
    // PRICING SUMMARY PAGE
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    totalPages++;
    y = addPageHeader(doc, companyName, docTitle, totalPages);

    y = renderSectionHeading(doc, y, "Fee Proposal");

    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...C.slate500);
    doc.text("All prices exclusive of VAT unless stated", ML, y);
    y += 10;

    // Calculate grand total
    const grandTotal = estimates.reduce((sum, est) => {
        const markup = 1 + ((est.profit_pct || 0) + (est.overhead_pct || 0) + (est.risk_pct || 0)) / 100;
        return sum + ((est.total_cost || 0) * markup);
    }, 0);

    if (pricingMode === "full") {
        // Full breakdown: one table per estimate
        estimates.forEach((est) => {
            const markup = 1 + ((est.profit_pct || 0) + (est.overhead_pct || 0) + (est.risk_pct || 0)) / 100;
            const estTotal = (est.total_cost || 0) * markup;
            const lines = est.estimate_lines || [];

            const bodyRows = lines.map((line: any) => {
                const desc = line.mom_item_code
                    ? `[${line.mom_item_code}] ${line.description}`
                    : line.description;
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
                head: [[
                    { content: est.version_name || "Estimate", colSpan: 5, styles: { halign: "left" as const } },
                ]],
                body: bodyRows,
                foot: [["Subtotal", "", "", "", formatGBP(estTotal)]],
                theme: "grid",
                margin: { left: ML, right: PAGE_W - MR },
                headStyles: {
                    fillColor: C.navy,
                    textColor: C.white,
                    fontStyle: "bold",
                    fontSize: 9,
                },
                bodyStyles: {
                    fontSize: 9,
                    textColor: C.slate700,
                    cellPadding: 3,
                },
                footStyles: {
                    fillColor: C.slate100,
                    textColor: C.navy,
                    fontStyle: "bold",
                    fontSize: 9,
                },
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
                didDrawPage: () => {
                    totalPages = doc.getNumberOfPages();
                },
            });

            y = (doc as any).lastAutoTable.finalY + 3;

            // Markup note
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(...C.slate500);
            doc.text(
                `Overhead: ${est.overhead_pct || 0}%  |  Profit: ${est.profit_pct || 0}%  |  Risk: ${est.risk_pct || 0}%`,
                ML,
                y
            );
            y += 10;
        });
    } else {
        // Summary mode: single table with estimates as rows
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
            headStyles: {
                fillColor: C.navy,
                textColor: C.white,
                fontStyle: "bold",
                fontSize: 9,
            },
            bodyStyles: {
                fontSize: 10,
                textColor: C.slate700,
                cellPadding: 4,
            },
            footStyles: {
                fillColor: C.navy,
                textColor: C.white,
                fontStyle: "bold",
                fontSize: 10,
            },
            columnStyles: {
                1: { halign: "right" as const, cellWidth: 45 },
            },
            alternateRowStyles: { fillColor: C.slate50 },
            tableLineColor: C.border,
            tableLineWidth: 0.2,
            didDrawPage: () => {
                totalPages = doc.getNumberOfPages();
            },
        });

        y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Grand total box (full mode)
    if (pricingMode === "full") {
        // Check for page break
        if (y + 20 > PAGE_H - 30) {
            doc.addPage();
            totalPages++;
            y = addPageHeader(doc, companyName, docTitle, totalPages);
        }

        doc.setFillColor(...C.navy);
        doc.rect(ML, y, CW, 14, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...C.white);
        doc.text("TOTAL CONTRACT SUM (EXC. VAT):", ML + 4, y + 9);
        doc.text(formatGBP(grandTotal), MR - 4, y + 9, { align: "right" });
        y += 22;
    }

    // Validity statement
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...C.slate500);
    const validityText = `This Proposal is valid for ${validityDays} days from the date of issue (${formatDate(today)}). After this period, rates may be subject to review.`;
    const validityLines = doc.splitTextToSize(validityText, CW);
    doc.text(validityLines, ML, y);

    // ═══════════════════════════════════════════════════════════
    // EXCLUSIONS & CLARIFICATIONS
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    totalPages++;
    y = addPageHeader(doc, companyName, docTitle, totalPages);

    y = renderSectionHeading(doc, y, "Exclusions & Clarifications");

    if (project?.exclusions_text) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...C.navy);
        doc.text("EXCLUSIONS — The following items are expressly excluded from this Proposal:", ML, y);
        y += 8;

        const exclItems = project.exclusions_text.split("\n").filter((s: string) => s.trim());
        exclItems.forEach((item: string) => {
            if (y + 8 > PAGE_H - 25) {
                doc.addPage();
                totalPages++;
                y = addPageHeader(doc, companyName, docTitle, totalPages);
            }
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(...C.slate700);
            const bulletLines = doc.splitTextToSize(`•  ${item.trim()}`, CW - 6);
            doc.text(bulletLines, ML + 4, y);
            y += bulletLines.length * 5 + 2;
        });
        y += 8;
    }

    if (project?.clarifications_text) {
        if (y + 20 > PAGE_H - 25) {
            doc.addPage();
            totalPages++;
            y = addPageHeader(doc, companyName, docTitle, totalPages);
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...C.navy);
        doc.text("CLARIFICATIONS & ASSUMPTIONS", ML, y);
        y += 8;

        const clarItems = project.clarifications_text.split("\n").filter((s: string) => s.trim());
        clarItems.forEach((item: string) => {
            if (y + 8 > PAGE_H - 25) {
                doc.addPage();
                totalPages++;
                y = addPageHeader(doc, companyName, docTitle, totalPages);
            }
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(...C.slate700);
            const bulletLines = doc.splitTextToSize(`•  ${item.trim()}`, CW - 6);
            doc.text(bulletLines, ML + 4, y);
            y += bulletLines.length * 5 + 2;
        });
    }

    // ═══════════════════════════════════════════════════════════
    // SITE VISIT & PROJECT CONCEPTS (Photos Placeholder)
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    totalPages++;
    y = addPageHeader(doc, companyName, docTitle, totalPages);

    y = renderSectionHeading(doc, y, "Site Visit & Project Concepts");

    const introText = "Photographs and concept visuals captured during the site visit are included below. AI-assisted concept overlays showing proposed works will be available in a future update.";
    y = renderBodyText(doc, y, introText);
    y += 6;

    // 2x2 grid of placeholder boxes
    const boxW = 80;
    const boxH = 60;
    const gap = 10;
    const startX1 = ML + 2;
    const startX2 = ML + boxW + gap + 2;

    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
            const bx = col === 0 ? startX1 : startX2;
            const by = y + row * (boxH + gap);

            doc.setFillColor(...C.slate100);
            doc.rect(bx, by, boxW, boxH, "F");

            doc.setDrawColor(...C.border);
            doc.setLineWidth(0.5);
            // Dashed border effect: draw the rect outline
            doc.setLineDashPattern([3, 2], 0);
            doc.rect(bx, by, boxW, boxH, "S");
            doc.setLineDashPattern([], 0); // reset

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(148, 163, 184); // slate-400
            doc.text("Photo Placeholder", bx + boxW / 2, by + boxH / 2, { align: "center" });
        }
    }

    y += 2 * boxH + gap + 12;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...C.slate500);
    doc.text("Upload site photos via the Project Settings page (coming soon).", ML, y);

    // ═══════════════════════════════════════════════════════════
    // TERMS & CONDITIONS
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    totalPages++;
    y = addPageHeader(doc, companyName, docTitle, totalPages);

    y = renderSectionHeading(doc, y, "Terms & Conditions of Contract");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...C.slate700);
    const tcIntro = "The following Terms & Conditions apply to this Proposal and any resulting Contract. A full form of Agreement will be issued upon acceptance. This Proposal does not constitute a Contract until signed by both parties.";
    const tcIntroLines = doc.splitTextToSize(tcIntro, CW);
    doc.text(tcIntroLines, ML, y);
    y += tcIntroLines.length * 4.5 + 6;

    const tcClauses = [
        ["1 — Jurisdiction", "The law of Contract is the Law of England and Wales. The Language of this Contract is English. All acts stated within these Terms & Conditions are obligatory unless the term 'may' is used."],
        ["2 — Responsibilities", "The Works are detailed within the Scope of Works attached to this Proposal. All Works are to meet Statutory Requirements, including all applicable British and European Standards, and industry best practices."],
        ["3 — Alternative Dispute Resolution", "Should any dispute arise which cannot be resolved by negotiation, escalation shall be via Adjudication. The Adjudicating Nominated Body is the Royal Institute of Chartered Surveyors (RICS), under the RICS Homeowner Adjudication Scheme. The Adjudicator's name shall be determined by the President of the RICS and a determination issued within 21 Calendar days of appointment."],
        ["4 — Liability", "The Defect Liability Period is 12 months from the date of Completion Certificate. Any Defects notified within the Defect Period are to be promptly rectified by the Contractor. The Contractor's obligations extend to future owners of the property in accordance with the Contracts (Rights of Third Parties) Act 1999."],
        ["5 — Workmanship", "All Works are to be performed using reasonable skill and care to that of a competent Contractor with experience on projects of similar size and scope. Works are to be completed by the Contractor and not Sub-Contractors unless authorised in writing."],
        ["6 — Insurances", "The Contractor shall maintain throughout the Works: Public Liability Insurance; Employers Liability Insurance; Contractors All Risk Insurance. Evidence of current policies available on request."],
        ["7 — Payments", "Payment dates are 21 Calendar days from receipt of Application. Any deductions by the Client must be formally notified as a 'Pay-Less-Notice' no later than 7 days following receipt of Application. Late payments shall incur interest under the Late Payment of Commercial Debts (Interest) Act 1998 at 8% above Bank of England base rate."],
        ["8 — Change Management", "Any Variations to the Scope must be issued in writing. The Contractor will respond within 7 Calendar days with any Cost and/or Time implications. Variations may include omissions as well as additions to Scope."],
        ["9 — Health, Safety & CDM", "The Client is a Domestic Client under the Construction Design Management (CDM) Regulations 2015. The Contractor shall act as Principal Contractor and comply with all CDM requirements and the Health and Safety at Work Act 1974."],
    ];

    autoTable(doc, {
        startY: y,
        head: [["Clause", "Detail"]],
        body: tcClauses,
        theme: "grid",
        margin: { left: ML, right: PAGE_W - MR },
        headStyles: {
            fillColor: C.navy,
            textColor: C.white,
            fontStyle: "bold",
            fontSize: 9,
        },
        bodyStyles: {
            fontSize: 9,
            textColor: C.slate700,
            cellPadding: 4,
        },
        columnStyles: {
            0: { cellWidth: 40, fontStyle: "bold", textColor: C.navy },
        },
        alternateRowStyles: { fillColor: C.slate50 },
        tableLineColor: C.border,
        tableLineWidth: 0.2,
        didDrawPage: () => {
            totalPages = doc.getNumberOfPages();
        },
    });

    // ═══════════════════════════════════════════════════════════
    // SIGNATURE & ACCEPTANCE PAGE
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    totalPages++;
    y = addPageHeader(doc, companyName, docTitle, totalPages);

    y = renderSectionHeading(doc, y, "Acceptance of Proposal");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...C.slate700);
    const acceptText = "I/We hereby accept the Scope of Works, Fee Proposal, and Terms & Conditions as set out in this document and authorise the Contractor to proceed on this basis.";
    const acceptLines = doc.splitTextToSize(acceptText, CW);
    doc.text(acceptLines, ML, y);
    y += acceptLines.length * 5 + 16;

    // Two signature blocks side by side
    const col1X = ML;
    const col2X = ML + 96;
    const sigBlockW = 82;

    // Left: Contractor
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.navy);
    doc.text(`Signed for and on behalf of`, col1X, y);
    doc.text(companyName || "The Contractor", col1X, y + 5);
    y += 16;

    const sigY = y;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...C.slate500);
    doc.text("Name:", col1X, sigY);
    doc.setDrawColor(...C.border);
    doc.line(col1X + 14, sigY, col1X + sigBlockW, sigY);

    doc.text("Position:", col1X, sigY + 12);
    doc.line(col1X + 18, sigY + 12, col1X + sigBlockW, sigY + 12);

    doc.text("Date:", col1X, sigY + 24);
    doc.line(col1X + 14, sigY + 24, col1X + sigBlockW, sigY + 24);

    // Right: Client
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.navy);
    doc.text(`Signed for and on behalf of`, col2X, y - 16);
    doc.text(clientName || "The Client", col2X, y - 11);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.slate500);
    doc.text("Name:", col2X, sigY);
    doc.line(col2X + 14, sigY, col2X + sigBlockW, sigY);

    doc.text("Date:", col2X, sigY + 12);
    doc.line(col2X + 14, sigY + 12, col2X + sigBlockW, sigY + 12);

    y = sigY + 40;

    // Bottom footer
    doc.setDrawColor(...C.navy);
    doc.setLineWidth(0.5);
    doc.line(ML, y, MR, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.slate500);
    doc.text(`${companyName}  |  This document is confidential and prepared exclusively for ${clientName}  |  ${formatDate(today)}`, ML, y);

    // ═══════════════════════════════════════════════════════════
    // ADD HEADERS & FOOTERS TO ALL PAGES EXCEPT PAGE 1
    // ═══════════════════════════════════════════════════════════
    totalPages = doc.getNumberOfPages();

    for (let i = 2; i <= totalPages; i++) {
        doc.setPage(i);

        // Top header band
        doc.setFillColor(...C.navy);
        doc.rect(0, 0, PAGE_W, 10, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...C.white);
        doc.text(companyName, ML, 7);
        doc.text(docTitle, PAGE_W / 2, 7, { align: "center" });
        doc.text(`${i}`, MR, 7, { align: "right" });

        // Bottom footer
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.3);
        doc.line(ML, PAGE_H - 12, MR, PAGE_H - 12);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...C.slate500);
        doc.text(`Constructa  |  ${companyName}  |  Page ${i} of ${totalPages}`, ML, PAGE_H - 7);
    }

    // ═══════════════════════════════════════════════════════════
    // SAVE
    // ═══════════════════════════════════════════════════════════
    const fileName = `PROPOSAL-${projectName.replace(/\s+/g, "_")}-${formatDate(today).replace(/\s+/g, "_")}.pdf`;
    doc.save(fileName);
}

// ─── Helper: Add page header (returns Y for content start) ───
function addPageHeader(doc: jsPDF, _companyName: string, _docTitle: string, _pageNum: number): number {
    // The actual header band is painted in the final loop.
    // We just return the starting Y below the header area.
    return 18;
}

// ─── Helper: Section heading with navy left border accent ────
function renderSectionHeading(doc: jsPDF, y: number, title: string): number {
    // Navy left border accent
    doc.setFillColor(...C.navy);
    doc.rect(ML, y - 4, 3, 10, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...C.navy);
    doc.text(title, ML + 7, y + 3);

    return y + 14;
}

// ─── Helper: Body text block ────────────────────────────────
function renderBodyText(doc: jsPDF, y: number, text: string): number {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...C.slate700);
    const lines = doc.splitTextToSize(text, CW);
    lines.forEach((line: string) => {
        if (y + 6 > PAGE_H - 25) {
            doc.addPage();
            y = 18;
        }
        doc.text(line, ML, y);
        y += 5.5;
    });
    return y + 2;
}
