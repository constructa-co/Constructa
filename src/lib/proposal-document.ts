/**
 * The proposal document.
 *
 * One function turns a publication snapshot into the document the client
 * reads: an ordered list of sections made of plain blocks, with every figure
 * and date already worked out and worded. The public page and the PDF both
 * render this and nothing else, so they cannot disagree on a price, a date,
 * a term or the wording of the response.
 *
 * Nothing here adds a fact. A section with nothing saved behind it is left
 * out; no heading, statistic, caption or claim is supplied to fill a gap.
 */

import { roundMoney } from "@/lib/financial";
import { formatGbp } from "@/lib/pdf/pdf-money";
import { formatPlanDate, type ProgrammePlan } from "@/lib/programme-plan";
import { safeImageUrl, type ProposalPublicationSnapshot } from "@/lib/proposal-publication";
import {
    responseKindOfSnapshot,
    responseNoticeOfSnapshot,
    responseWording,
    type RecordedResponseKind,
} from "@/lib/proposal-response";

// ── Blocks ───────────────────────────────────────────────────────────────────

export interface DocFact {
    label: string;
    value: string;
}

export interface DocPriceGroup {
    /** Null when the price is one unnamed group. */
    title: string | null;
    items: Array<{ description: string; quantity: string; amount: string }>;
}

export type DocBlock =
    | { type: "paragraphs"; paragraphs: string[] }
    | { type: "subheading"; text: string }
    | { type: "bullets"; items: string[] }
    | { type: "facts"; items: DocFact[] }
    | { type: "quote"; paragraphs: string[]; attribution: string | null }
    | { type: "photos"; photos: Array<{ url: string; caption: string | null }> }
    | { type: "price"; groups: DocPriceGroup[]; totals: Array<DocFact & { strong: boolean }>; note: string | null }
    | { type: "payments"; rows: Array<{ stage: string; when: string | null; share: string; amount: string }>; note: string | null }
    | { type: "timeline"; plan: ProgrammePlan }
    | { type: "stageList"; start: string | null; rows: Array<{ name: string; duration: string }> }
    | { type: "terms"; clauses: Array<{ number: number; title: string; body: string }> }
    | { type: "caseStudy"; title: string; facts: DocFact[]; delivered: string[]; valueAdded: string[]; photos: string[] };

export type DocSectionId = "about" | "experience" | "scope" | "price" | "programme" | "terms" | "closing";

export interface DocSection {
    id: DocSectionId;
    title: string;
    blocks: DocBlock[];
}

// ── Theme ────────────────────────────────────────────────────────────────────

export type DocumentThemeName = "slate" | "navy" | "forest";

/**
 * One accent per company theme. The page itself is always light. `highlight`
 * is used for small text on white, so each is dark enough to read there.
 */
export const DOCUMENT_THEMES: Record<DocumentThemeName, { accent: string; accentSoft: string; highlight: string }> = {
    slate: { accent: "#1f2937", accentSoft: "#f3f4f6", highlight: "#1f2937" },
    navy: { accent: "#0a1628", accentSoft: "#f5f1e6", highlight: "#8a6d1f" },
    forest: { accent: "#1a3a2a", accentSoft: "#f1efe7", highlight: "#1a3a2a" },
};

export function documentThemeName(value: string | null | undefined): DocumentThemeName {
    return value === "navy" || value === "forest" ? value : "slate";
}

// ── Document ─────────────────────────────────────────────────────────────────

export interface ProposalDocument {
    /** True for the contractor's preview of an unsent draft. */
    isDraft: boolean;
    theme: DocumentThemeName;
    company: { name: string; logoUrl: string | null; phone: string | null; website: string | null };
    reference: string;
    title: string;
    clientName: string | null;
    siteAddress: string | null;
    projectType: string | null;
    issued: string;
    validUntil: string;
    /** The headline facts: price, start, finish, duration. */
    keyFacts: DocFact[];
    introduction: string[];
    sections: DocSection[];
    response: {
        kind: RecordedResponseKind;
        heading: string;
        notice: string;
        actionLabel: string;
        signatureLabel: string;
    };
    /** Short fingerprint of the published snapshot, when known. */
    snapshotRef: string | null;
}

// ── Text ─────────────────────────────────────────────────────────────────────

const BULLET = /^\s*[-*•●]\s+/;

