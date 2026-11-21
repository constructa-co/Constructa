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

import { UNSPECIFIED_PROJECT_TYPE } from "@/lib/blank-project";
import { roundMoney } from "@/lib/financial";
import { formatGbp } from "@/lib/pdf/pdf-money";
import { formatPlanDate } from "@/lib/programme-plan";
import { programmeFacts, type DisplayProgrammePlan } from "@/lib/relative-programme";
import type { ProposalCoverPhoto } from "@/lib/proposal-cover-photo";
import { isFaceValueLineType, type FaceValueLineType } from "@/lib/estimate-line-type";
import { safeImageUrl, type ProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { contractValueVatBasis, formatContractValue, typedValueAmount } from "@/lib/case-study-value";
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
    | { type: "timeline"; plan: DisplayProgrammePlan }
    | { type: "stageList"; start: string | null; rows: Array<{ name: string; duration: string }> }
    | { type: "terms"; clauses: Array<{ number: number; title: string; body: string }> }
    | { type: "caseStudy"; title: string; facts: DocFact[]; delivered: string[]; valueAdded: string[]; photos: string[]; challenge?: string[]; solution?: string[]; quote?: { paragraphs: string[]; attribution: string | null } };

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
    /** The layout the snapshot was sent with. An issued proposal is drawn as it was issued. */
    presentationVersion: number;
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
    /** Optional cover image when explicitly chosen. Absent on legacy publications. */
    coverImage: ProposalCoverPhoto | null;
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
    /**
     * On a draft only: the code the contractor compares with the one shown
     * when the proposal is sent, to see that what was sent is what they read.
     */
    draftCheckCode: string | null;
}

// ── Text ─────────────────────────────────────────────────────────────────────

const BULLET = /^\s*[-*•●]\s+/;

