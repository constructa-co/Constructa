import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("./actions", () => ({
    getProposalPublicationAction: vi.fn(),
    publishProposalAction: vi.fn(),
    retryProposalDeliveryAction: vi.fn(),
    saveProposalDraftAction: vi.fn(),
    suggestProposalWordingAction: vi.fn(),
    uploadPhotoAction: vi.fn(),
}));
vi.mock("../schedule/simple-actions", () => ({ saveSimpleProgrammeAction: vi.fn() }));

import { representativeInput } from "@/lib/__fixtures__/proposal";
import { isDashboardPathAllowed } from "@/lib/launch-profile";
import { responseWording } from "@/lib/proposal-response";
import type { ReviewContext } from "@/lib/proposal-review";
import SimpleProgrammeClient from "../schedule/simple-programme-client";
import PublicationHistoryPanel, {
    publicationResponseKind,
    publicationStatusLabel,
    type ProposalPublicationHistoryRow,
} from "./publication-history-panel";
import ReviewSendClient from "./review-send-client";

const SRC = path.resolve(import.meta.dirname, "../../../..");
const NOW = "2026-10-05T09:00:00.000Z";
const input = representativeInput();

function context(patch: Partial<ReviewContext["project"]> = {}): ReviewContext {
    return {
        project: { ...input.project, validity_days: 30, client_email: "alex@example.test", ...patch },
        profile: input.profile,
        estimate: input.estimate,
        nextVersion: 1,
    };
}

const caseStudies = [
    { id: "cs-1", index: 0, title: "Shower room, 3 Sample Street", projectType: "Bathroom refurbishment" },
    { id: "cs-2", index: 1, title: "Kitchen, 8 Test Lane", projectType: "Kitchen" },
];

function review(props: Partial<Parameters<typeof ReviewSendClient>[0]> = {}) {
    return renderToStaticMarkup(createElement(ReviewSendClient, {
        context: context(),
        caseStudies,
        lockReason: null,
        estimateIssue: null,
        publications: [],
        now: NOW,
        ...props,
    })).replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
}

const history: ProposalPublicationHistoryRow[] = [
    { id: "p3", version_number: 3, status: "viewed", sent_at: "2026-10-05T09:00:00Z", expires_at: "2026-11-04T09:00:00Z", first_viewed_at: "2026-10-05T12:00:00Z", responded_at: null, responded_by: null, superseded_by: null, snapshot_hash: "c".repeat(64), response_kind: "non_binding_intent", response_mode: "acknowledgement" },
    { id: "p2", version_number: 2, status: "acknowledged", sent_at: "2026-09-20T09:00:00Z", expires_at: "2026-10-20T09:00:00Z", first_viewed_at: "2026-09-20T12:00:00Z", responded_at: "2026-09-21T09:00:00Z", responded_by: "Alex Client", superseded_by: null, snapshot_hash: "b".repeat(64), response_kind: null, response_mode: "acknowledgement" },
    { id: "p1", version_number: 1, status: "accepted", sent_at: "2026-09-01T09:00:00Z", expires_at: "2026-10-01T09:00:00Z", first_viewed_at: null, responded_at: "2026-09-02T09:00:00Z", responded_by: "Alex Client", superseded_by: null, snapshot_hash: "a".repeat(64), response_kind: null, response_mode: "binding_acceptance" },
];