function lines(text: string | null | undefined): string[] {
    return (text ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

/** A list field: one item per line, with any typed bullet mark removed. */
export function listItems(text: string | null | undefined): string[] {
    return lines(text).map((line) => line.replace(BULLET, "").trim()).filter(Boolean);
}

/**
 * Free text as the contractor laid it out: runs of bulleted lines become a
 * list, every other line is its own paragraph. No words are changed.
 */
export function textBlocks(text: string | null | undefined): DocBlock[] {
    const blocks: DocBlock[] = [];
    for (const line of lines(text)) {
        const last = blocks[blocks.length - 1];
        if (BULLET.test(line)) {
            const item = line.replace(BULLET, "").trim();
            if (!item) continue;
            if (last?.type === "bullets") last.items.push(item);
            else blocks.push({ type: "bullets", items: [item] });
        } else if (last?.type === "paragraphs") {
            last.paragraphs.push(line);
        } else {
            blocks.push({ type: "paragraphs", paragraphs: [line] });
        }
    }
    return blocks;
}

function splitList(text: string | null | undefined): string[] {
    return (text ?? "").split(/[,\n]/).map((item) => item.replace(BULLET, "").trim()).filter(Boolean);
}

/** "4 October 2026" in UK time, written out so every surface prints the same words. */
function formatLongDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const ukDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
    return formatPlanDate(ukDate, "short-month-long");
}

/** A figure the contractor typed for a past job: grouped when it is a number, otherwise as typed. */
function formatTypedValue(value: string): string {
    const cleaned = value.replace(/[£,\s]/g, "");
    return /^\d+(\.\d+)?$/.test(cleaned)
        ? `£${Number(cleaned).toLocaleString("en-GB", { maximumFractionDigits: 2 })}`
        : value;
}

// ── Sections ─────────────────────────────────────────────────────────────────

function aboutSection(snapshot: ProposalPublicationSnapshot): DocSection | null {
    const c = snapshot.contractor;
    const blocks: DocBlock[] = [...textBlocks(c.capability_statement)];

    if (c.years_trading && c.years_trading > 0) {
        blocks.push({ type: "facts", items: [{ label: "Years trading", value: String(c.years_trading) }] });
    }
    const specialisms = splitList(c.specialisms);
    if (specialisms.length > 0) blocks.push({ type: "subheading", text: "Specialisms" }, { type: "bullets", items: specialisms });
    const accreditations = splitList(c.accreditations);
    if (accreditations.length > 0) blocks.push({ type: "subheading", text: "Accreditations" }, { type: "bullets", items: accreditations });
    const insurance = lines(c.insurance_details);
    if (insurance.length > 0) blocks.push({ type: "subheading", text: "Insurance" }, { type: "paragraphs", paragraphs: insurance });
    const message = lines(c.md_message);
    if (message.length > 0) blocks.push({ type: "quote", paragraphs: message, attribution: c.md_name?.trim() || null });

    if (blocks.length === 0) return null;
    return { id: "about", title: `About ${c.company_name}`, blocks };
}

function experienceSection(snapshot: ProposalPublicationSnapshot): DocSection | null {
    const studies = snapshot.case_studies ?? [];
    if (studies.length === 0) return null;
    return {
        id: "experience",
        title: "Relevant experience",
        blocks: studies.map((study) => ({
            type: "caseStudy" as const,
            title: study.title,
            facts: [
                study.project_type && { label: "Type of work", value: study.project_type },
                study.location && { label: "Location", value: study.location },
                study.client && { label: "Client", value: study.client },
                study.contract_value && { label: "Value", value: formatTypedValue(study.contract_value) },
                study.duration && { label: "Programme", value: study.duration },
            ].filter((fact): fact is DocFact => Boolean(fact)),
            delivered: lines(study.delivered),
            valueAdded: lines(study.value_added),
            photos: study.photos.map(safeImageUrl).filter((url): url is string => url !== null),
        })),
    };
}

function scopeSection(snapshot: ProposalPublicationSnapshot): DocSection | null {
    const blocks: DocBlock[] = [...textBlocks(snapshot.content.scope)];

    const photos = (snapshot.photos ?? [])
        .map((photo) => ({ url: safeImageUrl(photo.url), caption: photo.caption?.trim() || null }))
        .filter((photo): photo is { url: string; caption: string | null } => photo.url !== null);
    if (photos.length > 0) blocks.push({ type: "subheading", text: "Site photographs" }, { type: "photos", photos });

    const exclusions = listItems(snapshot.content.exclusions);
    if (exclusions.length > 0) blocks.push({ type: "subheading", text: "Not included" }, { type: "bullets", items: exclusions });
    const clarifications = listItems(snapshot.content.clarifications);
    if (clarifications.length > 0) blocks.push({ type: "subheading", text: "Clarifications" }, { type: "bullets", items: clarifications });

    if (blocks.length === 0) return null;
    return { id: "scope", title: "Scope of works", blocks };
}

function quantityLabel(quantity: number, unit: string): string {
    const single = quantity === 1 && ["item", "sum", ""].includes(unit.trim().toLowerCase());
    return single || !(quantity > 0) ? "" : `${Number(quantity.toFixed(3))} ${unit}`.trim();
}

/** How VAT is stated. Identical wherever the price appears. */
export function vatLines(commercial: ProposalPublicationSnapshot["commercial"]): Array<DocFact & { strong: boolean }> {
    const exVat = { label: "Total before VAT", value: formatGbp(commercial.contract_sum_ex_vat), strong: false };
    if (commercial.vat_rate > 0) {
        return [
            exVat,
            { label: `VAT at ${Number(commercial.vat_rate)}%`, value: formatGbp(commercial.vat_amount), strong: false },
            { label: "Total including VAT", value: formatGbp(commercial.contract_sum_inc_vat), strong: true },
        ];
    }
    return [{ ...exVat, label: "Total", strong: true }];
}

export function vatNote(commercial: ProposalPublicationSnapshot["commercial"]): string | null {
    if (commercial.vat_rate > 0) return null;
    return commercial.vat_treatment === "domestic_reverse_charge"
        ? "The VAT domestic reverse charge applies to these works. The customer accounts for the VAT to HMRC."
        : "No VAT is charged on this proposal.";
}

/**
 * Payment stages with the amount each one comes to. A stage with its own
 * amount shows that amount; a percentage stage is that share of the total
 * before VAT, and when the shares come to 100% the last stage takes the
 * rounding so the stages add up to the price exactly.
 */
export function paymentRows(commercial: ProposalPublicationSnapshot["commercial"]) {
    const rows = commercial.payment_schedule;
    const allPercent = rows.length > 0 && rows.every((row) => row.amount === null);
    const sharesTotal = roundMoney(rows.reduce((sum, row) => sum + row.percentage, 0));
    let running = 0;

    return rows.map((row, index) => {
        let amount = row.amount ?? roundMoney(commercial.contract_sum_ex_vat * row.percentage / 100);
        if (allPercent && sharesTotal === 100 && index === rows.length - 1) {
            amount = roundMoney(commercial.contract_sum_ex_vat - running);
        }
        running = roundMoney(running + amount);
        return {
            stage: row.stage,
            when: row.description?.trim() || null,
            share: row.amount === null && row.percentage > 0 ? `${Number(row.percentage)}%` : "",
            amount: formatGbp(amount),
        };
    });
}

function priceSection(snapshot: ProposalPublicationSnapshot): DocSection | null {
    const commercial = snapshot.commercial;
    if (!(commercial.contract_sum_ex_vat > 0)) return null;

    const groups: DocPriceGroup[] = [];
    for (const item of commercial.fee_items) {
        let group = groups.find((candidate) => candidate.title === item.trade_section);
        if (!group) {
            group = { title: item.trade_section, items: [] };
            groups.push(group);
        }
        group.items.push({
            description: item.description,
            quantity: quantityLabel(item.quantity, item.unit),
            amount: formatGbp(item.amount_ex_vat),
        });
    }
    if (groups.length === 1 && groups[0].title === "General") groups[0].title = null;

    const blocks: DocBlock[] = [{
        type: "price",
        groups,
        totals: vatLines(commercial),
        note: vatNote(commercial),
    }];

    const payments = paymentRows(commercial);
    if (payments.length > 0) {
        blocks.push(
            { type: "subheading", text: "Payment stages" },
            { type: "payments", rows: payments, note: commercial.vat_rate > 0 ? "Stage amounts are before VAT." : null },
        );
    }
    blocks.push({
        type: "paragraphs",
        paragraphs: [`This price is valid until ${formatLongDate(snapshot.publication.expires_at)}.`],
    });
    return { id: "price", title: "Price", blocks };
}

function programmeSection(snapshot: ProposalPublicationSnapshot): DocSection | null {
    if (snapshot.programme_plan) {
        return { id: "programme", title: "Programme", blocks: [{ type: "timeline", plan: snapshot.programme_plan }] };
    }
    // Published before the canonical programme existed: show what was
    // recorded, without working out dates it never stated.
    if (snapshot.programme.length === 0) return null;
    return {
        id: "programme",
        title: "Programme",
        blocks: [{
            type: "stageList",
            start: snapshot.project.start_date ? formatPlanDate(snapshot.project.start_date) || null : null,
            rows: snapshot.programme.map((phase) => ({
                name: phase.name,
                duration: `${Number(phase.duration_days)} ${Number(phase.duration_days) === 1 ? "day" : "days"}`,
            })),
        }],
    };
}

function termsSection(snapshot: ProposalPublicationSnapshot): DocSection | null {
    if (snapshot.terms.clauses.length === 0) return null;
    return {
        id: "terms",
        title: "Terms",
        blocks: [{
            type: "terms",
            clauses: snapshot.terms.clauses.map((clause, index) => ({ number: index + 1, title: clause.title, body: clause.body })),
        }],
    };
}

function closingSection(snapshot: ProposalPublicationSnapshot): DocSection | null {
    const blocks = textBlocks(snapshot.content.closing_statement);
    if (blocks.length === 0) return null;
    const signatory = snapshot.contractor.md_name?.trim();
    if (signatory) blocks.push({ type: "paragraphs", paragraphs: [signatory, snapshot.contractor.company_name] });
    return { id: "closing", title: "In closing", blocks };
}

// ── Build ────────────────────────────────────────────────────────────────────

export function proposalReference(snapshot: Pick<ProposalPublicationSnapshot, "project" | "publication">): string {
    return `${snapshot.project.id.substring(0, 8).toUpperCase()}-V${snapshot.publication.version_number}`;
}

export interface BuildDocumentOptions {
    /** The contractor's preview of an unsent draft. */
    isDraft?: boolean;
    snapshotHash?: string | null;
}

export function buildProposalDocument(snapshot: ProposalPublicationSnapshot, options: BuildDocumentOptions = {}): ProposalDocument {
    const commercial = snapshot.commercial;
    const plan = snapshot.programme_plan;
    const kind = responseKindOfSnapshot(snapshot);
    const wording = responseWording(kind);

    const keyFacts: DocFact[] = [];
    if (commercial.contract_sum_ex_vat > 0) {
        keyFacts.push(commercial.vat_rate > 0
            ? { label: "Price including VAT", value: formatGbp(commercial.contract_sum_inc_vat) }
            : { label: "Price", value: formatGbp(commercial.contract_sum_ex_vat) });
    }
    if (plan) {
        keyFacts.push(
            { label: "Start on site", value: formatPlanDate(plan.start_date, "short") },
            { label: "Finish", value: formatPlanDate(plan.end_date, "short") },
            { label: "Duration", value: plan.duration_label },
        );
    } else if (snapshot.project.start_date && formatPlanDate(snapshot.project.start_date, "short")) {
        keyFacts.push({ label: "Start on site", value: formatPlanDate(snapshot.project.start_date, "short") });
    }

    const sections = [
        aboutSection(snapshot),
        experienceSection(snapshot),
        scopeSection(snapshot),
        priceSection(snapshot),
        programmeSection(snapshot),
        termsSection(snapshot),
        closingSection(snapshot),
    ].filter((section): section is DocSection => section !== null);

    return {
        isDraft: options.isDraft === true,
        theme: documentThemeName(snapshot.contractor.pdf_theme),
        company: {
            name: snapshot.contractor.company_name,
            logoUrl: safeImageUrl(snapshot.contractor.logo_url),
            phone: snapshot.contractor.phone,
            website: snapshot.contractor.website,
        },
        reference: options.isDraft ? "Draft" : proposalReference(snapshot),
        title: snapshot.project.name,
        clientName: snapshot.project.client_name,
        siteAddress: snapshot.project.site_address || snapshot.project.client_address,
        projectType: snapshot.project.project_type,
        issued: formatLongDate(snapshot.publication.sent_at),
        validUntil: formatLongDate(snapshot.publication.expires_at),
        keyFacts,
        introduction: lines(snapshot.content.introduction),
        sections,
        response: {
            kind,
            heading: wording.heading,
            notice: responseNoticeOfSnapshot(snapshot),
            actionLabel: wording.actionLabel,
            signatureLabel: wording.pdfSignatureLabel,
        },
        snapshotRef: options.snapshotHash ? options.snapshotHash.slice(0, 12) : null,
    };
}

/** Every image the document shows, in order, for loading before a PDF is drawn. */
export function documentImageUrls(doc: ProposalDocument): string[] {
    const urls: string[] = doc.company.logoUrl ? [doc.company.logoUrl] : [];
    for (const section of doc.sections) {
        for (const block of section.blocks) {
            if (block.type === "photos") urls.push(...block.photos.map((photo) => photo.url));
            if (block.type === "caseStudy") urls.push(...block.photos);
        }
    }
    return Array.from(new Set(urls));
}
