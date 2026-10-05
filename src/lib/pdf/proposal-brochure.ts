/**
 * The proposal as an A4 PDF.
 *
 * Draws a `ProposalDocument`, the same model the public page renders, so
 * the PDF cannot state a different price, date, term or response wording.
 *
 * Nothing is tied to a page number. Content flows down the page and breaks
 * where it needs to:
 *  - a heading is never left at the foot of a page without what it heads;
 *  - a table row, a photograph with its caption, a stage and the response
 *    block are never split;
 *  - a paragraph is never broken so that one line sits alone;
 *  - a section starts a new page only when too little of the current page
 *    is left to be worth using, so a short proposal is not padded out and
 *    a long one is not cut off.
 *
 * Every drawn item is recorded in a layout log, which the tests read to
 * check those rules instead of trusting them.
 */

import jsPDF from "jspdf";
import {
    PROGRAMME_BASIS_NOTE,
    formatDateRange,
    formatPlanDate,
    formatWorkingDuration,
    stageBar,
} from "@/lib/programme-plan";
import type { ProposalPublicationSnapshot } from "@/lib/proposal-publication";
import {
    DOCUMENT_THEMES,
    buildProposalDocument,
    documentImageUrls,
    type DocBlock,
    type DocFact,
    type ProposalDocument,
} from "@/lib/proposal-document";

// ── Page geometry (A4 portrait, mm) ──────────────────────────────────────────

export const PAGE = {
    width: 210,
    height: 297,
    left: 20,
    right: 190,
    contentWidth: 170,
    contentTop: 24,
    contentBottom: 274,
    headerRule: 15,
    footerText: 286,
} as const;

/** A section starts a new page when less than this much of the page is left. */
const SECTION_MIN_SPACE = 80;
const PT_TO_MM = 0.3528;

type Rgb = [number, number, number];
const INK: Rgb = [28, 25, 23];
const BODY: Rgb = [68, 64, 60];
const MUTED: Rgb = [120, 113, 108];
const RULE: Rgb = [214, 211, 209];

function hexToRgb(hex: string): Rgb {
    const value = hex.replace("#", "");
    return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

/**
 * The standard PDF fonts cover Latin-1 only. Typographic quotes, dashes and
 * bullets are replaced with their plain forms; anything else outside the
 * set is dropped rather than drawn as the wrong character.
 */
export function pdfText(value: string): string {
    return value
        .replace(/[‘’‚′]/g, "'")
        .replace(/[“”„″]/g, '"')
        .replace(/[–—−]/g, "-")
        .replace(/…/g, "...")
        .replace(/[•●·]/g, "-")
        .replace(/ /g, " ")
        .replace(/[^\x20-\x7e¡-ÿ]/g, "")
        .trim();
}

// ── Images ───────────────────────────────────────────────────────────────────

export interface LoadedImage {
    /** A data URL jsPDF can embed. */
    data: string;
    format: "PNG" | "JPEG";
    width: number;
    height: number;
}

export type ImageMap = Map<string, LoadedImage>;

/**
 * Loads the document's images in the browser. Photographs are re-encoded as
 * JPEG no larger than 1600px so the PDF stays a sensible size; the logo is
 * kept as PNG so a transparent background survives. An image that cannot be
 * loaded is simply absent from the result.
 */
export async function loadDocumentImages(doc: ProposalDocument): Promise<ImageMap> {
    const images: ImageMap = new Map();
    await Promise.all(documentImageUrls(doc).map(async (url) => {
        try {
            const response = await fetch(url, { mode: "cors" });
            if (!response.ok) return;
            const bitmap = await createImageBitmap(await response.blob());
            const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            const context = canvas.getContext("2d");
            if (!context) return;
            const isLogo = url === doc.company.logoUrl;
            if (!isLogo) {
                context.fillStyle = "#ffffff";
                context.fillRect(0, 0, canvas.width, canvas.height);
            }
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            images.set(url, {
                data: isLogo ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.88),
                format: isLogo ? "PNG" : "JPEG",
                width: canvas.width,
                height: canvas.height,
            });
        } catch {
            // Left out of the PDF; the caller reports how many were skipped.
        }
    }));
    return images;
}

// ── Layout log ───────────────────────────────────────────────────────────────

export interface LayoutEntry {
    page: number;
    /** What was drawn: "section-heading", "subheading", "text", "row", "photo", "response" and so on. */
    kind: string;
    section: string;
    top: number;
    bottom: number;
    /** Ties the parts of one unbreakable unit together, e.g. a photo and its caption. */
    group?: string;
}

export interface BrochureResult {
    doc: jsPDF;
    pages: number;
    layout: LayoutEntry[];
    /** Images the document names that were not available to draw. */
    skippedImages: string[];
}

// ── Renderer ─────────────────────────────────────────────────────────────────

interface TextStyle {
    font: "helvetica" | "times";
    style: "normal" | "bold" | "italic";
    size: number;
    color: Rgb;
    /** Line height in mm. */
    lineHeight: number;
}

const STYLES = {
    body: { font: "helvetica", style: "normal", size: 10.5, color: BODY, lineHeight: 5.3 },
    lead: { font: "helvetica", style: "normal", size: 11.5, color: BODY, lineHeight: 6 },
    small: { font: "helvetica", style: "normal", size: 9, color: MUTED, lineHeight: 4.4 },
    strong: { font: "helvetica", style: "bold", size: 10.5, color: INK, lineHeight: 5.3 },
    label: { font: "helvetica", style: "bold", size: 7.5, color: MUTED, lineHeight: 3.8 },
    term: { font: "helvetica", style: "normal", size: 9, color: BODY, lineHeight: 4.4 },
    termTitle: { font: "helvetica", style: "bold", size: 9, color: INK, lineHeight: 4.6 },
    quote: { font: "times", style: "italic", size: 12, color: INK, lineHeight: 6 },
} satisfies Record<string, TextStyle>;

