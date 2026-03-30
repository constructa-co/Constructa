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
    // Core charcoal (replaces navy)
    black:      [13, 13, 13] as [number, number, number],      // #0D0D0D  — cover bg, page headers
    charcoal:   [26, 26, 26] as [number, number, number],      // #1A1A1A  — card fills, pill fills
    charcoalMid:[42, 42, 42] as [number, number, number],      // #2A2A2A  — borders, subtle fills
    charcoalLight:[60, 60, 60] as [number, number, number],    // #3C3C3C  — stat pill backgrounds on cover
    // Text
    white:      [255, 255, 255] as [number, number, number],
    muted:      [160, 160, 160] as [number, number, number],   // #A0A0A0  — subheadings, labels on dark bg
    textDark:   [20, 20, 20] as [number, number, number],      // near-black body text on white pages
    textMid:    [80, 80, 80] as [number, number, number],      // secondary body text
    textLight:  [130, 130, 130] as [number, number, number],   // captions, fine print
    // Light page surfaces
    surface:    [248, 248, 248] as [number, number, number],   // #F8F8F8  — alternate row bg
    surfaceMid: [240, 240, 240] as [number, number, number],   // #F0F0F0  — contact box bg
    borderLight:[220, 220, 220] as [number, number, number],   // light-page borders
    // Accent (keep green + blue for Gantt)
    green:      [22, 163, 74] as [number, number, number],
    blue:       [59, 130, 246] as [number, number, number],
};

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
    return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: Date): string {
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
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

function addPageHeader(doc: jsPDF, companyName: string, docTitle: string, pageNum: number, totalPagesRef: { n: number }): number {
    doc.setFillColor(...C.black);
    doc.rect(0, 0, PAGE_W, HEADER_H, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.white);
    doc.text(companyName.toUpperCase(), ML, 7.5);
    doc.text(docTitle, PAGE_W / 2, 7.5, { align: "center" });
    doc.setTextColor(...C.muted);
    doc.text(`${pageNum}`, MR, 7.5, { align: "right" });

    doc.setDrawColor(...C.borderLight);
    doc.setLineWidth(0.2);
    doc.line(ML, PAGE_H - FOOTER_H, MR, PAGE_H - FOOTER_H);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.textLight);
    doc.text(`Page ${pageNum} | ${companyName} | Confidential`, PAGE_W / 2, PAGE_H - 4, { align: "center" });

    return CONTENT_TOP;
}

/** Section heading — editorial short accent bar */
function renderSectionHeading(doc: jsPDF, y: number, text: string): number {
    const num = String(sectionCounter).padStart(2, "0");
    sectionCounter++;

    // Section number
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(num, ML, y + 5);

    // Section title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...C.textDark);
    doc.text(text, ML + 10, y + 7);

    // Short 30mm accent bar
    doc.setDrawColor(...C.black);
    doc.setLineWidth(0.5);
    doc.line(ML, y + 11, ML + 30, y + 11);

    return y + 22;
}