describe("Review and Send", () => {
    const html = review();

    it("presents the proposal in the order the client reads it", () => {
        const headings: Array<[string, string]> = [
            ["review-cover-title", "Cover and opening message"],
            ["review-about-title", "About your business"],
            ["review-experience-title", "Relevant experience"],
            ["review-scope-title", "Scope of works"],
            ["review-price-title", "Price"],
            ["review-programme-title", "Programme"],
            ["review-terms-title", "Terms"],
            ["review-closing-title", "Closing message"],
            ["review-preview-title", "What your client will see"],
            ["review-send-title", "Send to your client"],
        ];
        const positions = headings.map(([id, title]) => {
            const match = new RegExp(`id="${id}"[^>]*>${title}<`).exec(html);
            expect(match, title).not.toBeNull();
            return match!.index;
        });
        expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    });

    it("reuses what the app already holds instead of asking for it again", () => {
        expect(html).toContain("We are a family firm fitting bathrooms and kitchens");
        expect(html).toContain("Shower room, 3 Sample Street");
        expect(html).toContain("£9,062.46");
        expect(html).toContain("Monday 2 November 2026");
        expect(html).toContain("12 terms are shown to the client");
    });

    it("offers exactly two responses with acknowledgement chosen, and says neither is acceptance", () => {
        const options = html.match(/data-response-option="[^"]+"/g);
        expect(options).toEqual(['data-response-option="acknowledgement"', 'data-response-option="non_binding_intent"']);
        const radios = html.match(/<input[^>]*type="radio"[^>]*name="response-kind"[^>]*>/g) ?? [];
        expect(radios).toHaveLength(2);
        expect(radios[0]).toContain("checked");
        expect(radios[1]).not.toContain("checked");
        expect(html).toContain(responseWording("acknowledgement").optionHelp);
        expect(html).toContain(responseWording("non_binding_intent").optionHelp);
        expect(html).toContain("Neither option is acceptance.");
    });

    it("has no binding-acceptance option anywhere on the screen", () => {
        expect(html).not.toContain("binding_acceptance");
        expect(html).not.toMatch(/Accept (this |the )?proposal/i);
        expect(html).not.toMatch(/binding agreement/i);
    });

    it("previews the client's document, with the response wording the client will see", () => {
        expect(html).toContain("data-proposal-document");
        expect(html).toContain("Draft preview. This has not been sent to the client.");
        expect(html).toContain(responseWording("acknowledgement").notice);
        expect(html).toContain("Total including VAT");
    });

    it("will not send until the contractor confirms", () => {
        const button = html.match(/<button[^>]*data-send-button[^>]*>/)![0];
        expect(button).toContain("disabled");
        expect(html).toContain('data-send-block="not-confirmed"');
        expect(html).toContain("I have read the preview and it is right. Send version 1 to Alex Client.");
    });

    it("separates what is needed from what would improve it", () => {
        const gaps = review({ context: context({ programme_phases: [], scope_text: "", proposal_introduction: "", closing_statement: "" }) });
        expect(gaps).toContain('data-readiness="not-ready"');
        expect(gaps).toContain("2 things are needed before you can send");
        expect(gaps).toMatch(/data-readiness-item="programme" data-ok="false"/);
        expect(gaps).toContain("Add the start date and how long the job takes in Programme.");
        expect(gaps).toContain("Would improve it. You can send without these.");
        expect(gaps).toContain('data-recommended-item="closingStatement"');
        expect(gaps).toContain('data-send-block="not-ready"');
        // The confirmation cannot be ticked while a required item is missing.
        expect(gaps.match(/<input[^>]*data-send-confirm[^>]*>/)![0]).toContain("disabled");
    });

    it("says beside the Send controls what is missing and gives the way to fix each thing", () => {
        const gaps = review({ context: context({ programme_phases: [], payment_schedule: [] }) });
        const send = gaps.slice(gaps.indexOf("data-review-send"));
        const blocker = send.slice(send.indexOf('data-send-block="not-ready"'), send.indexOf("data-send-confirm"));

        expect(blocker).toContain("You can't send yet. 2 things are still needed.");
        // Programme: the reason, and a link straight to the programme.
        expect(blocker).toMatch(/data-send-missing="programme"[\s\S]*Add the start date and how long the job takes in Programme\./);
        expect(blocker).toContain('href="/dashboard/projects/schedule?projectId=22222222-2222-4222-8222-222222222222"');
        expect(blocker).toContain(">Open Programme<");
        // Payment: the reason, a link to the choice, and the two presets one press away.
        expect(blocker).toMatch(/data-send-missing="payment"[\s\S]*Choose how you are paid/);
        expect(blocker).toContain('href="#review-payments"');
        expect(blocker).toContain('data-quick-payment="completion"');
        expect(blocker).toContain('data-quick-payment="deposit_balance"');

        // The disabled tick box and the disabled button both point at that explanation.
        const confirm = send.match(/<input[^>]*data-send-confirm[^>]*>/)![0];
        expect(confirm).toContain("disabled");
        expect(confirm).toContain('aria-describedby="send-block-reason"');
        const button = send.match(/<button[^>]*data-send-button[^>]*>/)![0];
        expect(button).toContain("disabled");
        expect(button).toContain('aria-describedby="send-block-reason"');
        expect(send.match(/id="send-block-reason"/g)).toHaveLength(1);
        // Where the links land exists on the page and can take focus.
        expect(gaps).toMatch(/<div id="review-payments" tabindex="-1"/);
    });

    it("explains the tick box once everything needed is there, with nothing left to fix", () => {
        const send = html.slice(html.indexOf("data-review-send"));
        expect(send).not.toContain("data-send-missing");
        expect(send).toContain("Tick the box to confirm this proposal is ready to go to your client.");
        expect(send.match(/<input[^>]*data-send-confirm[^>]*>/)![0]).not.toContain("disabled");
    });

    it("offers payment on completion, a deposit and balance, or custom stages, and opens on what is saved", () => {
        const presets = (markup: string) => (markup.match(/<input[^>]*name="payment-preset"[^>]*>/g) ?? []).map((radio) => radio.includes("checked"));
        expect(html.match(/data-payment-preset="[^"]+"/g)).toEqual([
            'data-payment-preset="completion"', 'data-payment-preset="deposit_balance"', 'data-payment-preset="custom"',
        ]);
        expect(html).toContain("Payment on completion");
        expect(html).toContain("Deposit and balance");
        expect(html).toContain("Custom stages");
        // The fixture has three stages of its own: custom, with its editor open.
        expect(presets(html)).toEqual([false, false, true]);
        expect(html.match(/data-payment-stage/g)).toHaveLength(3);

        const none = review({ context: context({ payment_schedule: [] }) });
        expect(presets(none)).toEqual([false, false, false]);
        expect(none).not.toContain("data-payment-stage");

        const completion = review({ context: context({ payment_schedule: [{ id: "a", stage: "Payment on completion", description: "When the work is finished", percentage: 100 }] }) });
        expect(presets(completion)).toEqual([true, false, false]);
        expect(completion).not.toContain("data-payment-stage");
        expect(completion).toMatch(/data-payment-summary[\s\S]*Payment on completion[\s\S]*100%[\s\S]*£7,552\.05/);

        const deposit = review({ context: context({ payment_schedule: [
            { id: "a", stage: "Deposit", description: "On booking", percentage: 30 },
            { id: "b", stage: "Balance", description: "On completion", percentage: 70 },
        ] }) });
        expect(presets(deposit)).toEqual([false, true, false]);
        expect(deposit).toMatch(/<input[^>]*id="payment-deposit"[^>]*value="30"/);
        expect(deposit).toContain("The balance is 70%, due on completion. It is worked out for you.");
        // The amounts the client will read, adding up to the price.
        expect(deposit).toMatch(/data-payment-summary[\s\S]*Deposit[\s\S]*£2,265\.61[\s\S]*Balance[\s\S]*£5,286\.44/);
    });

    it("offers the draft PDF before anything is sent", () => {
        const pdf = html.slice(html.indexOf("data-presend-pdf"), html.indexOf('id="review-preview"'));
        const button = pdf.match(/<button[^>]*>/)![0];
        expect(button).not.toContain('disabled=""');
        expect(pdf).toContain("Download this draft as a PDF");
        expect(pdf).toContain("The PDF your client will get, marked as a draft. Downloading it sends nothing.");
        // It sits outside the collapsible preview, so it is there when the preview is closed.
        expect(html.indexOf("data-presend-pdf")).toBeLessThan(html.indexOf('id="review-preview"'));
        // With nothing to price there is nothing to draw, and the button says why.
        const empty = review({ context: { ...context(), estimate: null } });
        expect(empty.slice(empty.indexOf("data-presend-pdf")).match(/<button[^>]*>/)![0]).toContain('disabled=""');
        expect(empty).toContain("The PDF is available once the job has a name and an estimate.");
    });

    it("tells the contractor that a sent version is fixed and edits are a new draft", () => {
        const sent = review({ publications: history, context: { ...context(), nextVersion: 4 } });
        expect(sent).toContain("Version 3 has been sent. Your client sees that version exactly as it was sent.");
        expect(sent).toContain("Anything you change here stays in your draft until you send a new version.");
        expect(sent).toContain("Send version 4");
        expect(sent).toContain("It replaces version 3, which stays in your sent versions.");
        expect(sent).toContain("Sent versions (3)");
    });

    it("is read-only once pre-contract information is locked, and still shows the sent versions", () => {
        const locked = review({ lockReason: "This proposal has been accepted. Record later scope or price changes as variations.", publications: history });
        expect(locked).toContain("data-review-locked");
        expect(locked).not.toContain("data-send-button");
        expect(locked).not.toContain("data-save-draft");
        expect(locked).toMatch(/<fieldset disabled=""/);
        expect(locked).toContain("Sent versions (3)");
    });

    it("gives every control a target of at least 44px", () => {
        const controls = [...html.matchAll(/<(button|select|textarea|input)([^>]*)>/g)]
            .filter(([, tag, attrs]) => !(tag === "input" && /type="(radio|checkbox|file)"/.test(attrs)));
        expect(controls.length).toBeGreaterThan(20);
        controls.forEach(([whole, tag]) => {
            if (tag === "textarea") return;
            expect(whole, whole).toMatch(/\b(min-h-11|min-h-12|min-h-14|h-12)\b/);
        });
        // Radios and tick boxes are reached through a label at least 44px tall.
        expect(html.match(/<label[^>]*min-h-11[^>]*>/g)?.length).toBeGreaterThanOrEqual(3);
    });
});