export function renderProposalBrochure(document: ProposalDocument, images: ImageMap = new Map()): BrochureResult {
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const theme = DOCUMENT_THEMES[document.theme];
    const ACCENT = hexToRgb(theme.accent);
    const SOFT = hexToRgb(theme.accentSoft);
    const HIGHLIGHT = hexToRgb(theme.highlight);

    const layout: LayoutEntry[] = [];
    const skippedImages: string[] = [];
    let page = 1;
    let y: number = PAGE.contentTop;
    let section = "cover";
    let groupCounter = 0;

    const log = (kind: string, top: number, bottom: number, group?: string) => {
        layout.push({ page, kind, section, top: round(top), bottom: round(bottom), ...(group ? { group } : {}) });
    };
    const remaining = () => PAGE.contentBottom - y;
    const newPage = () => {
        pdf.addPage();
        page += 1;
        y = PAGE.contentTop;
    };
    /** Moves to a new page when `height` does not fit. Returns true when it did. */
    const ensure = (height: number): boolean => {
        if (y > PAGE.contentTop && y + height > PAGE.contentBottom) {
            newPage();
            return true;
        }
        return false;
    };

    const apply = (style: TextStyle) => {
        pdf.setFont(style.font, style.style);
        pdf.setFontSize(style.size);
        pdf.setTextColor(...style.color);
    };
    const wrap = (text: string, width: number, style: TextStyle): string[] => {
        apply(style);
        const cleaned = pdfText(text);
        return cleaned ? (pdf.splitTextToSize(cleaned, width) as string[]) : [];
    };
    /** Baseline offset so `top` is the top of the first line. */
    const ascent = (style: TextStyle) => style.size * PT_TO_MM * 0.8;

    /** Draws lines that must stay together. The caller has already made room. */
    const drawBlockLines = (linesToDraw: string[], x: number, top: number, style: TextStyle, align: "left" | "right" = "left") => {
        apply(style);
        linesToDraw.forEach((line, index) => {
            pdf.text(line, x, top + ascent(style) + index * style.lineHeight, { align });
        });
        return linesToDraw.length * style.lineHeight;
    };

    /**
     * Draws a paragraph that may run over a page. It never leaves a single
     * line behind or carries a single line over.
     */
    const flowLines = (linesToDraw: string[], x: number, style: TextStyle, kind = "text") => {
        const total = linesToDraw.length;
        if (total === 0) return;
        ensure(Math.min(total, 2) * style.lineHeight);
        let segmentTop = y;
        linesToDraw.forEach((line, index) => {
            const left = total - index;
            const lastPairWontFit = left === 2 && y + 2 * style.lineHeight > PAGE.contentBottom;
            if (index > 0 && (y + style.lineHeight > PAGE.contentBottom || lastPairWontFit)) {
                log(kind, segmentTop, y);
                newPage();
                segmentTop = y;
            }
            apply(style);
            pdf.text(line, x, y + ascent(style));
            y += style.lineHeight;
        });
        log(kind, segmentTop, y);
    };

    const paragraphs = (items: string[], style: TextStyle = STYLES.body, x: number = PAGE.left, width: number = PAGE.contentWidth) => {
        items.forEach((item, index) => {
            flowLines(wrap(item, width, style), x, style);
            if (index < items.length - 1) y += 2.4;
        });
    };

    // ── Measuring the first unbreakable part of a block ──────────────────────
    // Used so a heading always has something under it on the same page.

    const factColumns = (count: number) => (count >= 2 ? 2 : 1);
    const factRowHeight = (row: DocFact[], columnWidth: number) =>
        Math.max(...row.map((fact) => STYLES.label.lineHeight + 1.2 + wrap(fact.value, columnWidth, STYLES.body).length * STYLES.body.lineHeight)) + 5;

    const photoCell = (url: string, cellWidth: number): { width: number; height: number } | null => {
        const image = images.get(url);
        if (!image) return null;
        const maxHeight = cellWidth * 0.75;
        const natural = cellWidth * (image.height / image.width);
        return natural <= maxHeight ? { width: cellWidth, height: natural } : { width: maxHeight * (image.width / image.height), height: maxHeight };
    };

    const PHOTO_GAP = 6;
    const photoWidth = (PAGE.contentWidth - PHOTO_GAP) / 2;
    const photoRowHeight = (row: Array<{ url: string; caption: string | null }>) =>
        Math.max(...row.map((photo) => {
            const cell = photoCell(photo.url, photoWidth);
            const caption = photo.caption ? wrap(photo.caption, photoWidth, STYLES.small).length * STYLES.small.lineHeight + 2 : 0;
            return (cell?.height ?? 0) + caption;
        }));

    const priceRowHeight = (item: { description: string; quantity: string }) =>
        wrap(item.description, PAGE.contentWidth - 42, STYLES.body).length * STYLES.body.lineHeight
        + (item.quantity ? STYLES.small.lineHeight : 0) + 5;

    const paymentRowHeight = (row: { stage: string; when: string | null }) =>
        wrap(row.stage, PAGE.contentWidth - 62, STYLES.strong).length * STYLES.strong.lineHeight
        + (row.when ? wrap(row.when, PAGE.contentWidth - 62, STYLES.small).length * STYLES.small.lineHeight : 0) + 5;

    const STAGE_ROW = 13;
    const TIMELINE_FACTS = 16;

    const firstPartHeight = (block: DocBlock | undefined): number => {
        if (!block) return 0;
        switch (block.type) {
            case "paragraphs": {
                const first = wrap(block.paragraphs[0] ?? "", PAGE.contentWidth, STYLES.body);
                return Math.min(first.length, 2) * STYLES.body.lineHeight;
            }
            case "subheading":
                return 9;
            case "bullets":
                return Math.min(wrap(block.items[0] ?? "", PAGE.contentWidth - 6, STYLES.body).length, 4) * STYLES.body.lineHeight;
            case "facts":
                return factRowHeight(block.items.slice(0, factColumns(block.items.length)), PAGE.contentWidth / 2 - 6);
            case "quote":
                return 3 * STYLES.quote.lineHeight + 8;
            case "photos": {
                const visible = block.photos.filter((photo) => images.has(photo.url));
                return visible.length > 0 ? photoRowHeight(visible.slice(0, 2)) : 0;
            }
            case "price":
                return (block.groups[0]?.title ? 8 : 0) + (block.groups[0]?.items[0] ? priceRowHeight(block.groups[0].items[0]) : 0);
            case "payments":
                return block.rows[0] ? paymentRowHeight(block.rows[0]) : 0;
            case "timeline":
                return TIMELINE_FACTS + STAGE_ROW;
            case "stageList":
                return 16;
            case "terms": {
                const first = block.clauses[0];
                if (!first) return 0;
                const columnWidth = (PAGE.contentWidth - 8) / 2;
                return wrap(`${first.number}. ${first.title}`, columnWidth, STYLES.termTitle).length * STYLES.termTitle.lineHeight
                    + Math.min(wrap(first.body, columnWidth, STYLES.term).length, 12) * STYLES.term.lineHeight;
            }
            case "caseStudy":
                return 14 + (block.facts.length > 0 ? factRowHeight(block.facts.slice(0, 2), PAGE.contentWidth / 2 - 6) : 12);
        }
    };

    // ── Blocks ───────────────────────────────────────────────────────────────

    const subheading = (text: string, next?: DocBlock) => {
        y += 3;
        ensure(6 + firstPartHeight(next));
        const top = y;
        apply({ ...STYLES.label, size: 8.5, color: INK });
        pdf.text(pdfText(text).toUpperCase(), PAGE.left, y + 3, { charSpace: 0.4 });
        y += 7;
        log("subheading", top, y);
    };

    const bullets = (items: string[]) => {
        items.forEach((item) => {
            const wrapped = wrap(item, PAGE.contentWidth - 6, STYLES.body);
            if (wrapped.length === 0) return;
            const dot = () => {
                pdf.setFillColor(...ACCENT);
                pdf.circle(PAGE.left + 1.2, y + 2.2, 0.75, "F");
            };
            if (wrapped.length <= 4) {
                ensure(wrapped.length * STYLES.body.lineHeight);
                dot();
                const top = y;
                y += drawBlockLines(wrapped, PAGE.left + 6, y, STYLES.body);
                log("bullet", top, y);
            } else {
                ensure(2 * STYLES.body.lineHeight);
                dot();
                flowLines(wrapped, PAGE.left + 6, STYLES.body, "bullet");
            }
            y += 1.8;
        });
    };

    const facts = (items: DocFact[]) => {
        const columns = factColumns(items.length);
        const columnWidth = PAGE.contentWidth / columns - (columns > 1 ? 6 : 0);
        for (let index = 0; index < items.length; index += columns) {
            const row = items.slice(index, index + columns);
            const height = factRowHeight(row, columnWidth);
            ensure(height);
            const top = y;
            row.forEach((fact, column) => {
                const x = PAGE.left + column * (PAGE.contentWidth / columns);
                pdf.setDrawColor(...RULE);
                pdf.setLineWidth(0.2);
                pdf.line(x, top, x + columnWidth, top);
                apply(STYLES.label);
                pdf.text(pdfText(fact.label).toUpperCase(), x, top + 4.4, { charSpace: 0.3 });
                drawBlockLines(wrap(fact.value, columnWidth, STYLES.body), x, top + 6.2, { ...STYLES.body, color: INK });
            });
            y += height;
            log("row", top, y);
        }
    };

    const quote = (items: string[], attribution: string | null) => {
        const innerWidth = PAGE.contentWidth - 14;
        const wrapped = items.map((item) => wrap(item, innerWidth, STYLES.quote));
        const attributionHeight = attribution ? 7 : 0;
        const textHeight = wrapped.reduce((sum, linesOfItem) => sum + linesOfItem.length * STYLES.quote.lineHeight, 0) + (wrapped.length - 1) * 2.4;
        const height = textHeight + attributionHeight + 10;

        if (height <= PAGE.contentBottom - PAGE.contentTop) {
            // Short enough to keep as one tinted panel.
            ensure(height);
            const top = y;
            pdf.setFillColor(...SOFT);
            pdf.rect(PAGE.left, top, PAGE.contentWidth, height, "F");
            pdf.setFillColor(...ACCENT);
            pdf.rect(PAGE.left, top, 0.9, height, "F");
            let cursor = top + 5;
            wrapped.forEach((linesOfItem) => {
                cursor += drawBlockLines(linesOfItem, PAGE.left + 8, cursor, STYLES.quote) + 2.4;
            });
            if (attribution) drawBlockLines([pdfText(attribution)], PAGE.left + 8, top + height - 9.5, STYLES.strong);
            y = top + height;
            log("quote", top, y);
        } else {
            // Longer than a page: flow it as indented text instead.
            wrapped.forEach((linesOfItem) => {
                flowLines(linesOfItem, PAGE.left + 8, STYLES.quote, "quote");
                y += 2.4;
            });
            if (attribution) {
                ensure(STYLES.strong.lineHeight);
                const top = y;
                y += drawBlockLines([pdfText(attribution)], PAGE.left + 8, y, STYLES.strong);
                log("quote", top, y);
            }
        }
    };

    const drawImage = (url: string, x: number, top: number, cellWidth: number, size: { width: number; height: number }) => {
        const image = images.get(url);
        if (!image) return;
        pdf.addImage(image.data, image.format, x + (cellWidth - size.width) / 2, top, size.width, size.height, undefined, "FAST");
    };

    const photos = (items: Array<{ url: string; caption: string | null }>) => {
        const visible = items.filter((photo) => {
            if (images.has(photo.url)) return true;
            skippedImages.push(photo.url);
            return false;
        });
        for (let index = 0; index < visible.length; index += 2) {
            const row = visible.slice(index, index + 2);
            const height = photoRowHeight(row);
            ensure(height);
            const top = y;
            row.forEach((photo, column) => {
                const x = PAGE.left + column * (photoWidth + PHOTO_GAP);
                const size = photoCell(photo.url, photoWidth);
                if (!size) return;
                const group = `photo-${++groupCounter}`;
                drawImage(photo.url, x, top, photoWidth, size);
                log("photo", top, top + size.height, group);
                if (photo.caption) {
                    const captionLines = wrap(photo.caption, photoWidth, STYLES.small);
                    const captionTop = top + size.height + 2;
                    drawBlockLines(captionLines, x, captionTop, STYLES.small);
                    log("caption", captionTop, captionTop + captionLines.length * STYLES.small.lineHeight, group);
                }
            });
            y += height + 5;
        }
    };

    const ruleAt = (at: number) => {
        pdf.setDrawColor(...RULE);
        pdf.setLineWidth(0.2);
        pdf.line(PAGE.left, at, PAGE.right, at);
    };

    const totalsHeight = (totals: Array<DocFact & { strong: boolean }>) =>
        totals.reduce((sum, total) => sum + (total.strong ? 14 : 6.5), 0) + 4;

    const price = (block: Extract<DocBlock, { type: "price" }>) => {
        const groupLabel = (title: string, continued: boolean) => {
            const top = y;
            apply({ ...STYLES.label, size: 8.5, color: INK });
            pdf.text(`${pdfText(title).toUpperCase()}${continued ? " (CONTINUED)" : ""}`, PAGE.left, y + 3, { charSpace: 0.4 });
            y += 6.5;
            log("subheading", top, y);
        };

        block.groups.forEach((group, groupIndex) => {
            if (groupIndex > 0) y += 4;
            if (group.title) {
                ensure(6.5 + (group.items[0] ? priceRowHeight(group.items[0]) : 0));
                groupLabel(group.title, false);
            }
            ruleAt(y);
            group.items.forEach((item, itemIndex) => {
                const height = priceRowHeight(item);
                const isLastRow = groupIndex === block.groups.length - 1 && itemIndex === group.items.length - 1;
                // The totals are never left on a page without the last line they total.
                if (ensure(height + (isLastRow ? totalsHeight(block.totals) : 0))) {
                    groupLabel(group.title ?? "Price", true);
                    ruleAt(y);
                }
                const top = y;
                const descriptionLines = wrap(item.description, PAGE.contentWidth - 42, STYLES.body);
                let cursor = top + 2.5;
                cursor += drawBlockLines(descriptionLines, PAGE.left, cursor, { ...STYLES.body, color: INK });
                if (item.quantity) drawBlockLines([pdfText(item.quantity)], PAGE.left, cursor, STYLES.small);
                drawBlockLines([item.amount], PAGE.right, top + 2.5, { ...STYLES.body, color: INK }, "right");
                y += height;
                ruleAt(y);
                log("row", top, y);
            });
        });

        const height = totalsHeight(block.totals);
        ensure(height);
        const top = y;
        y += 4;
        const labelX = PAGE.left + PAGE.contentWidth * 0.4;
        block.totals.forEach((total) => {
            if (total.strong) {
                pdf.setDrawColor(...ACCENT);
                pdf.setLineWidth(0.6);
                pdf.line(labelX, y + 1, PAGE.right, y + 1);
                drawBlockLines([pdfText(total.label)], labelX, y + 6, STYLES.strong);
                drawBlockLines([total.value], PAGE.right, y + 4, { font: "times", style: "normal", size: 20, color: INK, lineHeight: 8 }, "right");
                y += 14;
            } else {
                drawBlockLines([pdfText(total.label)], labelX, y, STYLES.body);
                drawBlockLines([total.value], PAGE.right, y, { ...STYLES.body, color: INK }, "right");
                y += 6.5;
            }
        });
        log("totals", top, y);
        if (block.note) {
            y += 2;
            flowLines(wrap(block.note, PAGE.contentWidth, STYLES.small), PAGE.left, STYLES.small);
        }
    };

    const payments = (block: Extract<DocBlock, { type: "payments" }>) => {
        ruleAt(y);
        block.rows.forEach((row) => {
            const height = paymentRowHeight(row);
            if (ensure(height)) ruleAt(y);
            const top = y;
            let cursor = top + 2.5;
            cursor += drawBlockLines(wrap(row.stage, PAGE.contentWidth - 62, STYLES.strong), PAGE.left, cursor, STYLES.strong);
            if (row.when) drawBlockLines(wrap(row.when, PAGE.contentWidth - 62, STYLES.small), PAGE.left, cursor, STYLES.small);
            if (row.share) drawBlockLines([row.share], PAGE.right - 34, top + 2.5, STYLES.body, "right");
            drawBlockLines([row.amount], PAGE.right, top + 2.5, { ...STYLES.body, color: INK }, "right");
            y += height;
            ruleAt(y);
            log("row", top, y);
        });
        if (block.note) {
            y += 2;
            flowLines(wrap(block.note, PAGE.contentWidth, STYLES.small), PAGE.left, STYLES.small);
        }
    };

    const timeline = (block: Extract<DocBlock, { type: "timeline" }>) => {
        const { plan } = block;
        const headline: DocFact[] = [
            { label: "Start on site", value: formatPlanDate(plan.start_date) },
            { label: "Finish", value: formatPlanDate(plan.end_date) },
            { label: "Duration", value: plan.duration_label },
        ];
        ensure(TIMELINE_FACTS + STAGE_ROW);
        const factsTop = y;
        const columnWidth = PAGE.contentWidth / 3;
        headline.forEach((fact, column) => {
            const x = PAGE.left + column * columnWidth;
            apply(STYLES.label);
            pdf.text(fact.label.toUpperCase(), x, factsTop + 3, { charSpace: 0.3 });
            drawBlockLines(wrap(fact.value, columnWidth - 4, STYLES.strong), x, factsTop + 5.5, STYLES.strong);
        });
        y += TIMELINE_FACTS;
        log("row", factsTop, y);
        ruleAt(y);
        y += 3;

        plan.stages.forEach((stage, index) => {
            const isLast = index === plan.stages.length - 1;
            // The date axis and the basis note stay with the last stage.
            ensure(STAGE_ROW + (isLast ? 12 : 0));
            const top = y;
            drawBlockLines(wrap(stage.name, PAGE.contentWidth - 78, STYLES.strong).slice(0, 1), PAGE.left, top, STYLES.strong);
            drawBlockLines(
                [pdfText(`${formatDateRange(stage.start_date, stage.end_date)} - ${formatWorkingDuration(stage.working_days)}`)],
                PAGE.right, top + 0.6, STYLES.small, "right",
            );
            const bar = stageBar(plan, stage);
            pdf.setFillColor(231, 229, 228);
            pdf.roundedRect(PAGE.left, top + 6.5, PAGE.contentWidth, 2.6, 1.3, 1.3, "F");
            pdf.setFillColor(...ACCENT);
            pdf.roundedRect(
                PAGE.left + (PAGE.contentWidth * bar.leftPct) / 100,
                top + 6.5,
                Math.max(1.5, (PAGE.contentWidth * bar.widthPct) / 100),
                2.6, 1.3, 1.3, "F",
            );
            y += STAGE_ROW;
            log("row", top, y);
        });

        const top = y;
        drawBlockLines([formatPlanDate(plan.start_date, "short")], PAGE.left, y, STYLES.small);
        drawBlockLines([formatPlanDate(plan.end_date, "short")], PAGE.right, y, STYLES.small, "right");
        y += 6;
        y += drawBlockLines(wrap(PROGRAMME_BASIS_NOTE, PAGE.contentWidth, STYLES.small), PAGE.left, y, STYLES.small);
        log("text", top, y);
    };

    const stageList = (block: Extract<DocBlock, { type: "stageList" }>) => {
        if (block.start) {
            paragraphs([`Start on site: ${block.start}`]);
            y += 3;
        }
        ruleAt(y);
        block.rows.forEach((row) => {
            const nameLines = wrap(row.name, PAGE.contentWidth - 40, STYLES.strong);
            const height = nameLines.length * STYLES.strong.lineHeight + 5;
            if (ensure(height)) ruleAt(y);
            const top = y;
            drawBlockLines(nameLines, PAGE.left, top + 2.5, STYLES.strong);
            drawBlockLines([pdfText(row.duration)], PAGE.right, top + 2.5, STYLES.body, "right");
            y += height;
            ruleAt(y);
            log("row", top, y);
        });
    };

    /**
     * Terms are set in two columns. Each clause is cut into units that are
     * never split: a short clause is one unit; a long one is its title with
     * its first lines, then runs of lines. On every page the units are shared
     * between the columns as evenly as they will go, so the terms end level
     * and what follows carries on beneath them.
     */
    const TERM_GAP = 8;
    const termWidth = (PAGE.contentWidth - TERM_GAP) / 2;
    const TERM_SPACING = 3;
    const TERM_CHUNK = 12;

    interface TermUnit { title: string[]; body: string[]; height: number; endsClause: boolean }

    const termUnits = (block: Extract<DocBlock, { type: "terms" }>): TermUnit[] => {
        const units: TermUnit[] = [];
        block.clauses.forEach((clause) => {
            const title = wrap(`${clause.number}. ${clause.title}`, termWidth, STYLES.termTitle);
            const body = wrap(clause.body, termWidth, STYLES.term);
            for (let start = 0; start === 0 || start < body.length; start += TERM_CHUNK) {
                let end = Math.min(body.length, start + TERM_CHUNK);
                // Never leave a single line of a clause for the next unit.
                if (body.length - end === 1) end = body.length;
                const lines = body.slice(start, end);
                const unitTitle = start === 0 ? title : [];
                const endsClause = end >= body.length;
                units.push({
                    title: unitTitle,
                    body: lines,
                    endsClause,
                    height: unitTitle.length * STYLES.termTitle.lineHeight + lines.length * STYLES.term.lineHeight + (endsClause ? TERM_SPACING : 0),
                });
                if (endsClause) break;
                start = end - TERM_CHUNK;
            }
        });
        return units;
    };

    const terms = (block: Extract<DocBlock, { type: "terms" }>) => {
        const queue = termUnits(block);
        while (queue.length > 0) {
            if (y > PAGE.contentTop && queue[0].height > remaining()) newPage();
            const top = y;
            const available = PAGE.contentBottom - top;
            const total = queue.reduce((sum, unit) => sum + unit.height, 0);
            // Aim for level columns when everything left fits on this page.
            const target = Math.min(available, total / 2);
            const columns: TermUnit[][] = [[], []];
            const heights = [0, 0];
            for (let column = 0; column < 2; column += 1) {
                while (queue.length > 0) {
                    const unit = queue[0];
                    const fits = heights[column] + unit.height <= available + 0.01;
                    const wanted = column === 1 || heights[column] < target - 0.01;
                    if (!fits || !wanted) {
                        // A unit taller than a whole page still has to go somewhere.
                        if (heights[column] === 0 && !fits && top === PAGE.contentTop) columns[column].push(queue.shift()!);
                        break;
                    }
                    heights[column] += unit.height;
                    columns[column].push(queue.shift()!);
                }
            }
            columns.forEach((units, column) => {
                const x = PAGE.left + column * (termWidth + TERM_GAP);
                let cursor = top;
                units.forEach((unit) => {
                    const unitTop = cursor;
                    if (unit.title.length > 0) {
                        cursor += drawBlockLines(unit.title, x, cursor, STYLES.termTitle);
                        log("subheading", unitTop, cursor, `term-${groupCounter + 1}`);
                    }
                    const bodyTop = cursor;
                    cursor += drawBlockLines(unit.body, x, cursor, STYLES.term);
                    log("text", bodyTop, cursor, unit.title.length > 0 ? `term-${++groupCounter}` : undefined);
                    if (unit.endsClause) cursor += TERM_SPACING;
                });
            });
            y = top + Math.max(heights[0], heights[1]);
            if (queue.length > 0) newPage();
        }
    };

    const caseStudy = (block: Extract<DocBlock, { type: "caseStudy" }>) => {
        const titleStyle: TextStyle = { font: "times", style: "normal", size: 16, color: INK, lineHeight: 7 };
        const titleLines = wrap(block.title, PAGE.contentWidth, titleStyle);
        ensure(4 + titleLines.length * titleStyle.lineHeight + firstPartHeight({ type: "facts", items: block.facts.slice(0, 2) }));
        const top = y;
        pdf.setFillColor(...ACCENT);
        pdf.rect(PAGE.left, top, PAGE.contentWidth, 0.6, "F");
        y += 4;
        y += drawBlockLines(titleLines, PAGE.left, y, titleStyle);
        y += 3;
        log("subheading", top, y);
        if (block.facts.length > 0) facts(block.facts);

        const visible = block.photos.filter((url) => {
            if (images.has(url)) return true;
            skippedImages.push(url);
            return false;
        }).slice(0, 3);
        if (visible.length > 0) {
            const gap = 4;
            const cellWidth = (PAGE.contentWidth - gap * 2) / 3;
            const sizes = visible.map((url) => photoCell(url, cellWidth));
            const height = Math.max(...sizes.map((size) => size?.height ?? 0));
            y += 2;
            ensure(height);
            const rowTop = y;
            visible.forEach((url, column) => {
                const size = sizes[column];
                if (!size) return;
                drawImage(url, PAGE.left + column * (cellWidth + gap), rowTop, cellWidth, size);
                log("photo", rowTop, rowTop + size.height, `photo-${++groupCounter}`);
            });
            y += height + 4;
        }
        const narrative: Array<[string, string[]]> = [["What we delivered", block.delivered], ["Value added", block.valueAdded]];
        narrative.forEach(([heading, text]) => {
            if (text.length === 0) return;
            subheading(heading, { type: "paragraphs", paragraphs: text });
            paragraphs(text);
        });
        y += 6;
    };

    const drawBlock = (block: DocBlock, next: DocBlock | undefined) => {
        switch (block.type) {
            case "paragraphs": return paragraphs(block.paragraphs);
            case "subheading": return subheading(block.text, next);
            case "bullets": return bullets(block.items);
            case "facts": return facts(block.items);
            case "quote": return quote(block.paragraphs, block.attribution);
            case "photos": return photos(block.photos);
            case "price": return price(block);
            case "payments": return payments(block);
            case "timeline": return timeline(block);
            case "stageList": return stageList(block);
            case "terms": return terms(block);
            case "caseStudy": return caseStudy(block);
        }
    };

    // ── Cover ────────────────────────────────────────────────────────────────

    const cover = () => {
        const logo = document.company.logoUrl ? images.get(document.company.logoUrl) : undefined;
        if (document.company.logoUrl && !logo) skippedImages.push(document.company.logoUrl);
        if (logo) {
            const height = Math.min(16, 55 * (logo.height / logo.width));
            pdf.addImage(logo.data, logo.format, PAGE.left, 20, height * (logo.width / logo.height), height, undefined, "FAST");
        } else {
            drawBlockLines([pdfText(document.company.name)], PAGE.left, 24, { font: "helvetica", style: "bold", size: 14, color: INK, lineHeight: 6 });
        }
        apply({ ...STYLES.label, size: 8.5, color: HIGHLIGHT });
        pdf.text("PROPOSAL", PAGE.right, 30, { align: "right", charSpace: 1.2 });
        ruleAt(40);
        log("row", 20, 40);

        y = 62;
        let titleSize = 32;
        let titleLines: string[] = [];
        for (; titleSize >= 20; titleSize -= 2) {
            titleLines = wrap(document.title, PAGE.contentWidth, { font: "times", style: "normal", size: titleSize, color: INK, lineHeight: 0 });
            if (titleLines.length <= 3) break;
        }
        const titleStyle: TextStyle = { font: "times", style: "normal", size: titleSize, color: INK, lineHeight: titleSize * PT_TO_MM * 1.15 };
        const titleTop = y;
        y += drawBlockLines(titleLines, PAGE.left, y, titleStyle) + 5;
        log("section-heading", titleTop, y);

        if (document.clientName) {
            const top = y;
            y += drawBlockLines(wrap(`Prepared for ${document.clientName}`, PAGE.contentWidth, STYLES.lead), PAGE.left, y, { ...STYLES.lead, color: INK });
            log("text", top, y);
        }
        if (document.siteAddress) {
            const top = y;
            y += drawBlockLines(wrap(document.siteAddress.replace(/\s*\n\s*/g, ", "), PAGE.contentWidth, STYLES.body), PAGE.left, y + 1, STYLES.body) + 1;
            log("text", top, y);
        }

        y += 6;
        // Each fact stays whole: one that does not fit on the line starts the next.
        const meta = [
            document.projectType ? `Type of work: ${document.projectType}` : "",
            `${document.isDraft ? "Previewed" : "Issued"}: ${document.issued}`,
            `Valid until: ${document.validUntil}`,
            `Reference: ${document.reference}`,
        ].filter(Boolean).map(pdfText);
        const metaTop = y;
        apply(STYLES.small);
        let metaX: number = PAGE.left;
        meta.forEach((item) => {
            const width = pdf.getTextWidth(item);
            if (metaX > PAGE.left && metaX + width > PAGE.right) {
                metaX = PAGE.left;
                y += STYLES.small.lineHeight + 1;
            }
            pdf.text(pdf.splitTextToSize(item, PAGE.contentWidth)[0], metaX, y + ascent(STYLES.small));
            metaX += width + 8;
        });
        y += STYLES.small.lineHeight;
        log("text", metaTop, y);

        if (document.keyFacts.length > 0) {
            y += 8;
            const columns = document.keyFacts.length;
            const columnWidth = PAGE.contentWidth / columns;
            const valueStyle: TextStyle = { font: "helvetica", style: "bold", size: columns > 3 ? 12 : 14, color: INK, lineHeight: 6 };
            const valueLines = document.keyFacts.map((fact) => wrap(fact.value, columnWidth - 8, valueStyle));
            const height = 16 + Math.max(...valueLines.map((linesOfValue) => linesOfValue.length)) * valueStyle.lineHeight;
            const top = y;
            pdf.setFillColor(...SOFT);
            pdf.rect(PAGE.left, top, PAGE.contentWidth, height, "F");
            document.keyFacts.forEach((fact, column) => {
                const x = PAGE.left + column * columnWidth + 4;
                pdf.setFillColor(...ACCENT);
                pdf.rect(x, top + 4, columnWidth - 8, 0.6, "F");
                apply(STYLES.label);
                pdf.text(pdfText(fact.label).toUpperCase(), x, top + 9.5, { charSpace: 0.3 });
                drawBlockLines(valueLines[column], x, top + 11.5, valueStyle);
            });
            y += height;
            log("row", top, y);
        }

        if (document.introduction.length > 0) {
            y += 10;
            paragraphs(document.introduction, STYLES.lead);
        }
    };

    // ── Sections ─────────────────────────────────────────────────────────────

    const sectionHeading = (title: string, number: number, first: DocBlock | undefined) => {
        const titleStyle: TextStyle = { font: "times", style: "normal", size: 22, color: INK, lineHeight: 9 };
        const titleLines = wrap(title, PAGE.contentWidth, titleStyle);
        const headingHeight = 7 + titleLines.length * titleStyle.lineHeight + 5;
        const needed = headingHeight + firstPartHeight(first);

        if (remaining() < Math.max(SECTION_MIN_SPACE, needed + 17)) {
            newPage();
        } else {
            y += 9;
            ruleAt(y);
            y += 8;
        }
        const top = y;
        apply({ ...STYLES.label, size: 8.5, color: HIGHLIGHT });
        pdf.text(String(number).padStart(2, "0"), PAGE.left, y + 3, { charSpace: 1 });
        y += 7;
        y += drawBlockLines(titleLines, PAGE.left, y, titleStyle) + 5;
        log("section-heading", top, y);
    };

    const responseBlock = () => {
        section = "response";
        const { response } = document;
        const headingStyle: TextStyle = { font: "times", style: "normal", size: 18, color: INK, lineHeight: 8 };
        const headingLines = wrap(response.heading, PAGE.contentWidth - 16, headingStyle);
        const noticeLines = wrap(response.notice, PAGE.contentWidth - 16, STYLES.body);
        const footnote = wrap(
            `Reference ${document.reference}.${document.snapshotRef ? ` Snapshot ${document.snapshotRef}.` : ""}${document.draftCheckCode ? ` Check code ${document.draftCheckCode}.` : ""}`,
            PAGE.contentWidth - 16, STYLES.small,
        );
        const signatureHeight = 33;
        const height = 7 + headingLines.length * headingStyle.lineHeight + 2 + noticeLines.length * STYLES.body.lineHeight
            + 6 + signatureHeight + footnote.length * STYLES.small.lineHeight + 6;

        // The whole response block stays on one page.
        if (remaining() < height + 10) newPage(); else y += 10;
        const top = y;
        pdf.setFillColor(...SOFT);
        pdf.rect(PAGE.left, top, PAGE.contentWidth, height, "F");
        pdf.setFillColor(...ACCENT);
        pdf.rect(PAGE.left, top, PAGE.contentWidth, 0.8, "F");

        const x = PAGE.left + 8;
        let cursor = top + 7;
        cursor += drawBlockLines(headingLines, x, cursor, headingStyle) + 2;
        cursor += drawBlockLines(noticeLines, x, cursor, STYLES.body) + 6;

        const columnWidth = (PAGE.contentWidth - 16 - 10) / 2;
        const signature = (columnX: number, label: string, name: string | null) => {
            drawBlockLines(wrap(label, columnWidth, STYLES.label), columnX, cursor, STYLES.label);
            if (name) drawBlockLines(wrap(name, columnWidth, STYLES.strong).slice(0, 1), columnX, cursor + 5, STYLES.strong);
            ["Signature", "Name", "Date"].forEach((line, index) => {
                const lineY = cursor + 16 + index * 7;
                pdf.setDrawColor(...MUTED);
                pdf.setLineWidth(0.2);
                pdf.line(columnX + 18, lineY, columnX + columnWidth, lineY);
                drawBlockLines([line], columnX, lineY - 3, STYLES.small);
            });
        };
        signature(x, `For ${document.company.name}`, null);
        signature(x + columnWidth + 10, response.signatureLabel, document.clientName);
        cursor += signatureHeight;
        drawBlockLines(footnote, x, cursor, STYLES.small);

        y = top + height;
        log("response", top, y);
    };

    cover();
    document.sections.forEach((documentSection, index) => {
        section = documentSection.id;
        sectionHeading(documentSection.title, index + 1, documentSection.blocks[0]);
        documentSection.blocks.forEach((block, blockIndex) => {
            drawBlock(block, documentSection.blocks[blockIndex + 1]);
            y += block.type === "subheading" ? 0 : 4;
        });
    });
    responseBlock();

    // ── Page furniture, once the page count is known ─────────────────────────

    /** The text, or as much of it as fits the width followed by "...". Uses the current font. */
    const fitText = (text: string, width: number): string => {
        if (pdf.getTextWidth(text) <= width) return text;
        let cut = text.length;
        while (cut > 1 && pdf.getTextWidth(`${text.slice(0, cut).trimEnd()}...`) > width) cut -= 1;
        return `${text.slice(0, cut).trimEnd()}...`;
    };

    const pages = pdf.getNumberOfPages();
    const contact = [document.company.name, document.company.phone, document.company.website]
        .filter((part): part is string => Boolean(part)).map(pdfText).join("  |  ");
    for (let number = 1; number <= pages; number += 1) {
        pdf.setPage(number);
        if (number > 1) {
            // The running header repeats the names from the cover. A long one
            // is shortened here so the two sides never run into each other.
            apply(STYLES.small);
            const company = fitText(pdfText(document.company.name), PAGE.contentWidth * 0.4);
            const reference = `  |  ${document.reference}`;
            const titleRoom = PAGE.contentWidth - pdf.getTextWidth(company) - pdf.getTextWidth(reference) - 10;
            pdf.text(company, PAGE.left, 11);
            pdf.text(`${fitText(pdfText(document.title), titleRoom)}${reference}`, PAGE.right, 11, { align: "right" });
            ruleAt(PAGE.headerRule);
        }
        ruleAt(PAGE.footerText - 5);
        apply(STYLES.small);
        pdf.text(fitText(contact, PAGE.contentWidth - 30), PAGE.left, PAGE.footerText);
        pdf.text(`Page ${number} of ${pages}`, PAGE.right, PAGE.footerText, { align: "right" });
        if (document.isDraft) {
            apply({ ...STYLES.label, size: 8.5, color: [180, 83, 9] });
            pdf.text("DRAFT PREVIEW - NOT SENT TO THE CLIENT", PAGE.width / 2, number === 1 ? 11 : PAGE.footerText, { align: "center" });
        }
    }

    return { doc: pdf, pages, layout, skippedImages: Array.from(new Set(skippedImages)) };
}

function round(value: number): number {
    return Math.round(value * 100) / 100;
}

export function brochureFilename(document: ProposalDocument): string {
    const name = document.title.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "Proposal";
    return `${name}_Proposal_${document.reference}.pdf`;
}

/**
 * Makes and saves the PDF for a snapshot, in the browser. The document is
 * built from the snapshot alone; no draft or profile data is read.
 *
 * With `draft`, the snapshot is the one the review screen previews: the PDF
 * is marked as a draft on every page and carries the draft's check code.
 * It is drawn by the same code from the same kind of snapshot as the PDF of
 * a sent version, so the two differ only in that marking, the reference and
 * the dates of issue.
 */
export async function downloadProposalPdf(
    snapshot: ProposalPublicationSnapshot,
    snapshotHash?: string | null,
    draft?: { checkCode: string | null },
): Promise<{ pages: number; skippedImages: number }> {
    const document = buildProposalDocument(snapshot, draft ? { isDraft: true, draftCheckCode: draft.checkCode } : { snapshotHash });
    const images = await loadDocumentImages(document);
    const result = renderProposalBrochure(document, images);
    result.doc.save(brochureFilename(document));
    return { pages: result.pages, skippedImages: result.skippedImages.length };
}