function renderBodyText(doc: jsPDF, y: number, text: string, maxWidth = CW, x = ML): number {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...C.textDark);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return y + lines.length * 5.8;
}

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
    sectionCounter = 1; // reset section counter
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const companyName = profile?.company_name || "The Contractor";
    const clientName = project?.client_name || "Valued Client";
    const projectName = project?.name || "Project Proposal";
    // Normalise addresses — replace comma-separated run-ons with newlines
    const normaliseAddress = (addr: string) => addr
        ? addr.replace(/,\s*/g, "\n").replace(/\n+/g, "\n").trim()
        : "";
    const address = normaliseAddress(project?.site_address || project?.client_address || "");
    const clientAddress = normaliseAddress(project?.client_address || project?.site_address || "");
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
    // PAGE 1 — COVER PAGE (C1: Full-page navy)
    // ═══════════════════════════════════════════════════════════

    // Full-page navy background
    doc.setFillColor(...C.black);
    doc.rect(0, 0, PAGE_W, PAGE_H, "F");

    let y = 15;

    // Company logo or name (centered, white pill box)
    let logoLoaded = false;
    if (profile?.logo_url) {
        try {
            // White background pill
            doc.setFillColor(...C.white);
            doc.roundedRect(PAGE_W / 2 - 37, y, 74, 27, 3, 3, "F");
            // Detect image format from URL extension
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
        doc.setTextColor(...C.white);
        doc.text(companyName.toUpperCase(), PAGE_W / 2, y + 12, { align: "center" });
        y += 22;
    }

    // Thin white rule
    doc.setDrawColor(...C.white);
    doc.setLineWidth(0.5);
    doc.line(ML + 20, y, MR - 20, y);
    y += 8;

    // "PROPOSAL & FEE PROPOSAL" small uppercase
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text("PROPOSAL & FEE PROPOSAL", PAGE_W / 2, y, { align: "center" });
    y += 6;

    // ── Center of page: project name ──
    y = 110;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(42);
    doc.setTextColor(...C.white);
    const titleLines = doc.splitTextToSize(projectName, CW - 20);
    const titleLineH = 14;
    titleLines.forEach((line: string, i: number) => {
        doc.text(line, PAGE_W / 2, y + i * titleLineH, { align: "center" });
    });
    y += titleLines.length * titleLineH + 10;

    // "Prepared exclusively for"
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text("Prepared exclusively for", PAGE_W / 2, y, { align: "center" });
    y += 8;

    // Client name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...C.white);
    doc.text(clientName, PAGE_W / 2, y, { align: "center" });
    y += 8;

    // Client address
    if (clientAddress) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...C.muted);
        const addrLines = doc.splitTextToSize(clientAddress, 120);
        addrLines.forEach((line: string, i: number) => {
            doc.text(line, PAGE_W / 2, y + i * 5.5, { align: "center" });
        });
        y += addrLines.length * 5.5 + 4;
    }

    // ── Bottom info strip (y=225) — horizontal rule + 4 inline stats ──
    const infoY = 225;
    doc.setDrawColor(...C.white);
    doc.setLineWidth(0.3);
    doc.line(ML, infoY, MR, infoY);

    const statCols = [
        { label: "DATE ISSUED", value: formatDate(today) },
        { label: "VALID UNTIL", value: formatDate(validUntil) },
        { label: "REFERENCE", value: refCode },
        ...(contractValue > 0 ? [{ label: "CONTRACT VALUE", value: formatGBP(contractValue) }] : []),
    ];
    const colW = CW / statCols.length;
    statCols.forEach((stat, i) => {
        const sx = ML + i * colW;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(...C.muted);
        doc.text(stat.label, sx, infoY + 7);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...C.white);
        doc.text(stat.value, sx, infoY + 13);
    });

    // Very bottom
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.white);
    doc.text(companyName, ML, 284);
    if (profile?.website) {
        doc.text(profile.website, MR, 284, { align: "right" });
    } else {
        doc.text("Confidential", MR, 284, { align: "right" });
    }

    // ═══════════════════════════════════════════════════════════
    // PAGE 2 — ABOUT US (C2: Two-column capability profile)
    // ═══════════════════════════════════════════════════════════
    if (profile?.capability_statement) {
        doc.addPage();
        totalPagesRef.n++;
        y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef);

        // C2: Large section heading without number bar
        doc.setFont("helvetica", "bold");
        doc.setFontSize(26);
        doc.setTextColor(...C.textDark);
        doc.text(`About ${companyName}`, ML, y + 8);
        // Thin accent rule under title
        doc.setDrawColor(...C.black);
        doc.setLineWidth(0.3);
        doc.line(ML, y + 12, ML + 40, y + 12);
        y += 22;

        // Two-column layout: left 55%, right 45%
        const leftW = CW * 0.55;
        const rightW = CW * 0.43;
        const rightX = ML + leftW + CW * 0.02;
        let leftY = y;
        let rightY = y;

        // Left column
        // Capability statement
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...C.textDark);
        const capLines = doc.splitTextToSize(profile.capability_statement, leftW);
        doc.text(capLines, ML, leftY);
        leftY += capLines.length * 5.5 + 8;

        // Specialisms as pill badges
        if (profile.specialisms) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(...C.textDark);
            doc.text("Specialisms", ML, leftY);
            leftY += 7;

            const specs = profile.specialisms.split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
            let badgeX = ML;
            specs.forEach((spec: string) => {
                const badgeW = doc.getTextWidth(spec) + 8;
                if (badgeX + badgeW > ML + leftW) {
                    badgeX = ML;
                    leftY += 9;
                }
                doc.setFillColor(...C.charcoalMid);
                doc.roundedRect(badgeX, leftY - 4.5, badgeW, 7, 1.5, 1.5, "F");
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(...C.white);
                doc.text(spec, badgeX + 4, leftY);
                badgeX += badgeW + 3;
            });
            leftY += 14;
        }

        // Years trading badge
        if (profile.years_trading) {
            const badge = `Est. ${profile.years_trading} years trading`;
            const badgeW = doc.getTextWidth(badge) + 8;
            doc.setFillColor(...C.surfaceMid);
            doc.roundedRect(ML, leftY, badgeW, 8, 2, 2, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(...C.textDark);
            doc.text(badge, ML + 4, leftY + 5.5);
            leftY += 14;
        }

        // Right column
        // Contact info box
        const contactRows: string[][] = [];
        if (profile.phone) contactRows.push(["Phone", profile.phone]);
        if (profile.website) contactRows.push(["Website", profile.website]);
        if (profile.address) contactRows.push(["Address", profile.address]);
        if (profile.company_number) contactRows.push(["Company Reg.", profile.company_number]);
        if (profile.vat_number) contactRows.push(["VAT Number", profile.vat_number]);

        if (contactRows.length > 0) {
            doc.setFillColor(...C.white);
            doc.roundedRect(rightX, rightY, rightW, contactRows.length * 10 + 8, 3, 3, "F");
            doc.setDrawColor(...C.borderLight);
            doc.setLineWidth(0.3);
            doc.roundedRect(rightX, rightY, rightW, contactRows.length * 10 + 8, 3, 3, "S");
            rightY += 7;
            contactRows.forEach(([label, val]) => {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(7.5);
                doc.setTextColor(...C.textMid);
                doc.text(label, rightX + 4, rightY + 4);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
                doc.setTextColor(...C.textDark);
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
            doc.setTextColor(...C.textDark);
            doc.text("Accreditations", rightX, rightY);
            rightY += 6;

            const accreds = profile.accreditations.split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean);
            accreds.forEach((acc: string) => {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(...C.textDark);
                doc.text(`\u25CF  ${acc}`, rightX, rightY);
                rightY += 6;
            });
        }

        y = Math.max(leftY, rightY) + 8;
    }

    // ═══════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════
    // CASE STUDIES — one full page per case study
    // ═══════════════════════════════════════════════════════════
    const caseStudies = profile?.case_studies || [];
    if (caseStudies.length > 0) {
        for (let ci = 0; ci < caseStudies.length; ci++) {
            const cs = caseStudies[ci];
            if (!cs.projectName) continue;

            // Each case study gets its OWN full page
            doc.addPage();
            totalPagesRef.n++;

            // ── FULL-BLEED NAVY TOP BAND (top 35% of page) ──
            const bandH = PAGE_H * 0.36;
            doc.setFillColor(...C.black);
            doc.rect(0, 0, PAGE_W, bandH, "F");

            // Section label (top-left in band)
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(...C.muted);
            doc.text(`OUR WORK  —  ${String(ci + 1).padStart(2, "0")} / ${String(caseStudies.filter((c: any) => c.projectName).length).padStart(2, "0")}`, ML, 10);

            // Company name top-right
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(...C.muted);
            doc.text(companyName.toUpperCase(), MR, 10, { align: "right" });

            // Project name — large white, vertically centred in top band
            const titleY = bandH * 0.42;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(32);
            doc.setTextColor(...C.white);
            const titleLines = doc.splitTextToSize(cs.projectName, CW);
            doc.text(titleLines, ML, titleY);

            // Location / client subtitle
            const subParts = [cs.location, cs.client].filter(Boolean);
            if (subParts.length > 0) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(10);
                doc.setTextColor(...C.muted);
                doc.text(subParts.join("  |  "), ML, titleY + titleLines.length * 10 + 4);
            }

            // ── STAT PILLS ROW (at bottom of navy band) ──
            const statItems = [
                cs.projectType   && { label: "TYPE", value: cs.projectType },
                cs.contractValue && { label: "VALUE", value: `£${Number(cs.contractValue).toLocaleString("en-GB")}` },
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
                // Charcoal pill background
                doc.setFillColor(...C.charcoalLight);
                doc.roundedRect(pillX, pillY, pW, pillH, 2, 2, "F");
                // Label
                doc.setFont("helvetica", "normal");
                doc.setFontSize(7);
                doc.setTextColor(...C.muted);
                doc.text(stat.label, pillX + 5, pillY + 5);
                // Value
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.setTextColor(...C.white);
                doc.text(stat.value, pillX + 5, pillY + 12);
                pillX += pW + pillGap;
            });

            // ── WHITE CONTENT AREA ──
            let cy = bandH + 14; // content start Y

            // Photos: if photos exist, show as a row
            const photos = (cs.photos || []).filter((p: string) => p);
            if (photos.length > 0) {
                const numPhotos = Math.min(photos.length, 3);
                const photoGap = 4;
                const totalGap = photoGap * (numPhotos - 1);
                const photoW = (CW - totalGap) / numPhotos;
                const photoH = photoW * 0.62; // ~16:10 ratio
                let px = ML;

                for (let pi = 0; pi < numPhotos; pi++) {
                    const photoUrl = photos[pi];
                    try {
                        const imgExt = photoUrl.split(".").pop()?.toLowerCase() || "jpg";
                        const imgFmt = imgExt === "png" ? "PNG" : "JPEG";
                        doc.addImage(photoUrl, imgFmt, px, cy, photoW, photoH);
                    } catch {
                        // Placeholder box if image fails
                        doc.setFillColor(...C.surfaceMid);
                        doc.rect(px, cy, photoW, photoH, "F");
                        doc.setFont("helvetica", "normal");
                        doc.setFontSize(7);
                        doc.setTextColor(...C.muted);
                        doc.text("Photo", px + photoW / 2, cy + photoH / 2, { align: "center" });
                    }
                    px += photoW + photoGap;
                }
                cy += photoH + 10;
            }

            // ── TWO-COLUMN NARRATIVE ──
            const colGap = 8;
            const colW = (CW - colGap) / 2;
            const col2X = ML + colW + colGap;
            let col1Y = cy;
            let col2Y = cy;

            // Left column: What We Delivered
            if (cs.whatWeDelivered) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.setTextColor(...C.black);
                doc.text("WHAT WE DELIVERED", ML, col1Y);
                col1Y += 1.5;
                doc.setDrawColor(...C.black);
                doc.setLineWidth(0.5);
                doc.line(ML, col1Y, ML + 30, col1Y);
                col1Y += 5;

                doc.setFont("helvetica", "normal");
                doc.setFontSize(9.5);
                doc.setTextColor(...C.textDark);
                const wdLines = doc.splitTextToSize(cs.whatWeDelivered, colW);
                doc.text(wdLines, ML, col1Y);
                col1Y += wdLines.length * 5 + 6;
            }

            // Right column: Value Added
            if (cs.valueAdded) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.setTextColor(...C.black);
                doc.text("VALUE ADDED", col2X, col2Y);
                col2Y += 1.5;
                doc.setDrawColor(...C.black);
                doc.setLineWidth(0.5);
                doc.line(col2X, col2Y, col2X + 30, col2Y);
                col2Y += 5;

                // Value Added box — surface background with left charcoalMid accent
                const vaLines = doc.splitTextToSize(cs.valueAdded, colW - 8);
                const vaBoxH = vaLines.length * 5 + 10;
                doc.setFillColor(...C.surface);
                doc.rect(col2X, col2Y, colW, vaBoxH, "F");
                doc.setFillColor(...C.charcoalMid);
                doc.rect(col2X, col2Y, 2.5, vaBoxH, "F");

                doc.setFont("helvetica", "italic");
                doc.setFontSize(9.5);
                doc.setTextColor(...C.textMid);
                doc.text(vaLines, col2X + 6, col2Y + 6);
                col2Y += vaBoxH + 6;
            }

            cy = Math.max(col1Y, col2Y);

            // ── FOOTER BAR ──
            doc.setFillColor(...C.black);
            doc.rect(0, PAGE_H - 10, PAGE_W, 10, "F");
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(...C.white);
            doc.text(companyName, ML, PAGE_H - 3.5);
            doc.text(docTitle, PAGE_W / 2, PAGE_H - 3.5, { align: "center" });
            doc.text(String(totalPagesRef.n), MR, PAGE_H - 3.5, { align: "right" });
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
    doc.setTextColor(...C.textDark);
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
        bodyStyles: { fontSize: 10, textColor: C.textDark, cellPadding: 4 },
        columnStyles: {
            0: { fontStyle: "bold", cellWidth: 55, textColor: C.textMid, fontSize: 8.5 },
        },
        alternateRowStyles: { fillColor: C.surface },
        tableLineColor: C.borderLight,
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
        doc.setTextColor(...C.textMid);
        doc.text("Scope to be completed in the Proposal Editor.", ML, y);
        y += 8;
    }

    // ═══════════════════════════════════════════════════════════
    // PAGE 5+ — FEE PROPOSAL (C5: Better total section)
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    totalPagesRef.n++;
    y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef);
    y = renderSectionHeading(doc, y, "Fee Proposal");

    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...C.textMid);
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
                head: [
                    [{ content: est.version_name || "Estimate", colSpan: 5, styles: { halign: "left" as const, fillColor: C.black, textColor: C.white, fontSize: 10, fontStyle: "bold" as const } }],
                    ["Description", "Qty", "Unit", "Rate", "Total"],
                ],
                body: bodyRows,
                foot: [["Subtotal", "", "", "", formatGBP(estTotal)]],
                theme: "grid",
                margin: { left: ML, right: PAGE_W - MR },
                headStyles: { fillColor: C.charcoalMid, textColor: C.white, fontStyle: "bold", fontSize: 8.5 },
                bodyStyles: { fontSize: 9, textColor: C.textDark, cellPadding: 3 },
                footStyles: { fillColor: C.surface, textColor: C.textDark, fontStyle: "bold", fontSize: 9 },
                columnStyles: {
                    0: { cellWidth: 70 },
                    1: { cellWidth: 18, halign: "center" as const },
                    2: { cellWidth: 20, halign: "center" as const },
                    3: { cellWidth: 30, halign: "right" as const },
                    4: { cellWidth: 30, halign: "right" as const },
                },
                alternateRowStyles: { fillColor: C.surface },
                tableLineColor: C.borderLight,
                tableLineWidth: 0.2,
                didDrawPage: () => { totalPagesRef.n = doc.getNumberOfPages(); },
            });

            y = (doc as any).lastAutoTable.finalY + 3;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(...C.textMid);
            doc.text(
                `Overhead: ${est.overhead_pct || 0}%  |  Profit: ${est.profit_pct || 0}%  |  Risk: ${est.risk_pct || 0}%`,
                ML, y
            );
            y += 9;
        });

        // C5: Better total summary box
        y = ensureSpace(doc, y, 50, companyName, docTitle, totalPagesRef);
        y += 4;

        // Calculate totals
        const labourTotal = estimates.reduce((sum, est) => {
            const lines = est.estimate_lines || [];
            return sum + lines
                .filter((l: any) => l.cost_type === "labour" || l.unit === "hr" || l.unit === "hrs")
                .reduce((s: number, l: any) => s + (l.line_total || 0), 0);
        }, 0);

        const materialsTotal = estimates.reduce((sum, est) => {
            const lines = est.estimate_lines || [];
            return sum + lines
                .filter((l: any) => l.cost_type === "material" || l.unit === "m2" || l.unit === "m3" || l.unit === "nr")
                .reduce((s: number, l: any) => s + (l.line_total || 0), 0);
        }, 0);

        const subtotal = estimates.reduce((sum, est) => sum + (est.total_cost || 0), 0);
        const avgOverhead = estimates.length > 0 ? estimates.reduce((s, e) => s + (e.overhead_pct || 0), 0) / estimates.length : 0;
        const avgProfit = estimates.length > 0 ? estimates.reduce((s, e) => s + (e.profit_pct || 0), 0) / estimates.length : 0;
        const totalMarkup = grandTotal - subtotal;
        const vatAmount = grandTotal * 0.20;
        const totalIncVat = grandTotal * 1.20;

        // Grand total section — full-width premium box
        const gtX = ML;
        const gtW = CW;

        // TOTAL (exc. VAT) label + value
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...C.muted);
        doc.text("TOTAL (exc. VAT)", gtX, y + 4);
        y += 6;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(...C.textDark);
        doc.text(formatGBP(grandTotal), gtX, y + 6);
        y += 10;

        // VAT row
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...C.muted);
        doc.text(`VAT @ 20%: ${formatGBP(vatAmount)}`, gtX, y + 4);
        y += 8;

        // Total inc. VAT — black fill bar
        doc.setFillColor(...C.black);
        doc.rect(gtX, y, gtW, 14, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(...C.white);
        doc.text("TOTAL INCL. VAT", gtX + 4, y + 9.5);
        doc.text(formatGBP(totalIncVat), gtX + gtW - 4, y + 9.5, { align: "right" });

        y += 24;

    } else {
        const summaryRows = estimates.map((est) => {
            const markup = 1 + ((est.profit_pct || 0) + (est.overhead_pct || 0) + (est.risk_pct || 0)) / 100;
            return [est.version_name || "Estimate", formatGBP((est.total_cost || 0) * markup)];
        });

        autoTable(doc, {
            startY: y,
            head: [["Trade / Phase", "Total (£)"]],
            body: summaryRows,
            theme: "grid",
            margin: { left: ML, right: PAGE_W - MR },
            headStyles: { fillColor: C.black, textColor: C.white, fontStyle: "bold", fontSize: 9 },
            bodyStyles: { fontSize: 10, textColor: C.textDark, cellPadding: 4 },
            columnStyles: { 1: { halign: "right" as const, cellWidth: 45 } },
            alternateRowStyles: { fillColor: C.surface },
            tableLineColor: C.borderLight,
            tableLineWidth: 0.2,
            didDrawPage: () => { totalPagesRef.n = doc.getNumberOfPages(); },
        });
        y = (doc as any).lastAutoTable.finalY + 8;

        // C5: Summary total box — premium layout
        y = ensureSpace(doc, y, 40, companyName, docTitle, totalPagesRef);
        const vatAmount = grandTotal * 0.20;
        const totalIncVat = grandTotal * 1.20;

        // TOTAL (exc. VAT)
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...C.muted);
        doc.text("TOTAL (exc. VAT)", ML, y + 4);
        y += 6;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(...C.textDark);
        doc.text(formatGBP(grandTotal), ML, y + 6);
        y += 10;

        // VAT
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...C.muted);
        doc.text(`VAT @ 20%: ${formatGBP(vatAmount)}`, ML, y + 4);
        y += 8;

        // Total inc. VAT — black fill bar
        doc.setFillColor(...C.black);
        doc.rect(ML, y, CW, 14, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(...C.white);
        doc.text("TOTAL INCL. VAT", ML + 4, y + 9.5);
        doc.text(formatGBP(totalIncVat), ML + CW - 4, y + 9.5, { align: "right" });

        y += 24;
    }

    // Payment Schedule
    const paymentSchedule = project?.payment_schedule;
    if (paymentSchedule && paymentSchedule.length > 0) {
        y = ensureSpace(doc, y, 30, companyName, docTitle, totalPagesRef);
        y += 4;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...C.textDark);
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
            headStyles: { fillColor: C.black, textColor: C.white, fontStyle: "bold", fontSize: 9 },
            bodyStyles: { fontSize: 9.5, textColor: C.textDark, cellPadding: 3.5 },
            columnStyles: {
                0: { cellWidth: 45, fontStyle: "bold" },
                2: { cellWidth: 18, halign: "center" as const },
                3: { cellWidth: 35, halign: "right" as const, fontStyle: "bold" },
            },
            alternateRowStyles: { fillColor: C.surface },
            tableLineColor: C.borderLight,
            tableLineWidth: 0.2,
            didDrawPage: () => { totalPagesRef.n = doc.getNumberOfPages(); },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Validity statement
    y = ensureSpace(doc, y, 15, companyName, docTitle, totalPagesRef);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.textMid);
    const validityText = `This Proposal is valid for ${validityDays} days from the date of issue (${formatDate(today)}). After this period, rates may be subject to review.`;
    const validityLines = doc.splitTextToSize(validityText, CW);
    doc.text(validityLines, ML, y);

    // ═══════════════════════════════════════════════════════════
    // TIMELINE / GANTT (C4: Proper sequential bars)
    // ═══════════════════════════════════════════════════════════
    const phases: any[] = project?.gantt_phases || [];
    if (phases.length > 0) {
        doc.addPage();
        totalPagesRef.n++;
        y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef);
        y = renderSectionHeading(doc, y, "Project Timeline");

        // C4: Calculate start dates properly
        const allPhasesWithDates = phases.map((p: any, idx: number) => {
            let startMs: number;
            if (p.start_date) {
                startMs = new Date(p.start_date).getTime();
            } else if (project?.start_date) {
                // Sequential from project start date
                const projectStart = new Date(project.start_date).getTime();
                const prevDays = phases.slice(0, idx).reduce((sum: number, prev: any) => sum + (prev.duration_days || 7), 0);
                startMs = projectStart + prevDays * 86400000;
            } else {
                // No dates: sequential from today
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

        // C4: Find earliest start across ALL phases
        const earliestStart = Math.min(...allPhasesWithDates.map((p: any) => p.startMs));
        const latestEnd = Math.max(...allPhasesWithDates.map((p: any) => p.endMs));
        const totalDays = Math.max(1, Math.ceil((latestEnd - earliestStart) / 86400000));
        const totalWeeks = Math.ceil(totalDays / 7);

        const labelColW = 55;
        const durationColW = 25;
        const chartX = ML + labelColW + durationColW;
        const chartW = CW - labelColW - durationColW;
        const rowH = 11;
        const headerH = 13;

        // Navy header bar
        doc.setFillColor(...C.black);
        doc.rect(ML, y, CW, headerH, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...C.white);
        doc.text("Phase", ML + 3, y + 8);
        doc.text("Duration", ML + labelColW + 3, y + 8);

        // C4: Week labels calculated from earliest date
        const cappedWeeks = Math.min(totalWeeks, 24);
        const weekW = chartW / Math.max(1, cappedWeeks);
        for (let w = 0; w < cappedWeeks; w++) {
            const wx = chartX + w * weekW;
            const label = `W${w + 1}`;
            if (weekW > 6) {
                doc.text(label, wx + weekW / 2, y + 8, { align: "center" });
            } else if (w % 2 === 0) {
                doc.text(label, wx + weekW / 2, y + 8, { align: "center" });
            }
        }
        y += headerH;

        const cappedTotalDays = cappedWeeks * 7;

        allPhasesWithDates.forEach((phase: any, idx: number) => {
            if (idx % 2 === 0) {
                doc.setFillColor(...C.surface);
                doc.rect(ML, y, CW, rowH, "F");
            }

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(...C.textDark);
            doc.text(
                doc.splitTextToSize(phase.name || `Phase ${idx + 1}`, labelColW - 4)[0],
                ML + 3, y + 7
            );

            // Duration label
            const weeks = Math.round((phase.duration_days || 7) / 7);
            doc.setFontSize(7.5);
            doc.setTextColor(...C.textMid);
            doc.text(`${weeks} wk${weeks !== 1 ? "s" : ""}`, ML + labelColW + 3, y + 7);

            // C4: Bar positioned relative to earliest start
            const startOffset = (phase.startMs - earliestStart) / 86400000;
            const barX = chartX + Math.min(startOffset / cappedTotalDays, 0.95) * chartW;
            const barW = Math.max(3, Math.min((phase.duration_days / cappedTotalDays) * chartW, chartW * 0.98 - (barX - chartX)));
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

        // Border around gantt
        doc.setDrawColor(...C.borderLight);
        doc.setLineWidth(0.3);
        doc.rect(ML, y - phases.length * rowH - headerH, CW, phases.length * rowH + headerH, "S");

        y += 5;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(...C.textMid);
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

        const halfW = (CW - 8) / 2;
        const boxX2 = ML + halfW + 8;
        const boxStartY = y;
        let leftY = y + 8;
        let rightY = y + 8;

        if (project?.exclusions_text) {
            doc.setFillColor(...C.black);
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
                doc.setTextColor(...C.textDark);
                doc.text(bulletLines, ML + 4, leftY);
                leftY += bulletLines.length * 4.8 + 1.5;
            });
        }

        if (project?.clarifications_text) {
            doc.setFillColor(...C.black);
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
                doc.setTextColor(...C.textDark);
                doc.text(bulletLines, boxX2 + 4, rightY);
                rightY += bulletLines.length * 4.8 + 1.5;
            });
        }
    }

    // ═══════════════════════════════════════════════════════════
    // SITE PHOTOS
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
                doc.setFillColor(...C.surfaceMid);
                doc.rect(bx, by, boxW, boxH, "F");
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
                doc.setTextColor(...C.textMid);
                doc.text(photo.caption || "Photo", bx + boxW / 2, by + boxH / 2, { align: "center" });
            }

            if (photo.caption) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(7);
                doc.setTextColor(...C.textMid);
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
    doc.setTextColor(...C.textMid);
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
        headStyles: { fillColor: C.black, textColor: C.white, fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 8.5, textColor: C.textDark, cellPadding: 4 },
        columnStyles: {
            0: { cellWidth: 55, fontStyle: "bold", textColor: C.textDark, fontSize: 8.5 },
        },
        alternateRowStyles: { fillColor: C.surface },
        tableLineColor: C.borderLight,
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
    doc.setFillColor(...C.surface);
    doc.roundedRect(ML, y, CW, 28, 3, 3, "F");
    doc.setDrawColor(...C.borderLight);
    doc.setLineWidth(0.3);
    doc.roundedRect(ML, y, CW, 28, 3, 3, "S");

    const sumCol2 = ML + CW / 3;
    const sumCol3 = ML + (CW * 2) / 3;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...C.textMid);
    doc.text("CONTRACT VALUE", ML + 6, y + 8);
    doc.text("PROPOSED START", sumCol2 + 3, y + 8);
    doc.text("VALID UNTIL", sumCol3 + 3, y + 8);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...C.textDark);
    doc.text(contractValue > 0 ? formatGBP(contractValue) : "TBC", ML + 6, y + 21);

    doc.setFontSize(11);
    doc.text(
        project?.start_date ? formatDate(new Date(project.start_date)) : "TBC",
        sumCol2 + 3, y + 21
    );
    doc.text(formatDate(validUntil), sumCol3 + 3, y + 21);
    y += 36;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...C.textDark);
    const sigText = "By signing below, both parties agree to the Scope of Works, Fee Proposal, and Terms & Conditions set out in this document.";
    const sigLines = doc.splitTextToSize(sigText, CW);
    doc.text(sigLines, ML, y);
    y += sigLines.length * 5.5 + 10;

    const sigBoxW = (CW - 10) / 2;
    const sigBoxX2 = ML + sigBoxW + 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.textDark);
    doc.text("FOR AND ON BEHALF OF THE CONTRACTOR", ML, y);
    y += 6;
    doc.text(companyName, ML, y);
    y += 16;

    doc.setDrawColor(...C.textDark);
    doc.setLineWidth(0.5);
    doc.line(ML, y, ML + sigBoxW, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.textMid);
    doc.text("Signature", ML, y);
    y += 8;
    doc.setDrawColor(...C.muted);
    doc.setLineWidth(0.3);
    doc.line(ML, y, ML + sigBoxW, y);
    y += 5;
    doc.text("Print Name", ML, y);
    y += 8;
    doc.line(ML, y, ML + sigBoxW, y);
    y += 5;
    doc.text("Date", ML, y);

    const rightStartY = y - 26 - 8 - 8 - 5 - 5 - 5 - 16 - 5 - 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.textDark);
    doc.text("FOR AND ON BEHALF OF THE CLIENT", sigBoxX2, rightStartY);
    doc.text(clientName, sigBoxX2, rightStartY + 6);

    doc.setDrawColor(...C.textDark);
    doc.setLineWidth(0.5);
    doc.line(sigBoxX2, rightStartY + 22, sigBoxX2 + sigBoxW, rightStartY + 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.textMid);
    doc.text("Signature", sigBoxX2, rightStartY + 27);

    doc.setDrawColor(...C.muted);
    doc.setLineWidth(0.3);
    doc.line(sigBoxX2, rightStartY + 35, sigBoxX2 + sigBoxW, rightStartY + 35);
    doc.text("Print Name", sigBoxX2, rightStartY + 40);

    doc.line(sigBoxX2, rightStartY + 48, sigBoxX2 + sigBoxW, rightStartY + 48);
    doc.text("Date", sigBoxX2, rightStartY + 53);

    y += 16;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.textMid);
    const smallPrint = `This Proposal was generated by ${companyName} using Constructa. Acceptance of this proposal constitutes a binding agreement to the stated terms. Ref: ${refCode}.`;
    const spLines = doc.splitTextToSize(smallPrint, CW);
    doc.text(spLines, ML, y);

    const filename = `${projectName.replace(/[^a-z0-9]/gi, "_")}_Proposal_${refCode}.pdf`;
    doc.save(filename);
}
