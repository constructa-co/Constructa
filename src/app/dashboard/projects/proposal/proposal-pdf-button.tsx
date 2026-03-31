"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { extractScopeBulletsAction } from "./actions";

interface Props {
    estimates: any[];
    project: any;
    profile: any;
    pricingMode: "full" | "summary";
    validityDays: number;
}

// ─── Theme system ────────────────────────────────────────────
interface ThemeColors {
    primary: [number, number, number];
    primaryLight: [number, number, number];
    primaryMid: [number, number, number];
    accent: [number, number, number];
    accentText: [number, number, number];
    white: [number, number, number];
    surface: [number, number, number];
    surfaceMid: [number, number, number];
    borderLight: [number, number, number];
    textDark: [number, number, number];
    textMid: [number, number, number];
    textLight: [number, number, number];
    muted: [number, number, number];
}

function getTheme(themeName?: string): ThemeColors {
    switch (themeName) {
        case 'navy':
            return {
                primary:      [10, 22, 40],
                primaryLight: [18, 38, 68],
                primaryMid:   [30, 55, 95],
                accent:       [201, 168, 76],
                accentText:   [201, 168, 76],
                white:        [255, 255, 255],
                surface:      [248, 248, 248],
                surfaceMid:   [240, 240, 240],
                borderLight:  [220, 220, 220],
                textDark:     [20, 20, 20],
                textMid:      [80, 80, 80],
                textLight:    [130, 130, 130],
                muted:        [160, 155, 140],
            };
        case 'forest':
            return {
                primary:      [26, 58, 42],
                primaryLight: [38, 78, 58],
                primaryMid:   [55, 105, 80],
                accent:       [232, 224, 208],
                accentText:   [232, 224, 208],
                white:        [255, 255, 255],
                surface:      [250, 249, 246],
                surfaceMid:   [242, 238, 230],
                borderLight:  [218, 212, 198],
                textDark:     [20, 20, 15],
                textMid:      [75, 72, 60],
                textLight:    [128, 122, 108],
                muted:        [180, 174, 158],
            };
        default: // 'slate'
            return {
                primary:      [13, 13, 13],
                primaryLight: [26, 26, 26],
                primaryMid:   [42, 42, 42],
                accent:       [255, 255, 255],
                accentText:   [255, 255, 255],
                white:        [255, 255, 255],
                surface:      [248, 248, 248],
                surfaceMid:   [240, 240, 240],
                borderLight:  [220, 220, 220],
                textDark:     [20, 20, 20],
                textMid:      [80, 80, 80],
                textLight:    [130, 130, 130],
                muted:        [160, 160, 160],
            };
    }
}

const GANTT_COLORS: Record<string, [number, number, number]> = {
    blue: [59, 130, 246],
    green: [34, 197, 94],
    orange: [249, 115, 22],
    purple: [168, 85, 247],
    slate: [100, 116, 139],
    red: [239, 68, 68],
    teal: [20, 184, 166],
};

const PAGE_W = 210;
const PAGE_H = 297;
const ML = 14;
const MR = 196;
const CW = 182;
const HEADER_H = 12;
const FOOTER_H = 10;
const CONTENT_TOP = HEADER_H + 8;
const CONTENT_BOTTOM = PAGE_H - FOOTER_H - 6;

let sectionCounter = 0;

function formatGBP(n: number): string {
    return "\u00A3" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: Date): string {
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function sanitiseText(text: string): string {
    return text
        .replace(/[^\x20-\x7E\n]/g, '')
        .replace(/●/g, '-')
        .replace(/•/g, '-')
        .trim();
}

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

function addPageHeader(doc: jsPDF, companyName: string, docTitle: string, pageNum: number, totalPagesRef: { n: number }, T: ThemeColors): number {
    doc.setFillColor(...T.primary);
    doc.rect(0, 0, PAGE_W, HEADER_H, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...T.accent);
    doc.text(companyName.toUpperCase(), ML, 7.5);
    doc.text(docTitle, PAGE_W / 2, 7.5, { align: "center" });
    doc.setTextColor(...T.muted);
    doc.text(`${pageNum}`, MR, 7.5, { align: "right" });

    doc.setDrawColor(...T.borderLight);
    doc.setLineWidth(0.2);
    doc.line(ML, PAGE_H - FOOTER_H, MR, PAGE_H - FOOTER_H);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...T.textLight);
    doc.text(`Page ${pageNum} | ${companyName} | Confidential`, PAGE_W / 2, PAGE_H - 4, { align: "center" });

    return CONTENT_TOP;
}

function renderSectionHeading(doc: jsPDF, y: number, text: string, T: ThemeColors): number {
    const num = String(sectionCounter).padStart(2, "0");
    sectionCounter++;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...T.muted);
    doc.text(num, ML, y + 5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...T.textDark);
    doc.text(text, ML + 10, y + 7);

    doc.setDrawColor(...T.primary);
    doc.setLineWidth(0.5);
    doc.line(ML, y + 11, ML + 30, y + 11);

    return y + 22;
}

function renderBodyText(doc: jsPDF, y: number, text: string, T: ThemeColors, maxWidth = CW, x = ML): number {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...T.textDark);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return y + lines.length * 5.8;
}

function ensureSpace(doc: jsPDF, y: number, needed: number, companyName: string, docTitle: string, totalPagesRef: { n: number }, T: ThemeColors): number {
    if (y + needed > CONTENT_BOTTOM) {
        doc.addPage();
        totalPagesRef.n++;
        return addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef, T);
    }
    return y;
}

