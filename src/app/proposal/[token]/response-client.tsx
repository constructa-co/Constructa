"use client";

import { useState } from "react";
import type { RecordedResponseKind } from "@/lib/proposal-response";
import { respondToProposalAction } from "./actions";

interface Props {
    token: string;
    kind: RecordedResponseKind;
    heading: string;
    /** What responding does and does not mean, as frozen in the publication. */
    notice: string;
    actionLabel: string;
    recordedHeading: string;
    recordedNoun: string;
    companyName: string;
    reference: string;
    defaultName: string;
    status: string;
    respondedAt: string | null;
    respondedBy: string | null;
    isExpired: boolean;
    isRevoked: boolean;
    /** Defaults to the real server action; replaced only by tests and evidence capture. */
    respond?: typeof respondToProposalAction;
}

function formatDate(value: string): string {
    return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
}

/**
 * The client's response to a published proposal: one non-binding action,
 * worded by the publication. Acceptance is never offered here. A proposal
 * that was accepted or declined before this change shows that record as it
 * was made.
 */
export default function ResponseClient({
    token, kind, heading, notice, actionLabel, recordedHeading, recordedNoun, companyName, reference,
    defaultName, status, respondedAt, respondedBy, isExpired, isRevoked, respond = respondToProposalAction,
}: Props) {
    const [name, setName] = useState(defaultName);
    const [email, setEmail] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [recorded, setRecorded] = useState<{ status: string; at: string | null; by: string | null }>(
        { status, at: respondedAt, by: respondedBy },
    );

    const hasResponded = ["acknowledged", "accepted", "declined"].includes(recorded.status);
    const canRespondOnline = kind !== "binding_acceptance";

    const submit = async () => {
        if (busy) return;
        if (name.trim().length < 2) {
            setError("Enter your full name.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            const result = await respond(token, name, email);
            if (result?.success) {
                setRecorded({ status: result.status || "acknowledged", at: result.respondedAt || new Date().toISOString(), by: name.trim() });
            } else {
                setError(result?.error || "Your response could not be recorded. Please try again.");
            }
        } catch {
            setError("Your response could not be recorded. Nothing was sent. Please try again, or contact the contractor.");
        } finally {
            setBusy(false);
        }
    };

    const title = (text: string) => (
        <h2 id="doc-response" className="font-serif text-3xl leading-tight text-stone-900">{text}</h2>
    );

    if (hasResponded) {
        const recordedTitle = recorded.status === "accepted"
            ? "Proposal accepted"
            : recorded.status === "declined" ? "Proposal declined" : recordedHeading;
        const noun = recorded.status === "accepted" ? "acceptance" : recorded.status === "declined" ? "decision to decline" : recordedNoun;
        return (
            <div data-response-state="recorded">
                {title(recordedTitle)}
                <p role="status" className="mt-4 text-base leading-relaxed text-stone-700">
                    Thank you{recorded.by ? `, ${recorded.by}` : ""}. Your {noun} was recorded
                    {recorded.at ? ` on ${formatDate(recorded.at)}` : ""}. Reference {reference}.
                </p>
                {recorded.status === "acknowledged" && (
                    <p className="mt-3 border-l-2 border-[var(--doc-accent)] bg-[var(--doc-accent-soft)] px-4 py-3 text-base leading-relaxed text-stone-800">{notice}</p>
                )}
            </div>
        );
    }

    if (isExpired || isRevoked) {
        return (
            <div data-response-state="closed">
                {title(isRevoked ? "This proposal has been replaced" : "This proposal has expired")}
                <p className="mt-4 text-base leading-relaxed text-stone-700">
                    It is no longer open for a response. Please contact {companyName} for the current version.
                </p>
            </div>
        );
    }

    if (!canRespondOnline) {
        return (
            <div data-response-state="offline">
                {title(heading)}
                <p className="mt-4 text-base leading-relaxed text-stone-700">{notice}</p>
                <p className="mt-3 text-base leading-relaxed text-stone-700">
                    This proposal cannot be responded to online. Please contact {companyName} to discuss it.
                </p>
            </div>
        );
    }

    return (
        <form
            noValidate
            data-response-state="open"
            onSubmit={(event) => { event.preventDefault(); void submit(); }}
            className="space-y-5"
        >
            {title(heading)}
            <p className="border-l-2 border-[var(--doc-accent)] bg-[var(--doc-accent-soft)] px-4 py-3 text-base leading-relaxed text-stone-800" data-response-notice>
                {notice}
            </p>

            <div>
                <label htmlFor="response-name" className="block text-sm font-semibold text-stone-900">Your full name</label>
                <input
                    id="response-name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    disabled={busy}
                    onChange={(event) => setName(event.target.value)}
                    aria-invalid={error && name.trim().length < 2 ? true : undefined}
                    className="mt-1.5 h-12 w-full border border-stone-400 bg-white px-3 text-base text-stone-900 focus:outline-none focus:ring-2 focus:ring-[var(--doc-accent)]"
                />
            </div>

            <div>
                <label htmlFor="response-email" className="block text-sm font-semibold text-stone-900">Your email address (optional)</label>
                <input
                    id="response-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    disabled={busy}
                    onChange={(event) => setEmail(event.target.value)}
                    aria-describedby="response-email-help"
                    className="mt-1.5 h-12 w-full border border-stone-400 bg-white px-3 text-base text-stone-900 focus:outline-none focus:ring-2 focus:ring-[var(--doc-accent)]"
                />
                <p id="response-email-help" className="mt-1.5 text-sm text-stone-600">If you add one, a copy of this record is emailed to you.</p>
            </div>

            {error && <p role="alert" className="border border-red-300 bg-red-50 px-4 py-3 text-base text-red-800">{error}</p>}

            <button
                type="submit"
                disabled={busy}
                className="min-h-14 w-full bg-[var(--doc-accent)] px-5 text-base font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
                {busy ? "Recording…" : error ? `Try again: ${actionLabel}` : actionLabel}
            </button>
        </form>
    );
}
