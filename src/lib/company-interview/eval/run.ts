/**
 * Runs the canned evaluation cases through the real wording flow, the real
 * budget wrapper and the real interview service, over in-memory tables and a
 * canned generator. Pure: no provider, no network, no database, no clock.
 */

import { wordingRig } from "../__fixtures__/wording-rig";
import { rewordDraft } from "../ai-wording";
import { approve } from "../service";
import { EVAL_CASES, type EvalCase } from "./cases";

export interface EvalOutcome {
    id: string;
    category: EvalCase["category"];
    what: string;
    kind: "faithful" | "unfaithful" | "no reply";
    wording: string;
    attempt: string | null;
    charged: number | null;
    providerCalls: number;
    draftGenerator: string | null;
    draftText: string;
    approved: { text: string | null; edited: boolean | null; generator: string | null } | null;
    /** Anything that differs from what the case expects. Empty means it behaved as expected. */
    problems: string[];
    falseRejection: boolean;
    knownMiss: boolean;
}

export async function runCase(testCase: EvalCase): Promise<EvalOutcome> {
    const rig = wordingRig({ companyName: testCase.companyName });
    await rig.answers(testCase.answers);
    for (const key of testCase.skipped ?? []) await rig.answer(key, "", true);
    if (testCase.before) await testCase.before(rig);
    if (testCase.reply) rig.reply(testCase.reply(rig));
    if (testCase.betweenFinishAndSave) rig.db.beforeNext("company_narrative_save_draft", () => testCase.betweenFinishAndSave!(rig));

    const result = await rewordDraft(rig.context);
    const attempt = rig.budget.attempts.at(-1) ?? null;
    const draft = rig.currentDraft();
    const draftText = String(draft?.draft_text ?? "");
    const problems: string[] = [];
    const expect = testCase.expect;

    if (!result.ok) problems.push(`no draft came back: ${result.error}`);
    if (result.wording !== expect.wording) problems.push(`wording was "${result.wording}", expected "${expect.wording}"`);
    if ((attempt?.outcome ?? null) !== expect.attempt) problems.push(`attempt recorded as "${attempt?.outcome ?? null}", expected "${expect.attempt}"`);
    const charged = attempt ? rig.budget.charged().at(-1)! : null;
    if (charged !== expect.charged) problems.push(`charged ${charged}, expected ${expect.charged}`);
    if (rig.providerCalls.length !== expect.providerCalls) problems.push(`${rig.providerCalls.length} provider calls, expected ${expect.providerCalls}`);
    if (rig.budget.attempts.length > 1) problems.push("more than one attempt was reserved");
    if (rig.budget.finishCount() > 1) problems.push("an attempt was finished more than once");

    // Whatever happened, the contractor is left with exactly one current draft, and it matches the wording reported.
    const expectedGenerator = expect.wording === "ai" ? "ai" : "template";
    if (draft?.generator !== expectedGenerator) problems.push(`current draft is "${draft?.generator ?? "none"}", expected "${expectedGenerator}"`);
    if (expectedGenerator === "ai" && draft?.ai_attempt_id !== attempt?.id) problems.push("the AI draft is not tied to its attempt");
    if (expectedGenerator === "template" && draft?.ai_attempt_id != null) problems.push("a plain draft carries an attempt");
    if (rig.drafts().some((row) => row.generator === "ai" && row.id !== draft?.id)) problems.push("a rejected reply was stored as a draft");
    for (const piece of expect.draftContains ?? []) if (!draftText.includes(piece)) problems.push(`draft lacks "${piece}"`);
    for (const piece of expect.draftOmits ?? []) if (draftText.includes(piece)) problems.push(`draft contains "${piece}"`);
    // Memberships, insurance and unapproved website suggestions are never sent to be narrated.
    for (const call of rig.providerCalls) {
        if (/Gas Safe|liability|Evil Website|NICEIC approved,/.test(call.user) && !/Gas Safe/.test(testCase.answers.work ?? "")) problems.push("a separate fact or website suggestion was sent to be narrated");
        for (const key of testCase.skipped ?? []) if (call.user.includes(`"${key.replace(/_(\w)/g, (_, c: string) => c.toUpperCase())}"`)) problems.push(`skipped answer "${key}" was sent`);
        if (call.maxOutputTokens !== 500) problems.push("the call was not capped at the reserved output");
    }
    if (rig.db.profileWrites.length > 0) problems.push("the profile was written before any approval");
    if (rig.db.reads.includes("company_import_drafts")) problems.push("website suggestions were read");

    let approved: EvalOutcome["approved"] = null;
    if (testCase.approve && result.ok && result.state.draft) {
        const shown = result.state.draft;
        const sent = testCase.approve.editedTo ?? shown.text;
        const approval = await approve(rig.context, { draftId: shown.id, target: "introduction", text: sent, expectedExisting: shown.savedIntroduction });
        const record = rig.drafts().find((row) => row.id === shown.id);
        approved = { text: (rig.profile().capability_statement as string | null) ?? null, edited: (record?.approved_edited as boolean | null) ?? null, generator: (record?.generator as string | null) ?? null };
        if (!approval.ok || approval.outcome !== "applied") problems.push("the approval did not go through");
        if (approved.text !== sent) problems.push("the profile does not hold the approved text");
        if (approved.edited !== (testCase.approve.editedTo !== null)) problems.push(`approval recorded edited=${approved.edited}`);
        if (approved.generator !== "ai") problems.push("approving rewrote how the draft was produced");
        if (rig.providerCalls.length !== expect.providerCalls) problems.push("approval called the provider");
    }

    return {
        id: testCase.id,
        category: testCase.category,
        what: testCase.what,
        kind: testCase.reply === null ? "no reply" : testCase.faithful ? "faithful" : "unfaithful",
        wording: result.wording,
        attempt: (attempt?.outcome as string | null) ?? null,
        charged,
        providerCalls: rig.providerCalls.length,
        draftGenerator: (draft?.generator as string | null) ?? null,
        draftText,
        approved,
        problems,
        falseRejection: !!testCase.falseRejection,
        knownMiss: !!testCase.knownMiss,
    };
}