describe("sent versions", () => {
    const s = { card: "", body: "", heading: "", muted: "", divider: "", quietButton: "", errorBox: "", noticeBox: "" } as never;

    it("describes each response by what that version asked for", () => {
        expect(history.map(publicationStatusLabel)).toEqual(["Opened by the client", "Receipt confirmed", "Proposal accepted"]);
        expect(history.map(publicationResponseKind)).toEqual(["non_binding_intent", "acknowledgement", "binding_acceptance"]);
        expect(publicationStatusLabel({ ...history[0], status: "acknowledged" })).toBe("Intention to proceed (not binding)");
        expect(publicationStatusLabel({ ...history[0], status: "revoked" })).toBe("Replaced by a newer version");
    });

    it("keeps an acceptance recorded before this change as an acceptance", () => {
        expect(publicationStatusLabel(history[2])).toBe("Proposal accepted");
        expect(publicationStatusLabel({ ...history[2], status: "declined" })).toBe("Proposal declined");
    });

    it("renders closed, with every version behind one disclosure", () => {
        const html = renderToStaticMarkup(createElement(PublicationHistoryPanel, { publications: history, s, loadPublication: vi.fn() }));
        expect(html).toContain("Sent versions (3)");
        expect(html).toContain('aria-expanded="false"');
    });
});

