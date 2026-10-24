import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { representativeInput } from "@/lib/__fixtures__/proposal";
import { buildProposalDocument, type ProposalDocument } from "@/lib/proposal-document";
import { buildProposalPublicationSnapshot, type ProposalPublicationSnapshot } from "@/lib/proposal-publication";
import ProposalDocumentView from "./proposal-document-view";

const html = (doc: ProposalDocument) => renderToStaticMarkup(createElement(ProposalDocumentView, { doc }));
const unescape = (text: string) => text
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

/** The key-facts list as rendered: its classes and each fact's wrapper, label and value. */
function keyFacts(markup: string) {
    const list = markup.match(/<dl class="([^"]*)" data-key-facts="true">([\s\S]*?)<\/dl>/);
    if (!list) return null;
    const facts = [...list[2].matchAll(/<div class="([^"]*)" data-key-fact="true"><dt class="([^"]*)">([\s\S]*?)<\/dt><dd class="([^"]*)">([\s\S]*?)<\/dd><\/div>/g)]
        .map(([, wrapper, dtClass, label, ddClass, value]) => ({ wrapper: wrapper.split(" "), dtClass, label: unescape(label), ddClass: ddClass.split(" "), value: unescape(value) }));
    // Nothing else sits in the list: every child is one fact holding exactly one dt and one dd.
    expect(list[2].replace(/<div class="[^"]*" data-key-fact="true"><dt class="[^"]*">[\s\S]*?<\/dt><dd class="[^"]*">[\s\S]*?<\/dd><\/div>/g, "")).toBe("");
    return { list: list[1].split(" "), facts };
}

const representative = () => buildProposalPublicationSnapshot(representativeInput());
const ROW_SHARING = ["row-span-2", "grid", "grid-cols-1", "grid-rows-[subgrid]", "content-start", "gap-y-1", "min-w-0", "border-t-2", "border-[var(--doc-accent)]", "pt-2"];
const NO_CLIPPING = /\b(truncate|line-clamp-\d+|whitespace-nowrap|overflow-hidden|text-ellipsis|max-h-\S+|h-\d+)\b/;

describe("web proposal key facts share label and value rows", () => {
    it("renders the builder's facts exactly, in order, as dl > div > dt + dd", () => {
        const doc = buildProposalDocument(representative());
        const rendered = keyFacts(html(doc))!;
        expect(doc.keyFacts.map((fact) => fact.label)).toEqual(["Price including VAT", "Start on site", "Finish", "Duration"]);
        expect(rendered.facts.map(({ label, value }) => ({ label, value }))).toEqual(doc.keyFacts);
    });

    it("keeps the existing two-up / four-up grid and puts each fact on a shared label row and value row", () => {
        const rendered = keyFacts(html(buildProposalDocument(representative())))!;
        expect(rendered.list).toEqual(expect.arrayContaining(["grid", "grid-cols-2", "sm:grid-cols-4", "gap-x-6", "gap-y-5", "mt-8", "px-5", "py-5", "sm:px-6", "bg-[var(--doc-accent-soft)]"]));
        for (const fact of rendered.facts) {
            expect(fact.wrapper).toEqual(expect.arrayContaining(ROW_SHARING));
            expect(fact.dtClass).toBe("text-xs font-semibold uppercase tracking-wide text-stone-600");
            // The label-to-value space now comes from the fact's own row gap, not a margin on the value.
            expect(fact.ddClass).toEqual(["text-lg", "font-semibold", "text-stone-900", "sm:text-xl"]);
        }
    });

    it("never clips, truncates or clamps a label or value", () => {
        const rendered = keyFacts(html(buildProposalDocument(representative())))!;
        for (const fact of rendered.facts) {
            expect(fact.wrapper.join(" ")).not.toMatch(NO_CLIPPING);
            expect(fact.dtClass).not.toMatch(NO_CLIPPING);
            expect(fact.ddClass.join(" ")).not.toMatch(NO_CLIPPING);
        }
    });

    it("keeps long labels and values whole and wrapping, with markup escaped", () => {
        const doc = buildProposalDocument(representative());
        const long = {
            ...doc,
            keyFacts: [
                { label: "Price including VAT and the agreed provisional sums for the garden wall", value: "£1,234,567,890.12" },
                { label: "Start <b>on</b> site & access", value: "Monday 2 November 2026, subject to the scaffold licence" },
                { label: "Finish", value: "20 Nov 2026" },
            ],
        };
        const markup = html(long);
        const rendered = keyFacts(markup)!;
        expect(rendered.facts.map(({ label, value }) => ({ label, value }))).toEqual(long.keyFacts);
        expect(markup).toContain("Start &lt;b&gt;on&lt;/b&gt; site &amp; access");
        expect(markup).not.toContain("<b>on</b>");
        expect(markup).toMatch(/<article[^>]*\[overflow-wrap:anywhere\]/);
    });

    it.each([
        ["no VAT: one Price fact plus the programme", () => buildProposalPublicationSnapshot({ ...representativeInput(), vatRate: 0, vatTreatment: "domestic_reverse_charge" }), ["Price", "Start on site", "Finish", "Duration"]],
        ["a start date with no plan: two facts", (s: ProposalPublicationSnapshot) => ({ ...s, programme_plan: undefined }), ["Price including VAT", "Start on site"]],
        ["programme deliberately omitted: price only", (s: ProposalPublicationSnapshot) => ({ ...s, programme_plan: undefined, programme_intent: "omit" as const }), ["Price including VAT"]],
    ])("%s", (_label, vary, labels) => {
        const doc = buildProposalDocument(vary(representative()));
        const rendered = keyFacts(html(doc))!;
        expect(doc.keyFacts.map((fact) => fact.label)).toEqual(labels);
        expect(rendered.facts.map(({ label, value }) => ({ label, value }))).toEqual(doc.keyFacts);
        for (const fact of rendered.facts) expect(fact.wrapper).toEqual(expect.arrayContaining(ROW_SHARING));
    });

    it("renders no key-facts list when there are none", () => {
        const doc = { ...buildProposalDocument(representative()), keyFacts: [] };
        expect(keyFacts(html(doc))).toBeNull();
        expect(html(doc)).not.toContain("data-key-fact");
    });

    it("shows a custom type of work such as Other exactly as entered, outside the key facts", () => {
        const input = representativeInput();
        input.project.project_type = "Other";
        const doc = buildProposalDocument(buildProposalPublicationSnapshot(input));
        const markup = html(doc);
        expect(doc.projectType).toBe("Other");
        expect(markup).toMatch(/<dt class="inline">Type of work(<!-- -->)?: <\/dt><dd class="inline font-semibold text-stone-900">Other<\/dd>/);
        expect(keyFacts(markup)!.facts.map((fact) => fact.label)).not.toContain("Type of work");
    });

    it("changes only the key-facts markup: terms wording and the cover facts keep their classes", () => {
        const snapshot = representative();
        const markup = html(buildProposalDocument(snapshot));
        expect(markup.match(/whitespace-pre-wrap/g)).toHaveLength(snapshot.terms.clauses.length);
        expect(markup).toContain('<dl class="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-stone-600">');
        const source = readFileSync(path.join(process.cwd(), "src/components/proposal/proposal-document-view.tsx"), "utf8");
        expect(source.match(/grid-rows-\[subgrid\]/g)).toHaveLength(1);
        expect(source).toContain('<p className="mt-0.5 whitespace-pre-wrap">{clause.body}</p>');
    });
});