export async function runEvaluation(): Promise<EvalOutcome[]> {
    const outcomes: EvalOutcome[] = [];
    for (const testCase of EVAL_CASES) outcomes.push(await runCase(testCase));
    return outcomes;
}

/** A deterministic report: the same cases always give the same text. */
export function renderReport(outcomes: EvalOutcome[]): string {
    const faithful = outcomes.filter((entry) => entry.kind === "faithful");
    const unfaithful = outcomes.filter((entry) => entry.kind === "unfaithful");
    const falseRejections = outcomes.filter((entry) => entry.falseRejection);
    const knownMisses = outcomes.filter((entry) => entry.knownMiss);
    const unexpected = outcomes.filter((entry) => entry.problems.length > 0);
    const row = (entry: EvalOutcome) =>
        `| \`${entry.id}\` | ${entry.what.replace(/\|/g, "/")} | ${entry.kind} | ${entry.wording === "ai" ? "AI wording" : `plain (${entry.wording})`} | ${entry.attempt ?? "none"} | ${entry.charged ?? "0"} | ${entry.providerCalls} | ${entry.problems.length === 0 ? "as expected" : `**UNEXPECTED:** ${entry.problems.join("; ")}`} |`;

    const lines = [
        "# Interview AI wording: canned evaluation",
        "",
        "Produced by `npm run eval:interview`. Deterministic: the same code gives the same file.",
        "",
        "**What this is.** Replies we wrote, standing in for the model, run through the real wording flow, budget wrapper and interview service over in-memory tables. It shows what the guards and the flow do with these replies.",
        "",
        "**What this is not.** It is not evidence about what a real model writes, how often it is faithful, or what it costs. No provider was called. The tripwires are not a proof of truth: the false rejections and known misses below are listed so that is plain.",
        "",
        "## Summary",
        "",
        `- Cases: ${outcomes.length}. Behaved as expected: ${outcomes.length - unexpected.length}. Unexpected: ${unexpected.length}.`,
        `- Faithful canned replies: ${faithful.length}. Accepted: ${faithful.filter((entry) => entry.wording === "ai").length}. Rejected though faithful (false rejections): ${falseRejections.length}.`,
        `- Unfaithful canned replies: ${unfaithful.length}. Stopped: ${unfaithful.filter((entry) => entry.wording !== "ai").length}. Let through (known misses): ${knownMisses.length}.`,
        `- Provider calls made by a real provider: 0.`,
        "",
        "## False rejections: faithful replies the tripwires reject",
        "",
        ...(falseRejections.length === 0 ? ["None among these cases."] : falseRejections.map((entry) => `- \`${entry.id}\`: ${entry.what}. The contractor gets the plain version.`)),
        "",
        "## Known misses: unfaithful replies the tripwires let through",
        "",
        ...(knownMisses.length === 0 ? ["None among these cases."] : knownMisses.map((entry) => `- \`${entry.id}\`: ${entry.what}. Only the contractor reading the draft before approving it stands between this and their profile.`)),
        "",
    ];
    for (const category of Array.from(new Set(outcomes.map((entry) => entry.category)))) {
        lines.push(`## ${category[0].toUpperCase()}${category.slice(1)}`, "", "| Case | What the canned reply does | Reply | Contractor is shown | Attempt recorded | Output charged | Calls | Result |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
        lines.push(...outcomes.filter((entry) => entry.category === category).map(row), "");
    }
    return `${lines.join("\n")}`;
}