describe("programme step", () => {
    const project = { id: "p", name: "14 Example Road bathroom refit", client_name: "Alex Client", start_date: null, programme_phases: [] };
    const render = (props: Partial<Parameters<typeof SimpleProgrammeClient>[0]> = {}) =>
        renderToStaticMarkup(createElement(SimpleProgrammeClient, { project, lockReason: null, estimate: null, ...props }));

    it("opens on the simple editor: start date, duration, optional stages", () => {
        const html = render();
        expect(html).toContain("Start on site");
        expect(html).toContain("How long it takes");
        expect(html).toContain("Break the job into stages");
        expect(html).toContain("Next: Proposal");
        expect(html).toContain('data-save-status="empty"');
    });

    it("keeps the detailed planner reachable behind a labelled disclosure, closed by default", () => {
        const html = render();
        expect(html).toContain("Detailed programme planner");
        expect(html).toMatch(/aria-expanded="false"[^>]*aria-controls="detailed-planner"/);
        expect(html).not.toContain("data-wide-workspace");
        expect(readFileSync(path.join(SRC, "app/dashboard/projects/schedule/simple-programme-client.tsx"), "utf8")).toContain('import("./client-page")');
    });

    it("shows a programme built in the detailed planner without offering to overwrite it", () => {
        const html = render({
            project: {
                ...project,
                start_date: "2026-10-12",
                programme_phases: [{ name: "A", calculatedDays: 5, startOffset: 0 }, { name: "B", calculatedDays: 5, startOffset: 2, dependsOn: [0] }],
            } as never,
        });
        expect(html).toContain("data-programme-readonly");
        expect(html).toContain("Open the detailed planner");
        expect(html).not.toContain("Start a simple programme");
        expect(html).not.toContain("Save programme");
        expect(html).toContain("data-programme-timeline");
    });

    it("is read-only once pre-contract information is locked", () => {
        const html = render({ lockReason: "This project is archived. Restore it before editing pre-contract information." });
        expect(html).toContain("This project is archived.");
        expect(html).not.toContain("Save programme");
        expect(html).not.toContain("Detailed programme planner");
    });
});

