import { writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProposalDocumentView from "@/components/proposal/proposal-document-view";
import { minimalInput } from "./__fixtures__/proposal";
import { buildProposalDocument, type ProposalDocument } from "./proposal-document";
import { buildProposalPublicationSnapshot } from "./proposal-publication";
import { describeRecordedResponse, responseWording } from "./proposal-response";
import { renderProposalBrochure } from "./pdf/proposal-brochure";

function snapshot() {
    const input = minimalInput();
    return buildProposalPublicationSnapshot({ ...input, project: { ...input.project, name: "TEST DATA - Draft receipt review" }, responseKind: "acknowledgement" });
}
function pdfStrings(document: ProposalDocument) {
    const result = renderProposalBrochure(document, new Map());
    const pages = (result.doc.internal as unknown as { pages: Array<string[] | undefined> }).pages;
    const text = pages.flatMap(page => (page ?? []).flatMap(operation => Array.from(String(operation).matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g), match => match[1].replace(/\\([()\\])/g, "$1")))).join("\n");
    return { result, text };
}

describe("draft response wording is not a recorded receipt", () => {
    it("uses a signature prompt, not a claim that an unsent draft was received", () => {
        const source = snapshot(), before = JSON.stringify(source);
        const document = buildProposalDocument(source, { isDraft: true });
        const { result, text } = pdfStrings(document);
        const evidence = process.env.CONSTRUCTA_RECEIPT_PDF_EVIDENCE;
        if (evidence) writeFileSync(evidence, Buffer.from(result.doc.output("arraybuffer")), { flag: "wx" });
        expect(document.response.signatureLabel).toBe("Client: confirm receipt");
        expect(text).toContain("Client: confirm receipt");
        expect(text).not.toContain("Client: receipt confirmed");
        expect(text).toContain("DRAFT PREVIEW - NOT SENT TO THE CLIENT");
        expect(text).toContain("Signature"); expect(text).toContain("Name"); expect(text).toContain("Date");
        expect(JSON.stringify(source)).toBe(before);
        expect(result.layout.filter(entry => entry.kind === "response")).toHaveLength(1);
    });
    it("also does not infer a response from publication alone", () => {
        const document = buildProposalDocument(snapshot());
        expect(document.isDraft).toBe(false);
        expect(document.response.signatureLabel).toBe("Client: confirm receipt");
        expect(pdfStrings(document).text).not.toContain("Client: receipt confirmed");
    });
    it("keeps a real recorded receipt distinct from an empty signature prompt", () => {
        expect(describeRecordedResponse("acknowledged", "acknowledgement").label).toBe("Receipt confirmed");
        expect(responseWording("acknowledgement").recordedHeading).toBe("Receipt confirmed");
        expect(responseWording("acknowledgement").pdfSignatureLabel).not.toContain("confirmed");
    });
    it("retains the notice frozen into a publication, without mutating the snapshot", () => {
        const source = snapshot(); source.response = { kind: "acknowledgement", notice: "The statement frozen when sent." };
        const before = JSON.stringify(source), document = buildProposalDocument(source, { isDraft: true });
        expect(document.response.notice).toBe("The statement frozen when sent.");
        expect(JSON.stringify(source)).toBe(before);
    });
    it("does not change non-binding intent or historical acceptance wording", () => {
        const source = snapshot();
        const intent = { ...source, response: { kind: "non_binding_intent" as const, notice: responseWording("non_binding_intent").notice } };
        expect(buildProposalDocument(intent).response.signatureLabel).toBe("Client: intention to proceed (not binding)");
        const historical = { ...source, response: undefined, publication: { ...source.publication, response_mode: "binding_acceptance" as const } };
        expect(buildProposalDocument(historical).response.signatureLabel).toBe("For and on behalf of the client");
        expect(describeRecordedResponse("accepted", "binding_acceptance").label).toBe("Proposal accepted");
    });
    it("keeps HTML marked as an unsent draft and does not render a confirmed receipt", () => {
        const document = buildProposalDocument(snapshot(), { isDraft: true });
        const html = renderToStaticMarkup(createElement(ProposalDocumentView, { doc: document }));
        expect(html).toContain("Draft preview. This has not been sent to the client.");
        expect(html).not.toContain("receipt confirmed");
    });
});
