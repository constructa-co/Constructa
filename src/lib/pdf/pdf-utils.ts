/**
 * Constructa — Unified PDF Utilities
 * 
 * Shared helpers for all PDF generators in the app.
 * All documents use consistent branding, fonts, and layout logic.
 * 
 * Usage:
 *   import { buildDocHeader, checkPageBreak, buildDocFooter, BRAND } from "@/lib/pdf/pdf-utils";
 */

import jsPDF from "jspdf";

// ─── Brand Constants ──────────────────────────────────────────────────────────
export const BRAND = {
    // Colour palette (RGB)
    navy:    [15,  23,  42]  as [number, number, number],  // slate-950
    slate:   [30,  41,  59]  as [number, number, number],  // slate-800
    mid:     [100, 116, 139] as [number, number, number],  // slate-500
    light:   [226, 232, 240] as [number, number, number],  // slate-200
    white:   [255, 255, 255] as [number, number, number],
    blue:    [37,  99,  235] as [number, number, number],  // blue-600
    green:   [22,  163, 74]  as [number, number, number],  // green-600
    red:     [220, 38,  38]  as [number, number, number],  // red-600
    // Page margins
    marginL: 14,
    marginR: 196,
    pageW:   210,
    pageH:   297,
    contentW: 182,
};

// ─── Page Break Helper ────────────────────────────────────────────────────────
/**
 * Checks if adding `heightNeeded` would overflow the page.
 * If so, adds a new page and returns the reset Y position.
 * Otherwise returns the current Y unchanged.
 */
export function checkPageBreak(doc: jsPDF, y: number, heightNeeded: number): number {
    if (y + heightNeeded > BRAND.pageH - 20) {
        doc.addPage();
        return 25;
    }
    return y;
}

// ─── Document Header ──────────────────────────────────────────────────────────
/**
 * Renders the standard Constructa document header on the current page.
 * Includes company name, optional company details, a ruled divider, and document title.
 * Returns the Y position after the header, ready for content.
 */
export function buildDocHeader(
    doc: jsPDF,
    options: {
        documentTitle: string;
        // Sprint 58 P3.3 — accept `null` on every field so callers can pass
        // Supabase rows straight through without coercing away nulls.
        profile?: {
            company_name?: string | null;
            address_line1?: string | null;
            city?: string | null;
            postcode?: string | null;
            phone?: string | null;
            email?: string | null;
            website?: string | null;
        };
        rightBlockLines?: string[]; // Optional right-aligned summary block (e.g. invoice totals)
    }
): number {
    const { documentTitle, profile, rightBlockLines } = options;
    let y = 20;

    // Company name (large, bold)
    const companyName = profile?.company_name || "CONSTRUCTA";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...BRAND.navy);
    doc.text(companyName, BRAND.marginL, y);
    y += 7;

    // Company contact details (small, muted)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.mid);
    const contactParts = [
        profile?.address_line1,
        profile?.city,
        profile?.postcode,
        profile?.phone,
        profile?.email,
        profile?.website,
    ].filter(Boolean);
    if (contactParts.length > 0) {
        doc.text(contactParts.join("  |  "), BRAND.marginL, y);
        y += 5;
    }

    // Optional right-side block (e.g. ref, dates)
    if (rightBlockLines && rightBlockLines.length > 0) {
        const blockStartY = 20;
        doc.setFontSize(9);
        doc.setTextColor(...BRAND.slate);
        rightBlockLines.forEach((line, i) => {
            doc.text(line, BRAND.marginR, blockStartY + i * 5, { align: "right" });
        });
    }

    // Divider rule
    y += 3;
    doc.setDrawColor(...BRAND.light);
    doc.setLineWidth(0.5);
    doc.line(BRAND.marginL, y, BRAND.marginR, y);
    y += 8;

    // Document title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...BRAND.navy);
    doc.text(documentTitle.toUpperCase(), BRAND.marginL, y);
    y += 8;

    // Reset to body defaults
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.slate);

    return y;
}

// ─── Section Heading ──────────────────────────────────────────────────────────
/**
 * Renders a section heading with a subtle background band.
 * Returns Y position after the heading.
 */
export function buildSectionHeading(doc: jsPDF, y: number, title: string): number {
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(BRAND.marginL, y - 4, BRAND.contentW, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.navy);
    doc.text(title.toUpperCase(), BRAND.marginL + 2, y + 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.slate);
    return y + 12;
}

// ─── Body Text Renderer ───────────────────────────────────────────────────────
/**
 * Renders a block of body text with automatic page breaks.
 * Returns the Y position after the text.
 */
export function buildBodyText(doc: jsPDF, y: number, text: string, fontSize = 10): number {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(...BRAND.slate);
    const lines = doc.splitTextToSize(text, BRAND.contentW);
    lines.forEach((line: string) => {
        y = checkPageBreak(doc, y, 6);
        doc.text(line, BRAND.marginL, y);
        y += 5.5;
    });
    return y + 2;
}

// ─── Key-Value Row ────────────────────────────────────────────────────────────
/**
 * Renders a single key: value line (e.g. "Client: Acme Ltd").
 */
export function buildKeyValue(doc: jsPDF, y: number, label: string, value: string): number {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.mid);
    doc.text(label.toUpperCase(), BRAND.marginL, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.slate);
    doc.text(value, BRAND.marginL + 40, y);
    return y + 6;
}

// ─── Document Footer ──────────────────────────────────────────────────────────
/**
 * Renders a page footer on the current page.
 * Typically called after all content is rendered.
 */
export function buildDocFooter(doc: jsPDF, pageNum: number, totalPages: number, tagline = "Generated by Constructa"): void {
    const footerY = BRAND.pageH - 10;
    doc.setDrawColor(...BRAND.light);
    doc.line(BRAND.marginL, footerY - 4, BRAND.marginR, footerY - 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...BRAND.mid);
    doc.text(tagline, BRAND.marginL, footerY);
    doc.text(`Page ${pageNum} of ${totalPages}`, BRAND.marginR, footerY, { align: "right" });
}

// ─── Signature Block ──────────────────────────────────────────────────────────
/**
 * Renders a signature/execution block at the bottom of a page.
 */
export function buildSignatureBlock(doc: jsPDF, y: number): number {
    y = checkPageBreak(doc, y, 60);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.navy);
    doc.text("ACCEPTANCE & SIGNATURE", BRAND.marginL, y);
    y += 8;

    // Two columns: contractor + client
    const col1 = BRAND.marginL;
    const col2 = BRAND.marginL + 95;

    ["Signed for The Contractor:", "Signed for The Client:"].forEach((label, i) => {
        const x = i === 0 ? col1 : col2;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...BRAND.mid);
        doc.text(label, x, y);
        doc.setDrawColor(...BRAND.mid);
        doc.line(x, y + 12, x + 80, y + 12);
        doc.text("Name (Print):", x, y + 20);
        doc.line(x, y + 25, x + 80, y + 25);
        doc.text("Date:", x, y + 33);
        doc.line(x, y + 38, x + 45, y + 38);
    });

    return y + 50;
}