function lines(text: string | null | undefined): string[] {
    return (text ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

/** Collapses newlines so site lines can be compared to a single client name string. */
function singleLineAddress(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    return trimmed.replace(/\s*\n\s*/g, ", ");
}

/**
 * The client name shown on the PDF and public proposal.
 * Uses only the saved client name, and drops the site address when it was
 * mistyped into the client field.
 */
export function publicationClientDisplayName(project: {
    name: string;
    client_name: string | null;
    site_address?: string | null;
}): string | null {
    const client = project.client_name?.trim();
    if (!client) return null;
    const site = singleLineAddress(project.site_address);
    if (site && client === site) return null;
    return client;
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
    const amount = typedValueAmount(value);
    return amount !== null
        ? `£${amount.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`
        : value;
}

// ── Sections ─────────────────────────────────────────────────────────────────

function hasSavedCredentialText(value: string | null | undefined): boolean {
    return Boolean(value?.trim());
}

/** The default type stored when the contractor did not choose one — not shown as a job category. */
export function isUnspecifiedProjectType(type: string | null | undefined): boolean {
    const trimmed = type?.trim();
    return !trimmed || trimmed === UNSPECIFIED_PROJECT_TYPE;
}

/**
 * Type of work shown on the cover and in About credentials.
 * Omits the neutral placeholder and misleading "Other work" estimate section label.
 */
export function publicationProjectTypeDisplay(type: string | null | undefined): string | null {
    const trimmed = type?.trim();
    if (!trimmed || isUnspecifiedProjectType(trimmed)) return null;
    if (trimmed.localeCompare("Other work", undefined, { sensitivity: "accent" }) === 0) return null;
    return type!;
}

/** Heading for a price-table group. Hides generic buckets that would mislead the client. */
export function feeSectionTitle(title: string): string | null {
    const trimmed = title.trim();
    if (!trimmed || trimmed === "General") return null;
    if (isUnspecifiedProjectType(trimmed)) return null;
    if (trimmed.localeCompare("Other work", undefined, { sensitivity: "accent" }) === 0) return null;
    return title;
}

/**
 * The first presentation version that leaves out placeholder job types and
 * generic price headings. A snapshot issued before it keeps the type of work
 * and the price heading it was issued with, whatever they say.
 */
export const LABEL_SUPPRESSION_PRESENTATION_VERSION = 3;

function suppressesGenericLabels(snapshot: ProposalPublicationSnapshot): boolean {
    return documentPresentationVersion(snapshot) >= LABEL_SUPPRESSION_PRESENTATION_VERSION;
}

/** Type of work for this snapshot: as saved on anything issued before label suppression. */
function snapshotProjectTypeDisplay(snapshot: ProposalPublicationSnapshot): string | null {
    const type = snapshot.project.project_type;
    if (suppressesGenericLabels(snapshot)) return publicationProjectTypeDisplay(type);
    return type?.trim() ? type : null;
}

/** Heading of a lone price group: before label suppression only the unnamed "General" group had none. */
function snapshotFeeSectionTitle(snapshot: ProposalPublicationSnapshot, title: string): string | null {
    if (suppressesGenericLabels(snapshot)) return feeSectionTitle(title);
    return title === "General" ? null : title;
}

/** Saved contractor profile facts only (not the job work type). Literal strings. */
function contractorProfileCredentialFacts(contractor: ProposalPublicationSnapshot["contractor"]): DocFact[] {
    const items: DocFact[] = [];
    if (contractor.years_trading && contractor.years_trading > 0) {
        items.push({ label: "Years trading", value: String(contractor.years_trading) });
    }
    if (hasSavedCredentialText(contractor.specialisms)) items.push({ label: "Specialisms", value: contractor.specialisms! });
    if (hasSavedCredentialText(contractor.accreditations)) items.push({ label: "Accreditations", value: contractor.accreditations! });
    if (hasSavedCredentialText(contractor.insurance_details)) items.push({ label: "Insurance", value: contractor.insurance_details! });
    return items;
}

const sameWords = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

/**
 * True when the closing wording already carries the director's message, as
 * it does after "Use saved company message". The client then reads it once,
 * as the closing, and not a second time under About. Snapshots issued before
 * presentation 4 showed both and still do.
 */
function messageIsTheClosing(snapshot: ProposalPublicationSnapshot): boolean {
    if (documentPresentationVersion(snapshot) < 4) return false;
    const message = sameWords(snapshot.contractor.md_message);
    return message !== "" && sameWords(snapshot.content.closing_statement).includes(message);
}

function aboutSection(snapshot: ProposalPublicationSnapshot): DocSection | null {
    const c = snapshot.contractor;
    const profileCredentials = contractorProfileCredentialFacts(c);
    const capabilityBlocks = textBlocks(c.capability_statement);
    const message = messageIsTheClosing(snapshot) ? [] : lines(c.md_message);
    if (profileCredentials.length === 0 && capabilityBlocks.length === 0 && message.length === 0) {
        return null;
    }

    const blocks: DocBlock[] = [];
    const credentialFacts: DocFact[] = [];
    const jobType = snapshotProjectTypeDisplay(snapshot);
    if (jobType) credentialFacts.push({ label: "Type of work", value: jobType });
    credentialFacts.push(...profileCredentials);
    if (credentialFacts.length > 0) blocks.push({ type: "facts", items: credentialFacts });
    blocks.push(...capabilityBlocks);
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
                // A numeric value prints like the proposal's other figures only with
                // a known VAT basis; an amount without one (only possible on a
                // snapshot written before the basis was validated) falls back to the
                // free text, else prints the figure alone with no basis claimed.
                // Older free text prints exactly as it did.
                ...(study.contract_value_amount != null && contractValueVatBasis(study.contract_value_vat_basis) !== null
                    ? [{ label: "Value", value: formatContractValue(study.contract_value_amount, study.contract_value_vat_basis) }]
                    : study.contract_value
                        ? [{ label: "Value", value: formatTypedValue(study.contract_value) }]
                        : study.contract_value_amount != null
                            ? [{ label: "Value", value: formatContractValue(study.contract_value_amount, null) }]
                            : []),
                study.duration && { label: "Programme", value: study.duration },
            ].filter((fact): fact is DocFact => Boolean(fact)),
            delivered: lines(study.delivered),
            valueAdded: lines(study.value_added),
            photos: study.photos.map(safeImageUrl).filter((url): url is string => url !== null),
            // Saved as their own fields (CON-063): printed under their own
            // headings. Old combined text stays inside `delivered`, as issued.
            ...(study.challenge ? { challenge: lines(study.challenge) } : {}),
            ...(study.solution ? { solution: lines(study.solution) } : {}),
            // An attributed client pull quote (CON-062). Only a new snapshot
            // can hold one, so issued proposals never gain a quote retroactively.
            ...(study.client_quote
                ? { quote: { paragraphs: lines(study.client_quote), attribution: study.client_quote_attribution?.trim() || null } }
                : {}),
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

/** Units that are words, read with a count from presentation 5: "3 days", never "3 day". Symbols such as m2, nr and kg take no plural. */
const COUNTED_UNITS: Record<string, string> = { item: "items", day: "days", week: "weeks", hour: "hours", tonne: "tonnes" };

function quantityLabel(quantity: number, unit: string, presentation: number): string {
    const single = quantity === 1 && ["item", "sum", ""].includes(unit.trim().toLowerCase());
    if (single || !(quantity > 0)) return "";
    const count = Number(quantity.toFixed(3));
    const plural = presentation >= 5 && count !== 1 ? COUNTED_UNITS[unit.trim().toLowerCase()] : undefined;
    return `${count} ${plural ?? unit}`.trim();
}

/** How VAT is stated. Identical wherever the price appears. */
export function documentPresentationVersion(snapshot: ProposalPublicationSnapshot): number {
    return snapshot.document_presentation_version ?? 1;
}

function coverPriceFact(
    commercial: ProposalPublicationSnapshot["commercial"],
    presentation: number,
): DocFact | null {
    if (!(commercial.contract_sum_ex_vat > 0)) return null;
    if (presentation >= 2) {
        if (commercial.vat_rate > 0) {
            return { label: "Price including VAT", value: formatGbp(commercial.contract_sum_inc_vat) };
        }
        return { label: "Price", value: formatGbp(commercial.contract_sum_ex_vat) };
    }
    if (commercial.vat_rate > 0) {
        return { label: "Price including VAT", value: formatGbp(commercial.contract_sum_inc_vat) };
    }
    return { label: "Price", value: formatGbp(commercial.contract_sum_ex_vat) };
}

function priceBlockTotals(
    commercial: ProposalPublicationSnapshot["commercial"],
    presentation: number,
): Array<DocFact & { strong: boolean }> {
    const totals = vatLines(commercial);
    if (presentation >= 2) {
        if (commercial.vat_rate > 0 && totals.length === 3) return totals.slice(0, 2);
        if (commercial.vat_rate === 0) return [];
    }
    return totals;
}

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

/** The estimate's filing label for a line given no activity. It is not a heading the client needs. */
const GENERAL_SECTION = "General";
const PRELIMINARIES_SECTION = "Preliminaries";

/**
 * The price lines under their headings, each group in the order its first
 * line was priced.
 *
 * Before presentation 5 the grouping is the one the snapshot was issued
 * with: exact title matches and, from 3, a lone generic heading left out.
 * From 5: sections that differ only in capitals are one group; lines filed
 * under "General" lead the list with no heading, whatever else is priced;
 * and preliminaries close it, whether they were priced as lines or as a
 * percentage.
 *
 * From 6: prime-cost and provisional sum lines are lifted out of the section
 * groups into their own blocks, "Prime cost sums" and "Provisional sums",
 * shown between the named work and the preliminaries at the face value the
 * snapshot carries. Snapshots issued at 5 or earlier never carry the type,
 * so they keep rendering exactly as issued.
 */
const FACE_VALUE_GROUP_TITLES: Record<FaceValueLineType, string> = {
    pc_sum: "Prime cost sums",
    provisional_sum: "Provisional sums",
};

function priceGroups(snapshot: ProposalPublicationSnapshot): DocPriceGroup[] {
    const commercial = snapshot.commercial;
    const presentation = documentPresentationVersion(snapshot);
    const regroup = presentation >= 5;
    const separateAllowances = presentation >= 6;
    const sameSection = (title: string | null, section: string) =>
        regroup ? title?.trim().toLowerCase() === section.trim().toLowerCase() : title === section;

    const groups: DocPriceGroup[] = [];
    const allowanceGroups: DocPriceGroup[] = [];
    for (const item of commercial.fee_items) {
        if (separateAllowances && isFaceValueLineType(item.line_type)) {
            const title = FACE_VALUE_GROUP_TITLES[item.line_type];
            let group = allowanceGroups.find((candidate) => candidate.title === title);
            if (!group) {
                group = { title, items: [] };
                allowanceGroups.push(group);
            }
            group.items.push({
                description: item.description,
                quantity: quantityLabel(item.quantity, item.unit, presentation),
                amount: formatGbp(item.amount_ex_vat),
            });
            continue;
        }
        let group = groups.find((candidate) => sameSection(candidate.title, item.trade_section));
        if (!group) {
            group = { title: item.trade_section, items: [] };
            groups.push(group);
        }
        group.items.push({
            description: item.description,
            quantity: quantityLabel(item.quantity, item.unit, presentation),
            amount: formatGbp(item.amount_ex_vat),
        });
    }
    // The lone named group is titled the same whether or not allowances are
    // present; only the early return waits on there being no allowance blocks.
    if (groups.length === 1 && groups[0].title) {
        groups[0].title = snapshotFeeSectionTitle(snapshot, groups[0].title);
    }
    if (allowanceGroups.length === 0 && groups.length === 1) {
        return groups;
    }
    if (!regroup) return groups;

    const general = groups.filter((group) => sameSection(group.title, GENERAL_SECTION));
    const preliminaries = groups.filter((group) => sameSection(group.title, PRELIMINARIES_SECTION));
    const named = groups.filter((group) => !general.includes(group) && !preliminaries.includes(group));
    general.forEach((group) => { group.title = null; });
    return [...general, ...named, ...allowanceGroups, ...preliminaries];
}

function priceSection(snapshot: ProposalPublicationSnapshot): DocSection | null {
    const commercial = snapshot.commercial;
    if (!(commercial.contract_sum_ex_vat > 0)) return null;

    const presentation = documentPresentationVersion(snapshot);
    const groups = priceGroups(snapshot);
    const blocks: DocBlock[] = [{
        type: "price",
        groups,
        totals: priceBlockTotals(commercial, presentation),
        note: [vatNote(commercial), commercial.calculation_note].filter(Boolean).join(" ") || null,
    }];

    // From presentation 6, typed prime-cost / provisional sums are drawn in
    // their own blocks; the statement tells the client they are allowances
    // carried at face value, not marked-up prices.
    if (presentation >= 6 && commercial.fee_items.some((item) => isFaceValueLineType(item.line_type))) {
        blocks.push({
            type: "paragraphs",
            paragraphs: ["Prime cost and provisional sum allowances are included at face value. No overhead, risk, profit or discount adjustment is applied to them."],
        });
    }

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
    if (snapshot.programme_intent === "omit") return null;
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

/** Matches the id used for on-screen preview snapshots only — never stored as a sent publication. */
export const PREVIEW_PROPOSAL_PUBLICATION_ID = "00000000-0000-4000-8000-000000000000";

/** Reference label on draft previews and draft PDFs; not an issued proposal number. */
export const DRAFT_PROPOSAL_REFERENCE = "Draft";

export function proposalReference(snapshot: {
    project: Pick<ProposalPublicationSnapshot["project"], "id">;
    publication: Pick<ProposalPublicationSnapshot["publication"], "version_number">;
}): string {
    return `${snapshot.project.id.substring(0, 8).toUpperCase()}-V${snapshot.publication.version_number}`;
}

export interface BuildDocumentOptions {
    /** The contractor's preview of an unsent draft. */
    isDraft?: boolean;
    snapshotHash?: string | null;
    /** The draft's content check code, when it has been worked out. */
    draftCheckCode?: string | null;
}

function isDraftProposalDocument(
    snapshot: ProposalPublicationSnapshot,
    options: BuildDocumentOptions,
): boolean {
    return options.isDraft === true || snapshot.publication.id === PREVIEW_PROPOSAL_PUBLICATION_ID;
}

export function buildProposalDocument(snapshot: ProposalPublicationSnapshot, options: BuildDocumentOptions = {}): ProposalDocument {
    const draftDocument = isDraftProposalDocument(snapshot, options);
    const commercial = snapshot.commercial;
    const plan = snapshot.programme_intent === "omit" ? undefined : snapshot.programme_plan;
    const kind = responseKindOfSnapshot(snapshot);
    const wording = responseWording(kind);

    const presentation = documentPresentationVersion(snapshot);
    const keyFacts: DocFact[] = [];
    const coverPrice = coverPriceFact(commercial, presentation);
    if (coverPrice) keyFacts.push(coverPrice);
    if (plan) {
        keyFacts.push(...programmeFacts(plan, "short"));
    } else if (snapshot.programme_intent !== "omit" && snapshot.project.start_date && formatPlanDate(snapshot.project.start_date, "short")) {
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
        isDraft: draftDocument,
        presentationVersion: presentation,
        theme: documentThemeName(snapshot.contractor.pdf_theme),
        company: {
            name: snapshot.contractor.company_name,
            logoUrl: safeImageUrl(snapshot.contractor.logo_url),
            phone: snapshot.contractor.phone,
            website: snapshot.contractor.website,
        },
        reference: draftDocument ? DRAFT_PROPOSAL_REFERENCE : proposalReference(snapshot),
        title: snapshot.project.name,
        clientName: publicationClientDisplayName(snapshot.project),
        siteAddress: snapshot.project.site_address || null,
        projectType: snapshotProjectTypeDisplay(snapshot),
        issued: formatLongDate(snapshot.publication.sent_at),
        validUntil: formatLongDate(snapshot.publication.expires_at),
        keyFacts,
        coverImage: snapshot.cover_photo ?? null,
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
        draftCheckCode: draftDocument && options.draftCheckCode ? options.draftCheckCode : null,
    };
}

/** Every image the document shows, in order, for loading before a PDF is drawn. */
export function documentImageUrls(doc: ProposalDocument): string[] {
    const urls: string[] = doc.company.logoUrl ? [doc.company.logoUrl] : [];
    if (doc.coverImage?.url) urls.push(doc.coverImage.url);
    for (const section of doc.sections) {
        for (const block of section.blocks) {
            if (block.type === "photos") urls.push(...block.photos.map((photo) => photo.url));
            if (block.type === "caseStudy") urls.push(...block.photos);
        }
    }
    return Array.from(new Set(urls));
}
