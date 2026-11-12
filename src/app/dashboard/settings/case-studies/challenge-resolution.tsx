"use client";

import { useState } from "react";
import { DEPTH_MESSAGES, NOTE_MAX, add, canAdd, chars, depthOf, noteThere, present, type AddStatus, type DepthKey } from "@/lib/case-library/guided-depth";

/** A challenge and how it was resolved, as typed, before it is added. Never saved or sent on its own. */
export interface StoryNotes {
    challenge: string;
    response: string;
}
export const NO_STORY: StoryNotes = { challenge: "", response: "" };
export const storyTyped = (notes: StoryNotes): boolean => noteThere(notes.challenge) || noteThere(notes.response);

type Added = { ok: true; text: string } | { ok: false; key: DepthKey; status: AddStatus };

/**
 * The "what we delivered" text with the challenge and then how it was
 * resolved on its end, each as one paragraph opening with the fixed words the
 * guided questions use, exactly as typed. What is already there is not
 * touched; a part left empty is not added; nothing is cut. How it was resolved
 * follows a challenge, already there or added in the same press.
 */
export function withChallengeAndResolution(text: string, notes: StoryNotes): Added {
    let next = text;
    for (const key of ["challenge", "response"] as const) {
        if (!noteThere(notes[key])) continue;
        const status = canAdd(next, key, notes[key]);
        if (status !== "ok") return { ok: false, key, status };
        next = add(next, key, notes[key]);
    }
    return next === text ? { ok: false, key: "challenge", status: "nothing" } : { ok: true, text: next };
}

function refusal(key: DepthKey, status: AddStatus, target: string): string {
    if (status === "present") return `Your text already has a paragraph starting “${depthOf(key).said}”. Change it in ‘${target}’. Nothing was added.`;
    if (status === "not-offered") return "Say what the challenge was first, then how you resolved it. Nothing was added.";
    if (status === "no-room") return `That would make ‘${target}’ longer than ${NOTE_MAX.toLocaleString("en-GB")} characters. Nothing was added or cut.`;
    return `Type ${key === "response" ? "how you resolved it" : "the challenge"} first. Nothing was added.`;
}

/**
 * An optional challenge and how it was resolved, captured into the one
 * existing "what we delivered" text. Nothing is written for the contractor and
 * nothing changes until they press Add; then it is ordinary text in that box,
 * saved by the ordinary save.
 */
export default function ChallengeResolution({ text, notes, onNotes, onAdd, idPrefix, target, labelCls, inputCls, hintCls, buttonCls }: {
    /** The "what we delivered" text as it is now. */
    text: string;
    notes: StoryNotes;
    onNotes: (notes: StoryNotes) => void;
    /** Receives the whole new text for that one box. */
    onAdd: (text: string) => void;
    idPrefix: string;
    /** How that box is named on this screen. */
    target: string;
    labelCls: string;
    inputCls: string;
    hintCls: string;
    buttonCls: string;
}) {
    const [notice, setNotice] = useState<string | null>(null);
    const challengeOpen = !present(text, "challenge") || noteThere(notes.challenge);
    const responseOpen = !present(text, "response") || noteThere(notes.response);
    const typed = storyTyped(notes);

    const type = (key: "challenge" | "response", value: string) => {
        if (chars(value) > NOTE_MAX) { setNotice(DEPTH_MESSAGES.noteTooLong); return; }
        setNotice(null);
        onNotes({ ...notes, [key]: value });
    };
    const addNow = () => {
        const result = withChallengeAndResolution(text, notes);
        if (!result.ok) { setNotice(refusal(result.key, result.status, target)); return; }
        onAdd(result.text);
        onNotes(NO_STORY);
        setNotice(`Added to the end of ‘${target}’, in your words. It is kept when you save.`);
    };

    return (
        <fieldset data-challenge-resolution className="space-y-3 rounded-lg border border-slate-600 p-4">
            <legend className={labelCls}>A challenge and how you resolved it <span className="font-normal text-slate-300">(optional)</span></legend>
            <p id={`${idPrefix}-story-help`} className={hintCls}>If something on this job was tricky, say what it was and how you sorted it. Skip this if nothing was. Add puts it on the end of ‘{target}’, as you typed it.</p>
            {!challengeOpen && !responseOpen ? (
                <p className={hintCls} data-challenge-present>Your text already has a challenge and how you resolved it. Change it in ‘{target}’.</p>
            ) : (
                <>
                    {challengeOpen && (
                        <div>
                            <label htmlFor={`${idPrefix}-challenge`} className={labelCls}>What was the challenge or problem?</label>
                            <textarea id={`${idPrefix}-challenge`} className={inputCls} rows={3} aria-label="What was the challenge or problem?" aria-describedby={`${idPrefix}-story-help`} value={notes.challenge} placeholder={depthOf("challenge").help} onChange={(event) => type("challenge", event.target.value)} />
                        </div>
                    )}
                    {responseOpen && (
                        <div>
                            <label htmlFor={`${idPrefix}-resolution`} className={labelCls}>How did you resolve it?</label>
                            <textarea id={`${idPrefix}-resolution`} className={inputCls} rows={3} aria-label="How did you resolve it?" aria-describedby={`${idPrefix}-story-help`} value={notes.response} placeholder={depthOf("response").help} onChange={(event) => type("response", event.target.value)} />
                        </div>
                    )}
                    <button type="button" className={buttonCls} onClick={addNow}>Add to ‘{target}’</button>
                </>
            )}
            {typed && <p className={hintCls} data-challenge-unadded>Not added yet. Saving doesn&apos;t include this until you press Add.</p>}
            <p role="status" aria-live="polite" data-challenge-notice className={notice ? hintCls : "sr-only"}>{notice ?? ""}</p>
        </fieldset>
    );
}
