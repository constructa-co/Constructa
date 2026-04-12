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
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
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

// ── Standard T&C clauses ───────────────────────────────────────────────────

export const STANDARD_TC_CLAUSES = [
    ["1 — Jurisdiction", "The law of Contract is the Law of England and Wales. The Language of this Contract is English."],
    ["2 — Responsibilities", "The Works are detailed within the Scope of Works attached to this Proposal. All Works are to meet Statutory Requirements, including all applicable British and European Standards, and industry best practices."],
    ["3 — Alternative Dispute Resolution", "Should any dispute arise which cannot be resolved by negotiation, escalation shall be via Adjudication. The Adjudicating Nominated Body is the Royal Institute of Chartered Surveyors (RICS), under the RICS Homeowner Adjudication Scheme."],
    ["4 — Liability", "The Defect Liability Period is 12 months from the date of Completion Certificate. Any Defects notified within the Defect Period are to be promptly rectified by the Contractor."],
    ["5 — Workmanship", "All Works are to be performed using reasonable skill and care to that of a competent Contractor with experience on projects of similar size and scope."],
    ["6 — Insurances", "The Contractor shall maintain throughout the Works: Public Liability Insurance; Employers Liability Insurance; Contractors All Risk Insurance. Evidence of current policies available on request."],
    ["7 — Payments", "Payment dates are 21 Calendar days from receipt of Application. Any deductions by the Client must be formally notified as a 'Pay-Less-Notice' no later than 7 days following receipt of Application."],
    ["8 — Change Management", "Any Variations to the Scope must be issued in writing. The Contractor will respond within 7 Calendar days with any Cost and/or Time implications."],
    ["9 — Health, Safety & CDM", "The Client is a Domestic Client under the Construction Design Management (CDM) Regulations 2015. The Contractor shall act as Principal Contractor and comply with all CDM requirements."],
    ["10 — Materials & Ownership", "All materials supplied and fixed by the Contractor shall remain the property of the Contractor until payment in full has been received. Risk in materials passes to the Client on delivery to site."],
    ["11 — Practical Completion", "Practical Completion shall be certified in writing by the Contractor upon substantial completion of the Works. Minor snags shall not prevent Practical Completion being declared, provided they are remedied within the Defect Liability Period."],
    ["12 — Confidentiality", "The terms, pricing, and conditions contained within this Proposal and resulting Contract are confidential between the parties and shall not be disclosed to any third party without the prior written consent of the other party."],
];

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
