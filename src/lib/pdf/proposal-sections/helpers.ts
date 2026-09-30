/**
 * Constructa — Proposal PDF shared helpers.
 *
 * Pure layout primitives used by every proposal section builder.
 * Delegates theme and money formatting to the canonical shared
 * modules so drift between generators is structurally prevented.
 */

import jsPDF from "jspdf";
import { type PdfThemePalette, PAGE_GEOMETRY, GANTT_COLORS } from "@/lib/pdf/pdf-theme";
import { formatGbp } from "@/lib/pdf/pdf-money";

// Re-export so section builders can import from one place
export { type PdfThemePalette, PAGE_GEOMETRY, GANTT_COLORS, formatGbp };

// ── Page geometry aliases ──────────────────────────────────────────────────
// Short names used throughout the proposal sections.
export const PAGE_W = PAGE_GEOMETRY.width;
export const PAGE_H = PAGE_GEOMETRY.height;
export const ML = PAGE_GEOMETRY.marginLeft;
export const MR = PAGE_GEOMETRY.marginRight;
export const CW = PAGE_GEOMETRY.contentWidth;
export const HEADER_H = PAGE_GEOMETRY.headerHeight;
export const FOOTER_H = PAGE_GEOMETRY.footerHeight;
export const CONTENT_TOP = HEADER_H + 8;
export const CONTENT_BOTTOM = PAGE_H - FOOTER_H - 6;

// ── Section counter ────────────────────────────────────────────────────────
// Mutable counter shared across sections. Reset to 1 at the start of each
// PDF build via `resetSectionCounter()`.

let sectionCounter = 0;

export function resetSectionCounter(): void {
    sectionCounter = 1;
}

// ── Text helpers ───────────────────────────────────────────────────────────

export function splitAddress(address: string): string[] {
    if (!address) return [];
    return address
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\s{2,}/g, " ")
        .replace(/,\s*/g, "\n")
        .split("\n")
        .map(s => s.trim())
        .filter(Boolean);
}

export function formatDate(d: Date): string {
    return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    });
}

export function sanitiseText(text: string): string {
    return text
        .replace(/[^\x20-\x7E\n]/g, "")
        .replace(/●/g, "-")
        .replace(/•/g, "-")
        .trim();
}

export function normaliseAddress(addr: string): string {
    if (!addr) return "";
    return addr
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/,\s*/g, "\n")
        .replace(/\n+/g, "\n")
        .trim();
}

// ── Layout primitives ──────────────────────────────────────────────────────

export function addPageHeader(
    doc: jsPDF,
    companyName: string,
    docTitle: string,
    pageNum: number,
    totalPagesRef: { n: number },
    T: PdfThemePalette,
): number {
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

export function renderSectionHeading(doc: jsPDF, y: number, text: string, T: PdfThemePalette): number {
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

export function renderBodyText(
    doc: jsPDF,
    y: number,
    text: string,
    T: PdfThemePalette,
    maxWidth: number = CW,
    x: number = ML,
): number {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...T.textDark);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return y + lines.length * 5.8;
}

export function ensureSpace(
    doc: jsPDF,
    y: number,
    needed: number,
    companyName: string,
    docTitle: string,
    totalPagesRef: { n: number },
    T: PdfThemePalette,
): number {
    if (y + needed > CONTENT_BOTTOM) {
        doc.addPage();
        totalPagesRef.n++;
        return addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef, T);
    }
    return y;
}

// ── Common context passed through every section builder ────────────────────

export interface ProposalContext {
    doc: jsPDF;
    T: PdfThemePalette;
    companyName: string;
    clientName: string;
    projectName: string;
    address: string;
    clientAddress: string;
    projectType: string;
    docTitle: string;
    refCode: string;
    today: Date;
    validUntil: Date;
    validityDays: number;
    pricingMode: "full" | "summary";
    displayTotal: number;
    contractValue: number;
    totalPagesRef: { n: number };
    profile: any;
    project: any;
    pdfEstimates: any[];
    computeContractSum: (est: any) => any;
    scopeBullets: string[];
}