describe("established routes", () => {
    it("keeps the programme, proposal and public proposal routes where they were", () => {
        for (const route of ["schedule/page.tsx", "schedule/client-page.tsx", "schedule/actions.ts", "programme/page.tsx", "programme/programme-client.tsx", "proposal/page.tsx"]) {
            expect(statSync(path.join(SRC, "app/dashboard/projects", route)).isFile(), route).toBe(true);
        }
        expect(statSync(path.join(SRC, "app/proposal/[token]/page.tsx")).isFile()).toBe(true);
        expect(isDashboardPathAllowed("/dashboard/projects/schedule", "cohort")).toBe(true);
        expect(isDashboardPathAllowed("/dashboard/projects/proposal", "cohort")).toBe(true);
        // The live, as-built programme stays a full-profile surface.
        expect(isDashboardPathAllowed("/dashboard/projects/programme", "cohort")).toBe(false);
        expect(isDashboardPathAllowed("/dashboard/projects/programme", "full")).toBe(true);
    });

    it("leaves the detailed planner's and the live programme's save actions as they were", () => {
        const schedule = readFileSync(path.join(SRC, "app/dashboard/projects/schedule/actions.ts"), "utf8");
        expect(schedule).toContain("export async function updatePhasesAction");
        expect(schedule).toContain("export async function getEstimatePhasesAction");
        const live = readFileSync(path.join(SRC, "app/dashboard/projects/programme/actions.ts"), "utf8");
        expect(live).toContain("export async function saveAsBuiltPhasesAction");
    });
});

describe("binding acceptance is not offered anywhere in the new journey", () => {
    const files: string[] = [];
    const walk = (dir: string) => readdirSync(dir).forEach((name) => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(full);
    });
    walk(path.join(SRC, "app/dashboard/projects/proposal"));
    walk(path.join(SRC, "app/proposal"));
    walk(path.join(SRC, "components/proposal"));

    it("no screen or action in the proposal journey can ask for or record acceptance", () => {
        expect(files.length).toBeGreaterThan(6);
        for (const file of files) {
            const source = readFileSync(file, "utf8");
            const name = path.relative(SRC, file);
            expect(source, name).not.toMatch(/p_response:\s*"accepted"/);
            expect(source, name).not.toMatch(/responseKind:\s*"binding_acceptance"/);
            expect(source, name).not.toMatch(/response_mode:\s*"binding_acceptance"/);
            expect(source, name).not.toMatch(/Accept (This |the )?Proposal/);
        }
    });

    it("the public action records the one response the database allows for a new publication", () => {
        const source = readFileSync(path.join(SRC, "app/proposal/[token]/actions.ts"), "utf8");
        expect(source.match(/p_response:/g)).toHaveLength(1);
        expect(source).toContain('p_response: "acknowledged"');
    });
});