// ─── Main PDF builder ─────────────────────────────────────────
async function buildProposalPDF({ estimates, project, profile, pricingMode, validityDays }: Props) {
    sectionCounter = 1;
    const T = getTheme(profile?.pdf_theme);
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const companyName = profile?.company_name || "The Contractor";
    const clientName = project?.client_name || "Valued Client";
    const projectName = project?.name || "Project Proposal";
    const normaliseAddress = (addr: string) => addr
        ? addr.replace(/,\s*/g, "\n").replace(/\n+/g, "\n").trim()
        : "";
    const address = normaliseAddress(project?.site_address || project?.client_address || "");
    const clientAddress = normaliseAddress(project?.client_address || project?.site_address || "");
    const projectType = project?.project_type || "Construction Works";
    const today = new Date();
    const validUntil = new Date(Date.now() + validityDays * 86400000);
    const refCode = (project?.id || "00000000").substring(0, 8).toUpperCase();
    const docTitle = `Proposal \u2014 ${projectName}`;
    const totalPagesRef = { n: 1 };

    // Use active estimate if one is marked, otherwise use all estimates
    const activeEstimate = estimates.find((est: any) => est.is_active);
    const pdfEstimates = activeEstimate ? [activeEstimate] : estimates;

    const grandTotal = pdfEstimates.reduce((sum: number, est: any) => {
        const markup = 1 + ((est.profit_pct || 0) + (est.overhead_pct || 0) + (est.risk_pct || 0)) / 100;
        return sum + ((est.total_cost || 0) * markup);
    }, 0);

    const displayTotal = grandTotal > 0 ? grandTotal : (project?.potential_value || project?.contract_value || 0);
    const contractValue = project?.potential_value || grandTotal || 0;

    // Extract scope bullets via AI if scope text is substantial
    let scopeBullets: string[] = [];
    if (project?.scope_text && project.scope_text.length > 100) {
        try {
            scopeBullets = await extractScopeBulletsAction(project.scope_text);
        } catch {
            scopeBullets = [];
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PAGE 1 — COVER PAGE
    // ═══════════════════════════════════════════════════════════

    doc.setFillColor(...T.primary);
    doc.rect(0, 0, PAGE_W, PAGE_H, "F");

    let y = 15;

    // Company logo or name (centered, white pill box)
    let logoLoaded = false;
    if (profile?.logo_url) {
        try {
            doc.setFillColor(...T.white);
            doc.roundedRect(PAGE_W / 2 - 37, y, 74, 27, 3, 3, "F");
            const logoExt = profile.logo_url.split(".").pop()?.toLowerCase() || "png";
            const logoFormat = logoExt === "jpg" || logoExt === "jpeg" ? "JPEG" : "PNG";
            doc.addImage(profile.logo_url, logoFormat, PAGE_W / 2 - 34, y + 1, 68, 25);
            logoLoaded = true;
            y += 35;
        } catch {
            logoLoaded = false;
        }
    }
    if (!logoLoaded) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(32);
        doc.setTextColor(...T.white);
        doc.text(companyName.toUpperCase(), PAGE_W / 2, y + 12, { align: "center" });
        y += 22;
    }

    // Thin accent rule
    doc.setDrawColor(...T.accent);
    doc.setLineWidth(0.5);
    doc.line(ML + 20, y, MR - 20, y);
    y += 8;

    // "PROPOSAL & FEE PROPOSAL" label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...T.muted);
    doc.text("PROPOSAL & FEE PROPOSAL", PAGE_W / 2, y, { align: "center" });
    y += 6;

    // Center: project name
    y = 110;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(42);
    doc.setTextColor(...T.white);
    const titleLines = doc.splitTextToSize(projectName, CW - 20);
    const titleLineH = 14;
    titleLines.forEach((line: string, i: number) => {
        doc.text(line, PAGE_W / 2, y + i * titleLineH, { align: "center" });
    });
    y += titleLines.length * titleLineH + 10;

    // "Prepared exclusively for"
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...T.muted);
    doc.text("Prepared exclusively for", PAGE_W / 2, y, { align: "center" });
    y += 8;

    // Client name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...T.white);
    doc.text(clientName, PAGE_W / 2, y, { align: "center" });
    y += 8;

    // Client address
    if (clientAddress) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...T.muted);
        const addrLines = doc.splitTextToSize(clientAddress, 120);
        addrLines.forEach((line: string, i: number) => {
            doc.text(line, PAGE_W / 2, y + i * 5.5, { align: "center" });
        });
        y += addrLines.length * 5.5 + 4;
    }

    // Bottom info strip — horizontal rule + 4 inline stats
    const infoY = 225;
    doc.setDrawColor(...T.accent);
    doc.setLineWidth(0.3);
    doc.line(ML, infoY, MR, infoY);

    const statCols = [
        { label: "DATE ISSUED", value: formatDate(today) },
        { label: "VALID UNTIL", value: formatDate(validUntil) },
        { label: "REFERENCE", value: refCode },
        ...(displayTotal > 0 ? [{ label: "CONTRACT VALUE", value: formatGBP(displayTotal) }] : []),
    ];
    const colW = CW / statCols.length;
    statCols.forEach((stat, i) => {
        const sx = ML + i * colW;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(...T.muted);
        doc.text(stat.label, sx, infoY + 7);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...T.accent);
        doc.text(stat.value, sx, infoY + 13);
    });

    // Very bottom
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...T.accent);
    doc.text(companyName, ML, 284);
    if (profile?.website) {
        doc.text(profile.website, MR, 284, { align: "right" });
    } else {
        doc.text("Confidential", MR, 284, { align: "right" });
    }

    // ═══════════════════════════════════════════════════════════
    // PAGE 2 — ABOUT US
    // ═══════════════════════════════════════════════════════════
    if (profile?.capability_statement) {
        doc.addPage();
        totalPagesRef.n++;
        y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef, T);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(26);
        doc.setTextColor(...T.textDark);
        doc.text(`About ${companyName}`, ML, y + 8);
        doc.setDrawColor(...T.primary);
        doc.setLineWidth(0.3);
        doc.line(ML, y + 12, ML + 40, y + 12);
        y += 22;

        const leftW = CW * 0.55;
        const rightW = CW * 0.43;
        const rightX = ML + leftW + CW * 0.02;
        let leftY = y;
        let rightY = y;

        // Left column — capability statement
        const capText = sanitiseText(profile.capability_statement);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...T.textDark);
        const capLines = doc.splitTextToSize(capText, leftW);
        doc.text(capLines, ML, leftY);
        leftY += capLines.length * 5.5 + 8;

        // Specialisms as pill badges
        if (profile.specialisms) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(...T.textDark);
            doc.text("Specialisms", ML, leftY);
            leftY += 7;

            const specs = sanitiseText(profile.specialisms).split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
            let badgeX = ML;
            specs.forEach((spec: string) => {
                const badgeW = doc.getTextWidth(spec) + 8;
                if (badgeX + badgeW > ML + leftW) {
                    badgeX = ML;
                    leftY += 9;
                }
                doc.setFillColor(...T.primaryLight);
                doc.roundedRect(badgeX, leftY - 4.5, badgeW, 7, 1.5, 1.5, "F");
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(...T.accent);
                doc.text(spec, badgeX + 4, leftY);
                badgeX += badgeW + 3;
            });
            leftY += 14;
        }

        // Years trading badge
        if (profile.years_trading) {
            const badge = `Est. ${profile.years_trading} years trading`;
            const badgeW = doc.getTextWidth(badge) + 8;
            doc.setFillColor(...T.surfaceMid);
            doc.roundedRect(ML, leftY, badgeW, 8, 2, 2, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(...T.textDark);
            doc.text(badge, ML + 4, leftY + 5.5);
            leftY += 14;
        }

        // Right column — Contact info box
        const contactRows: string[][] = [];
        if (profile.phone) contactRows.push(["Phone", profile.phone]);
        if (profile.website) contactRows.push(["Website", profile.website]);
        if (profile.address) contactRows.push(["Address", profile.address]);
        if (profile.company_number) contactRows.push(["Company Reg.", profile.company_number]);
        if (profile.vat_number) contactRows.push(["VAT Number", profile.vat_number]);

        if (contactRows.length > 0) {
            doc.setFillColor(...T.white);
            doc.roundedRect(rightX, rightY, rightW, contactRows.length * 10 + 8, 3, 3, "F");
            doc.setDrawColor(...T.borderLight);
            doc.setLineWidth(0.3);
            doc.roundedRect(rightX, rightY, rightW, contactRows.length * 10 + 8, 3, 3, "S");
            rightY += 7;
            contactRows.forEach(([label, val]) => {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(7.5);
                doc.setTextColor(...T.textMid);
                doc.text(label, rightX + 4, rightY + 4);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
                doc.setTextColor(...T.textDark);
                const valLines = doc.splitTextToSize(val, rightW - 30);
                doc.text(valLines[0], rightX + 28, rightY + 4);
                rightY += 9;
            });
            rightY += 6;
        }

        // Accreditations box
        if (profile.accreditations) {
            rightY += 4;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(...T.textDark);
            doc.text("Accreditations", rightX, rightY);
            rightY += 6;

            const accreds = sanitiseText(profile.accreditations).split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
            accreds.forEach((acc: string) => {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(...T.textDark);
                doc.text(`-  ${acc}`, rightX, rightY);
                rightY += 6;
            });
        }

        y = Math.max(leftY, rightY) + 8;
    }

    // ═══════════════════════════════════════════════════════════
    // PAGE 3 — CASE STUDIES
    // ═══════════════════════════════════════════════════════════
    const selectedIds: (number | string)[] = project?.selected_case_study_ids || [];
    const allCaseStudies = profile?.case_studies || [];
    const caseStudies = selectedIds.length > 0
        ? allCaseStudies.filter((_cs: any, i: number) => selectedIds.includes(i))
        : allCaseStudies;
    if (caseStudies.length > 0) {
        for (let ci = 0; ci < caseStudies.length; ci++) {
            const cs = caseStudies[ci];
            if (!cs.projectName) continue;

            doc.addPage();
            totalPagesRef.n++;

            // Top band
            const bandH = PAGE_H * 0.36;
            doc.setFillColor(...T.primary);
            doc.rect(0, 0, PAGE_W, bandH, "F");

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(...T.muted);
            doc.text(`OUR WORK  \u2014  ${String(ci + 1).padStart(2, "0")} / ${String(caseStudies.filter((c: any) => c.projectName).length).padStart(2, "0")}`, ML, 10);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(...T.muted);
            doc.text(companyName.toUpperCase(), MR, 10, { align: "right" });

            const csTitleY = bandH * 0.42;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(32);
            doc.setTextColor(...T.white);
            const csTitleLines = doc.splitTextToSize(cs.projectName, CW);
            doc.text(csTitleLines, ML, csTitleY);

            const subParts = [cs.location, cs.client].filter(Boolean);
            if (subParts.length > 0) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(10);
                doc.setTextColor(...T.muted);
                doc.text(subParts.join("  |  "), ML, csTitleY + csTitleLines.length * 10 + 4);
            }

            // Stat pills
            const statItems = [
                cs.projectType   && { label: "TYPE", value: cs.projectType },
                cs.contractValue && { label: "VALUE", value: `\u00A3${Number(cs.contractValue).toLocaleString("en-GB")}` },
                cs.programmeDuration && { label: "PROGRAMME", value: cs.programmeDuration },
                cs.client        && { label: "CLIENT", value: cs.client },
            ].filter(Boolean) as { label: string; value: string }[];

            const pillY = bandH - 19;
            const pillH = 15;
            const pillGap = 4;
            let pillX = ML;
            statItems.forEach(stat => {
                const valW = doc.getTextWidth(stat.value);
                const lblW = doc.getTextWidth(stat.label);
                const pW = Math.max(valW, lblW) + 10;
                doc.setFillColor(...T.primaryMid);
                doc.roundedRect(pillX, pillY, pW, pillH, 2, 2, "F");
                doc.setFont("helvetica", "normal");
                doc.setFontSize(7);
                doc.setTextColor(...T.muted);
                doc.text(stat.label, pillX + 5, pillY + 5);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.setTextColor(...T.accent);
                doc.text(stat.value, pillX + 5, pillY + 12);
                pillX += pW + pillGap;
            });

            // White content area
            let cy = bandH + 14;

            // Photos
            const photos = (cs.photos || []).filter((p: string) => p);
            if (photos.length > 0) {
                const numPhotos = Math.min(photos.length, 3);
                const photoGap = 4;
                const totalGap = photoGap * (numPhotos - 1);
                const photoW = (CW - totalGap) / numPhotos;
                const photoH = photoW * 0.62;
                let px = ML;

                for (let pi = 0; pi < numPhotos; pi++) {
                    const photoUrl = photos[pi];
                    try {
                        const imgExt = photoUrl.split(".").pop()?.toLowerCase() || "jpg";
                        const imgFmt = imgExt === "png" ? "PNG" : "JPEG";
                        doc.addImage(photoUrl, imgFmt, px, cy, photoW, photoH);
                    } catch {
                        doc.setFillColor(...T.surfaceMid);
                        doc.rect(px, cy, photoW, photoH, "F");
                        doc.setFont("helvetica", "normal");
                        doc.setFontSize(7);
                        doc.setTextColor(...T.muted);
                        doc.text("Photo", px + photoW / 2, cy + photoH / 2, { align: "center" });
                    }
                    px += photoW + photoGap;
                }
                cy += photoH + 10;
            }

            // Two-column narrative
            const csColGap = 8;
            const csColW = (CW - csColGap) / 2;
            const csCol2X = ML + csColW + csColGap;
            let col1Y = cy;
            let col2Y = cy;

            if (cs.whatWeDelivered) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.setTextColor(...T.primary);
                doc.text("WHAT WE DELIVERED", ML, col1Y);
                col1Y += 1.5;
                doc.setDrawColor(...T.primary);
                doc.setLineWidth(0.5);
                doc.line(ML, col1Y, ML + 30, col1Y);
                col1Y += 5;

                doc.setFont("helvetica", "normal");
                doc.setFontSize(9.5);
                doc.setTextColor(...T.textDark);
                const wdLines = doc.splitTextToSize(cs.whatWeDelivered, csColW);
                doc.text(wdLines, ML, col1Y);
                col1Y += wdLines.length * 5 + 6;
            }

            if (cs.valueAdded) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.setTextColor(...T.primary);
                doc.text("VALUE ADDED", csCol2X, col2Y);
                col2Y += 1.5;
                doc.setDrawColor(...T.primary);
                doc.setLineWidth(0.5);
                doc.line(csCol2X, col2Y, csCol2X + 30, col2Y);
                col2Y += 5;

                const vaLines = doc.splitTextToSize(cs.valueAdded, csColW - 8);
                const vaBoxH = vaLines.length * 5 + 10;
                doc.setFillColor(...T.surface);
                doc.rect(csCol2X, col2Y, csColW, vaBoxH, "F");
                doc.setFillColor(...T.primaryMid);
                doc.rect(csCol2X, col2Y, 2.5, vaBoxH, "F");

                doc.setFont("helvetica", "italic");
                doc.setFontSize(9.5);
                doc.setTextColor(...T.textMid);
                doc.text(vaLines, csCol2X + 6, col2Y + 6);
                col2Y += vaBoxH + 6;
            }

            cy = Math.max(col1Y, col2Y);

            // Footer bar
            doc.setFillColor(...T.primary);
            doc.rect(0, PAGE_H - 10, PAGE_W, 10, "F");
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(...T.accent);
            doc.text(companyName, ML, PAGE_H - 3.5);
            doc.text(docTitle, PAGE_W / 2, PAGE_H - 3.5, { align: "center" });
            doc.text(String(totalPagesRef.n), MR, PAGE_H - 3.5, { align: "right" });
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PAGE 4 — SCOPE + SITE PHOTOS (two-column)
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    totalPagesRef.n++;
    y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef, T);

    // Full-width section heading for the page
    y = renderSectionHeading(doc, y, "Project Brief & Scope", T);

    // Left column (55%) — Project Brief
    const leftColW = CW * 0.55;
    const rightColW = CW * 0.42;
    const rightColX = ML + leftColW + CW * 0.03;
    const columnStartY = y;
    let leftY = columnStartY;
    let rightY = columnStartY;

    // Left: inline sub-label "Project Brief"
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...T.textDark);
    doc.text("Project Brief", ML, leftY);
    leftY += 2;
    doc.setDrawColor(...T.primary);
    doc.setLineWidth(0.5);
    doc.line(ML, leftY, ML + 30, leftY);
    leftY += 8;

    // Introduction sub-heading
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...T.textDark);
    doc.text("Introduction", ML, leftY);
    leftY += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...T.textDark);
    doc.text(`Dear ${clientName},`, ML, leftY);
    leftY += 7;

    if (project?.proposal_introduction) {
        leftY = renderBodyText(doc, leftY, project.proposal_introduction, T, leftColW);
    } else {
        const para1 = `Thank you for the opportunity to submit this Proposal for ${projectName} at ${address || "the project site"}. We have carefully reviewed your requirements and are pleased to present our comprehensive fee proposal for the Works described herein.`;
        const para2 = `This document sets out our Scope of Works, commercial terms, and the basis upon which we propose to undertake this project. We are committed to delivering these Works to the highest standard, on time and within budget.`;
        leftY = renderBodyText(doc, leftY, para1, T, leftColW);
        leftY += 3;
        leftY = renderBodyText(doc, leftY, para2, T, leftColW);
    }
    leftY += 8;

    // Project Overview sub-heading
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...T.textDark);
    doc.text("Project Overview", ML, leftY);
    leftY += 7;

    const startDate = project?.start_date
        ? formatDate(new Date(project.start_date))
        : "TBC";

    const overviewData = [
        ["Project", projectName],
        ["Client", clientName],
        ["Site Address", address || "\u2014"],
        ["Project Type", projectType],
        ["Proposed Start", startDate],
        ...(displayTotal > 0 ? [["Contract Sum", formatGBP(displayTotal)]] : []),
    ];

    overviewData.forEach(([label, value], idx) => {
        // Light rule between rows
        if (idx > 0) {
            doc.setDrawColor(...T.borderLight);
            doc.setLineWidth(0.2);
            doc.line(ML, leftY - 1, ML + leftColW, leftY - 1);
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...T.textMid);
        doc.text(label, ML, leftY + 3);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...T.textDark);
        const valLines = doc.splitTextToSize(value, leftColW - 40);
        doc.text(valLines[0], ML + 38, leftY + 3);
        leftY += 7;
    });

    // Right column — inline sub-label "Scope of Works"
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...T.textDark);
    doc.text("Scope of Works", rightColX, rightY);
    rightY += 2;
    doc.setDrawColor(...T.primary);
    doc.setLineWidth(0.5);
    doc.line(rightColX, rightY, rightColX + 30, rightY);
    rightY += 8;

    if (scopeBullets.length > 0) {
        scopeBullets.forEach((bullet: string) => {
            // Draw a small filled square as bullet (avoids unicode issues)
            doc.setFillColor(...T.primary);
            doc.rect(rightColX, rightY - 2.5, 2.5, 2.5, 'F');
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...T.textDark);
            const bulletLines = doc.splitTextToSize(bullet, rightColW - 8);
            doc.text(bulletLines, rightColX + 5, rightY);
            rightY += bulletLines.length * 5.5;
        });
    } else if (project?.scope_text) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...T.textDark);
        const scopeLines = doc.splitTextToSize(project.scope_text, rightColW);
        doc.text(scopeLines, rightColX, rightY);
        rightY += scopeLines.length * 4.8;
    } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(...T.textMid);
        doc.text("Scope to be completed in the Proposal Editor.", rightColX, rightY);
        rightY += 8;
    }

    // Site photos in right column
    const sitePhotos: any[] = project?.site_photos || project?.photos || [];
    const hasPhotos = sitePhotos.some((p: any) => p.url || (typeof p === 'string' && p));

    if (hasPhotos) {
        rightY += 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...T.textMid);
        doc.text("SITE PHOTOGRAPHS", rightColX, rightY);
        rightY += 4;

        const photosToRender = sitePhotos.filter((p: any) => p.url || (typeof p === 'string' && p)).slice(0, 4);
        const photoColW = (rightColW - 4) / 2;
        const photoH = photoColW * 0.625; // ~16:10

        for (let i = 0; i < photosToRender.length; i++) {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const px = rightColX + col * (photoColW + 4);
            const py = rightY + row * (photoH + 4);

            if (py + photoH > CONTENT_BOTTOM) break;

            const photo = photosToRender[i];
            const photoUrl = photo.url || photo;
            try {
                doc.addImage(photoUrl, "JPEG", px, py, photoColW, photoH);
            } catch {
                doc.setFillColor(...T.surfaceMid);
                doc.rect(px, py, photoColW, photoH, "F");
                doc.setFont("helvetica", "normal");
                doc.setFontSize(7);
                doc.setTextColor(...T.textMid);
                doc.text("Photo", px + photoColW / 2, py + photoH / 2, { align: "center" });
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PAGE 5 — FEE PROPOSAL + PROJECT TIMELINE
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    totalPagesRef.n++;
    y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef, T);
    y = renderSectionHeading(doc, y, "Fee Proposal", T);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...T.textMid);
    doc.text("All prices exclusive of VAT unless stated.", ML, y);
    y += 10;

    if (pricingMode === "full" && pdfEstimates.some((est: any) => (est.estimate_lines || []).length > 0)) {
        pdfEstimates.forEach((est: any) => {
            const markup = 1 + ((est.profit_pct || 0) + (est.overhead_pct || 0) + (est.risk_pct || 0)) / 100;
            const estTotal = (est.total_cost || 0) * markup;
            const lines = est.estimate_lines || [];

            const bodyRows = lines.map((line: any) => {
                const desc = line.mom_item_code ? `[${line.mom_item_code}] ${line.description}` : line.description;
                return [
                    desc || "\u2014",
                    String(line.quantity ?? ""),
                    line.unit || "",
                    formatGBP(line.unit_rate || 0),
                    formatGBP(line.line_total || 0),
                ];
            });

            autoTable(doc, {
                startY: y,
                head: [
                    [{ content: est.version_name || "Estimate", colSpan: 5, styles: { halign: "left" as const, fillColor: T.primary as any, textColor: T.accent as any, fontSize: 10, fontStyle: "bold" as const } }],
                    ["Description", "Qty", "Unit", "Rate", "Total"],
                ],
                body: bodyRows,
                foot: [["Subtotal", "", "", "", formatGBP(estTotal)]],
                theme: "grid",
                margin: { left: ML, right: PAGE_W - MR },
                headStyles: { fillColor: T.primaryMid as any, textColor: T.white as any, fontStyle: "bold", fontSize: 8.5 },
                bodyStyles: { fontSize: 9, textColor: T.textDark as any, cellPadding: 3 },
                footStyles: { fillColor: T.surface as any, textColor: T.textDark as any, fontStyle: "bold", fontSize: 9 },
                columnStyles: {
                    0: { cellWidth: 70 },
                    1: { cellWidth: 18, halign: "center" as const },
                    2: { cellWidth: 20, halign: "center" as const },
                    3: { cellWidth: 30, halign: "right" as const },
                    4: { cellWidth: 30, halign: "right" as const },
                },
                alternateRowStyles: { fillColor: T.surface as any },
                tableLineColor: T.borderLight as any,
                tableLineWidth: 0.2,
                didDrawPage: () => { totalPagesRef.n = doc.getNumberOfPages(); },
            });

            y = (doc as any).lastAutoTable.finalY + 3;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(...T.textMid);
            doc.text(
                `Overhead: ${est.overhead_pct || 0}%  |  Profit: ${est.profit_pct || 0}%  |  Risk: ${est.risk_pct || 0}%`,
                ML, y
            );
            y += 9;
        });
    } else {
        // Summary mode or no lines
        const summaryRows = pdfEstimates.map((est: any) => {
            const markup = 1 + ((est.profit_pct || 0) + (est.overhead_pct || 0) + (est.risk_pct || 0)) / 100;
            return [est.version_name || "Estimate", formatGBP((est.total_cost || 0) * markup)];
        });

        if (summaryRows.length > 0) {
            autoTable(doc, {
                startY: y,
                head: [["Trade / Phase", "Total (\u00A3)"]],
                body: summaryRows,
                theme: "grid",
                margin: { left: ML, right: PAGE_W - MR },
                headStyles: { fillColor: T.primary as any, textColor: T.accent as any, fontStyle: "bold", fontSize: 9 },
                bodyStyles: { fontSize: 10, textColor: T.textDark as any, cellPadding: 4 },
                columnStyles: { 1: { halign: "right" as const, cellWidth: 45 } },
                alternateRowStyles: { fillColor: T.surface as any },
                tableLineColor: T.borderLight as any,
                tableLineWidth: 0.2,
                didDrawPage: () => { totalPagesRef.n = doc.getNumberOfPages(); },
            });
            y = (doc as any).lastAutoTable.finalY + 8;
        }
    }

    // Grand total box
    y = ensureSpace(doc, y, 50, companyName, docTitle, totalPagesRef, T);
    y += 4;

    // Full-width primary fill rectangle for grand total
    doc.setFillColor(...T.primary);
    doc.rect(ML, y, CW, 16, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...T.muted);
    doc.text("TOTAL (exc. VAT)", ML + 4, y + 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...T.accent);
    doc.text(formatGBP(displayTotal), ML + CW - 4, y + 11, { align: "right" });
    y += 20;

    // VAT line
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...T.textMid);
    doc.text(`VAT @ 20%: ${formatGBP(displayTotal * 0.2)}`, ML, y);
    y += 6;

    // Inc VAT line
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...T.textDark);
    doc.text(`Total inc. VAT: ${formatGBP(displayTotal * 1.2)}`, ML, y);
    y += 12;

    // Payment Schedule
    const paymentSchedule = project?.payment_schedule;
    if (paymentSchedule && paymentSchedule.length > 0) {
        y = ensureSpace(doc, y, 30, companyName, docTitle, totalPagesRef, T);
        y += 4;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...T.textDark);
        doc.text("Payment Schedule", ML, y);
        y += 8;

        const payRows = paymentSchedule.map((row: any) => {
            const amount = displayTotal ? (displayTotal * row.percentage) / 100 : 0;
            return [
                row.stage || "",
                row.description || "",
                `${row.percentage}%`,
                amount > 0 ? formatGBP(amount) : "\u2014",
            ];
        });

        autoTable(doc, {
            startY: y,
            head: [["Stage", "Description", "%", "\u00A3 Amount"]],
            body: payRows,
            theme: "grid",
            margin: { left: ML, right: PAGE_W - MR },
            headStyles: { fillColor: T.primary as any, textColor: T.accent as any, fontStyle: "bold", fontSize: 9 },
            bodyStyles: { fontSize: 9.5, textColor: T.textDark as any, cellPadding: 3.5 },
            columnStyles: {
                0: { cellWidth: 45, fontStyle: "bold" },
                2: { cellWidth: 18, halign: "center" as const },
                3: { cellWidth: 35, halign: "right" as const, fontStyle: "bold" },
            },
            alternateRowStyles: { fillColor: T.surface as any },
            tableLineColor: T.borderLight as any,
            tableLineWidth: 0.2,
            didDrawPage: () => { totalPagesRef.n = doc.getNumberOfPages(); },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Validity statement
    y = ensureSpace(doc, y, 15, companyName, docTitle, totalPagesRef, T);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...T.textMid);
    const validityText = `This Proposal is valid for ${validityDays} days from the date of issue (${formatDate(today)}). After this period, rates may be subject to review.`;
    const validityLines = doc.splitTextToSize(validityText, CW);
    doc.text(validityLines, ML, y);
    y += validityLines.length * 5 + 6;

    // Check if there's space for timeline, if not add new page
    const phases: any[] = project?.gantt_phases || [];
    if (phases.length > 0) {
        const ganttNeeded = 25 + phases.length * 11 + 15;
        y = ensureSpace(doc, y, ganttNeeded, companyName, docTitle, totalPagesRef, T);

        y = renderSectionHeading(doc, y, "Project Timeline", T);

        // Calculate sequential start offsets if not provided
        const projectStartDate = new Date(project?.start_date || Date.now());
        let cumulativeWeeks = 0;
        const phasesWithOffsets = phases.map((phase: any) => {
            const durationDays = phase.duration_days || 7;
            const durationWeeks = Math.ceil(durationDays / 7);
            let startWeek: number;

            if (phase.startOffset !== undefined) {
                startWeek = phase.startOffset;
            } else if (phase.start_date) {
                const pStart = new Date(phase.start_date).getTime();
                const projStart = projectStartDate.getTime();
                startWeek = Math.max(0, Math.round((pStart - projStart) / (7 * 86400000)));
            } else {
                startWeek = cumulativeWeeks;
            }

            const p = { ...phase, startWeek, durationWeeks };
            cumulativeWeeks = startWeek + durationWeeks;
            return p;
        });

        // Total project duration in weeks
        const totalWeeks = Math.max(
            phasesWithOffsets.reduce((max: number, p: any) => Math.max(max, p.startWeek + p.durationWeeks), 0),
            4
        );

        const labelColW = 55;
        const durationColW = 20;
        const chartX = ML + labelColW + durationColW;
        const chartW = CW - labelColW - durationColW;
        const rowH = 11;
        const headerH = 14;
        const visibleWeeks = Math.min(totalWeeks, 20);
        const weekW = chartW / Math.max(1, visibleWeeks);
        const ganttColorKeys = Object.keys(GANTT_COLORS);

        // Header row
        doc.setFillColor(...T.primary);
        doc.rect(ML, y, CW, headerH, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...T.accent);
        doc.text("Phase", ML + 3, y + 6.5);
        doc.text("Duration", ML + labelColW + 2, y + 6.5);

        // Week columns with dates
        for (let w = 0; w < visibleWeeks; w++) {
            const weekDate = new Date(projectStartDate);
            weekDate.setDate(weekDate.getDate() + w * 7);
            const weekLabel = `W${w + 1}`;
            const xPos = chartX + w * weekW + weekW / 2;

            if (weekW >= 6 || w % 2 === 0) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(7);
                doc.setTextColor(...T.accent);
                doc.text(weekLabel, xPos, y + 5, { align: "center" });

                doc.setFontSize(5.5);
                doc.setTextColor(...T.muted);
                const dateLabel = `${weekDate.getDate()} ${weekDate.toLocaleString("en-GB", { month: "short" })}`;
                doc.text(dateLabel, xPos, y + 10, { align: "center" });
            }
        }
        y += headerH;

        // Phase rows
        phasesWithOffsets.forEach((phase: any, idx: number) => {
            const isEven = idx % 2 === 0;

            // Row background
            doc.setFillColor(...(isEven ? T.surface : T.white));
            doc.rect(ML, y, CW, rowH, "F");

            // Phase name
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(...T.textDark);
            const phaseName = doc.splitTextToSize(phase.name || `Phase ${idx + 1}`, labelColW - 4);
            doc.text(phaseName[0], ML + 3, y + 6.5);

            // Duration
            doc.setFontSize(7.5);
            doc.setTextColor(...T.textMid);
            const durLabel = `${phase.durationWeeks} ${phase.durationWeeks === 1 ? "wk" : "wks"}`;
            doc.text(durLabel, ML + labelColW + 2, y + 6.5);

            // Gantt bar
            const barX = chartX + phase.startWeek * weekW;
            const barW = Math.max(phase.durationWeeks * weekW - 2, weekW * 0.8);
            const clampedBarW = Math.min(barW, chartX + chartW - barX - 2);
            const barColor = GANTT_COLORS[phase.color] || GANTT_COLORS[ganttColorKeys[idx % ganttColorKeys.length]];

            if (clampedBarW > 0) {
                doc.setFillColor(...barColor);
                doc.roundedRect(barX, y + 2, clampedBarW, rowH - 4, 1.5, 1.5, "F");

                // Start date label on bar
                if (clampedBarW > 18) {
                    const barStartDate = new Date(projectStartDate);
                    barStartDate.setDate(barStartDate.getDate() + phase.startWeek * 7);
                    const barLabel = `${barStartDate.getDate()} ${barStartDate.toLocaleString("en-GB", { month: "short" })}`;
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(6.5);
                    doc.setTextColor(...T.white);
                    doc.text(barLabel, barX + 3, y + 6.5);
                }
            }

            // Vertical grid lines
            for (let w = 0; w <= visibleWeeks; w++) {
                doc.setDrawColor(...T.borderLight);
                doc.setLineWidth(0.15);
                doc.line(chartX + w * weekW, y, chartX + w * weekW, y + rowH);
            }

            y += rowH;
        });

        // Border around whole table
        doc.setDrawColor(...T.borderLight);
        doc.setLineWidth(0.3);
        doc.rect(ML, y - phases.length * rowH - headerH, CW, phases.length * rowH + headerH, "S");

        y += 5;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(...T.textMid);
        doc.text("Note: Timeline is indicative. Final programme subject to agreement on acceptance.", ML, y);
        y += 8;
    }

    // ═══════════════════════════════════════════════════════════
    // PAGE 6 — EXCLUSIONS + CLARIFICATIONS + T&Cs (two-column)
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    totalPagesRef.n++;
    y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef, T);
    y = renderSectionHeading(doc, y, "Commercial Terms", T);

    const halfW = (CW - 8) / 2;
    const boxX2 = ML + halfW + 8;
    let termLeftY = y;
    let termRightY = y;

    // Left column: Exclusions + Clarifications
    if (project?.exclusions_text) {
        doc.setFillColor(...T.primary);
        doc.rect(ML, termLeftY, halfW, 8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...T.white);
        doc.text("EXCLUSIONS", ML + 4, termLeftY + 5.5);
        termLeftY += 12;

        const exclItems = project.exclusions_text.split("\n").filter((s: string) => s.trim());
        exclItems.forEach((item: string) => {
            const bulletLines = doc.splitTextToSize(`-  ${item.trim()}`, halfW - 6);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...T.textDark);
            doc.text(bulletLines, ML + 4, termLeftY);
            termLeftY += bulletLines.length * 4.8 + 1.5;
        });
    }

    if (project?.clarifications_text) {
        termLeftY += 10;
        doc.setFillColor(...T.primary);
        doc.rect(ML, termLeftY, halfW, 8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...T.white);
        doc.text("CLARIFICATIONS", ML + 4, termLeftY + 5.5);
        termLeftY += 12;

        const clarItems = project.clarifications_text.split("\n").filter((s: string) => s.trim());
        clarItems.forEach((item: string) => {
            const bulletLines = doc.splitTextToSize(`-  ${item.trim()}`, halfW - 6);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...T.textDark);
            doc.text(bulletLines, ML + 4, termLeftY);
            termLeftY += bulletLines.length * 4.8 + 1.5;
        });
    }

    // Right column: T&Cs
    doc.setFillColor(...T.primary);
    doc.rect(boxX2, termRightY, halfW, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...T.white);
    doc.text("TERMS & CONDITIONS", boxX2 + 4, termRightY + 5.5);
    termRightY += 12;

    const tcClauses = project?.tc_overrides || STANDARD_TC_CLAUSES.map(([t, b]) => ({ title: t, body: b }));
    tcClauses.forEach((c: any, idx: number) => {
        const title = c.title || (Array.isArray(c) ? c[0] : "");
        const body = c.body || (Array.isArray(c) ? c[1] : "");

        if (idx > 0) {
            doc.setDrawColor(...T.borderLight);
            doc.setLineWidth(0.15);
            doc.line(boxX2, termRightY - 1, boxX2 + halfW, termRightY - 1);
            termRightY += 1;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...T.textDark);
        doc.text(title, boxX2 + 2, termRightY);
        termRightY += 4;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...T.textMid);
        const bodyLines = doc.splitTextToSize(body, halfW - 4);
        doc.text(bodyLines, boxX2 + 2, termRightY);
        termRightY += bodyLines.length * 3.6 + 2;

        // If overflowing, add a new page
        if (termRightY > CONTENT_BOTTOM) {
            doc.addPage();
            totalPagesRef.n++;
            const newY = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef, T);
            termRightY = newY;
            termLeftY = newY; // reset left too since it's a new page
        }
    });

    // ═══════════════════════════════════════════════════════════
    // SIGNATURE PAGE
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    totalPagesRef.n++;
    y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef, T);
    y = renderSectionHeading(doc, y, "Acceptance & Signatures", T);

    // Summary box
    doc.setFillColor(...T.surface);
    doc.roundedRect(ML, y, CW, 28, 3, 3, "F");
    doc.setDrawColor(...T.borderLight);
    doc.setLineWidth(0.3);
    doc.roundedRect(ML, y, CW, 28, 3, 3, "S");

    const sumCol2 = ML + CW / 3;
    const sumCol3 = ML + (CW * 2) / 3;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...T.textMid);
    doc.text("CONTRACT VALUE", ML + 6, y + 8);
    doc.text("PROPOSED START", sumCol2 + 3, y + 8);
    doc.text("VALID UNTIL", sumCol3 + 3, y + 8);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...T.textDark);
    doc.text(displayTotal > 0 ? formatGBP(displayTotal) : "TBC", ML + 6, y + 21);

    doc.setFontSize(11);
    doc.text(
        project?.start_date ? formatDate(new Date(project.start_date)) : "TBC",
        sumCol2 + 3, y + 21
    );
    doc.text(formatDate(validUntil), sumCol3 + 3, y + 21);
    y += 36;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...T.textDark);
    const sigText = "By signing below, both parties agree to the Scope of Works, Fee Proposal, and Terms & Conditions set out in this document.";
    const sigLines = doc.splitTextToSize(sigText, CW);
    doc.text(sigLines, ML, y);
    y += sigLines.length * 5.5 + 10;

    // Two signature columns side by side — use the same y for both
    const sigBoxW = (CW - 10) / 2;
    const sigBoxX2 = ML + sigBoxW + 10;
    const sigStartY = y;

    // Helper to draw a signature block at a given x
    function drawSigBlock(x: number, startY: number, heading: string, name: string) {
        let sy = startY;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...T.textDark);
        doc.text(heading, x, sy);
        sy += 6;
        doc.text(name, x, sy);
        sy += 16;

        doc.setDrawColor(...T.textDark);
        doc.setLineWidth(0.5);
        doc.line(x, sy, x + sigBoxW, sy);
        sy += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...T.textMid);
        doc.text("Signature", x, sy);
        sy += 8;
        doc.setDrawColor(...T.muted);
        doc.setLineWidth(0.3);
        doc.line(x, sy, x + sigBoxW, sy);
        sy += 5;
        doc.text("Print Name", x, sy);
        sy += 8;
        doc.line(x, sy, x + sigBoxW, sy);
        sy += 5;
        doc.text("Date", x, sy);
        return sy;
    }

    const leftSigEnd = drawSigBlock(ML, sigStartY, "FOR AND ON BEHALF OF THE CONTRACTOR", companyName);
    drawSigBlock(sigBoxX2, sigStartY, "FOR AND ON BEHALF OF THE CLIENT", clientName);
    y = leftSigEnd;

    y += 16;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...T.textMid);
    const smallPrint = `This Proposal was generated by ${companyName} using Constructa. Acceptance of this proposal constitutes a binding agreement to the stated terms. Ref: ${refCode}.`;
    const spLines = doc.splitTextToSize(smallPrint, CW);
    doc.text(spLines, ML, y);

    const filename = `${projectName.replace(/[^a-z0-9]/gi, "_")}_Proposal_${refCode}.pdf`;
    doc.save(filename);
}
