"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { workspaceStyles } from "@/lib/workspace-styles";
import { PROFILE_PATH, PROPOSAL_READINESS_PATH } from "@/lib/first-session";
import {
    IMPORT_FIELDS,
    IMPORT_GENERIC_ERROR,
    IMPORT_GROUP_LABELS,
    IMPORT_PERMISSION_ERROR,
    IMPORT_SAVE_ERROR,
    type ApplyOutcome,
    type ImportDraft,
    type ImportGroup,
    type ImportItem,
} from "@/lib/company-import/draft";
import type { ImportField } from "@/lib/company-import/extract";
import type { ApplyResult, PreviewResult } from "@/lib/company-import/service";
import { applyWebsiteImportAction, previewWebsiteImportAction } from "./actions";

interface Props {
    initialDraft: ImportDraft | null;
    savedWebsite: string;
    /** Default to the real server actions; replaced only by tests and evidence capture. */
    preview?: (input: { url: string; permissionConfirmed: boolean }) => Promise<PreviewResult>;
    apply?: (input: { draftId: string; approvals: { field: string; expectedExisting: string | null }[] }) => Promise<ApplyResult>;
}

type Busy = "idle" | "checking" | "saving";

const GROUPS: ImportGroup[] = ["identity", "services", "contact"];
const specOf = (field: ImportField) => IMPORT_FIELDS.find((spec) => spec.field === field)!;

const when = (iso: string) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
        ? iso
        : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(date);
};

/**
 * Website import: the contractor names their own website and confirms they
 * may use it, sees what was found beside what is saved, and ticks the
 * changes they want. Nothing is ticked for them and nothing is saved until
 * they press save. Everything read from the website is shown as plain text.
 */
export default function ImportClient({
    initialDraft,
    savedWebsite,
    preview = previewWebsiteImportAction,
    apply = applyWebsiteImportAction,
}: Props) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const s = workspaceStyles(isDark);

    const [url, setUrl] = useState(initialDraft?.website ?? savedWebsite ?? "");
    const [permission, setPermission] = useState(false);
    const [draft, setDraft] = useState<ImportDraft | null>(initialDraft);
    const [chosen, setChosen] = useState<ImportField[]>([]);
    const [outcomes, setOutcomes] = useState<ApplyOutcome[]>([]);
    const [busy, setBusy] = useState<Busy>("idle");
    const [checkError, setCheckError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const inFlight = useRef(false);

    // An expired draft can be read but nothing in it can be approved; the server refuses it too.
    const expired = draft?.expired ?? false;
    const pending = expired ? [] : draft?.items.filter((item) => item.status === "pending") ?? [];
    const outcomeOf = (field: ImportField) => outcomes.find((entry) => entry.field === field);

    const check = async () => {
        if (inFlight.current) return;
        if (!permission) {
            // The confirmation is asked for every time a website is read, including a recheck.
            document.getElementById("import-permission")?.scrollIntoView({ block: "center" });
            return setCheckError(IMPORT_PERMISSION_ERROR);
        }
        if (!url.trim()) return setCheckError("Enter your website address, for example www.yourbusiness.co.uk.");

        inFlight.current = true;
        setBusy("checking");
        setCheckError(null);
        let result: PreviewResult;
        try {
            result = await preview({ url, permissionConfirmed: true });
        } catch {
            result = { ok: false, error: IMPORT_GENERIC_ERROR };
        }
        inFlight.current = false;
        setBusy("idle");
        if (!result.ok) return setCheckError(result.error);
        setDraft(result.draft);
        setChosen([]);
        setOutcomes([]);
        setSaveError(null);
    };

    const save = async () => {
        if (inFlight.current || !draft) return;
        const approvals = pending
            .filter((item) => chosen.includes(item.field))
            .map((item) => ({ field: item.field, expectedExisting: item.existing }));
        if (approvals.length === 0) return setSaveError("Tick at least one change to save.");

        inFlight.current = true;
        setBusy("saving");
        setSaveError(null);
        let result: ApplyResult;
        try {
            result = await apply({ draftId: draft.id, approvals });
        } catch {
            result = { ok: false, error: IMPORT_SAVE_ERROR };
        }
        inFlight.current = false;
        setBusy("idle");

        if (result.draft) setDraft(result.draft);
        if (result.outcomes) {
            setOutcomes(result.outcomes);
            // Anything saved or changed underneath is no longer ticked; a failed save keeps the ticks.
            const settled = result.outcomes.map((entry) => entry.field);
            setChosen((fields) => fields.filter((field) => !settled.includes(field)));
        }
        if (!result.ok) setSaveError(result.error);
    };

    const toggle = (field: ImportField) => {
        setSaveError(null);
        setChosen((fields) => (fields.includes(field) ? fields.filter((entry) => entry !== field) : [...fields, field]));
    };

    const valueBox = `${s.inset} px-3 py-2 text-base break-words whitespace-pre-wrap`;

    const renderItem = (item: ImportItem) => {
        const spec = specOf(item.field);
        const outcome = outcomeOf(item.field);
        const id = `import-${item.field}`;
        return (
            <li key={item.field} data-import-field={item.field} data-status={item.status} className={`${s.inset} p-4 space-y-3`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className={`text-base font-semibold ${s.heading}`}>{spec.label}</h3>
                    {spec.onProposals && <span className={`text-xs ${s.muted}`}>Shown on your proposals</span>}
                </div>

                <dl className="grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0">
                        <dt className={`text-xs font-semibold ${s.muted}`}>Saved now</dt>
                        <dd className={`mt-1 ${valueBox} ${item.existing ? s.body : s.muted}`}>{item.existing || "Nothing saved"}</dd>
                    </div>
                    <div className="min-w-0">
                        <dt className={`text-xs font-semibold ${s.muted}`}>Found on your website</dt>
                        <dd className={`mt-1 ${valueBox} ${s.body}`}>{item.proposed}</dd>
                    </div>
                </dl>

                <div className={`text-sm ${s.muted}`}>
                    <p className="break-words">Where we found it: “{item.excerpt}”</p>
                    <p className="mt-1 break-all">{item.sourceUrl}</p>
                </div>

                {outcome?.outcome === "conflict" && (
                    <p role="alert" className={`${s.noticeBox} text-sm`}>
                        Your profile changed after this preview was made, so nothing was saved for this one. The saved value above is up to date. Tick it again if you still want the change.
                    </p>
                )}

                {item.status === "applied" && (
                    <p className={`${s.successBox} text-sm flex items-center gap-2`}>
                        <Check className="w-4 h-4 flex-shrink-0" aria-hidden /> Saved to your profile{item.appliedAt ? ` on ${when(item.appliedAt)}` : ""}.
                    </p>
                )}
                {item.status === "same" && (
                    <p className={`text-sm font-semibold ${s.muted}`}>Already matches your profile. Nothing to change.</p>
                )}
                {item.status === "pending" && !expired && (
                    <label htmlFor={id} className={`flex items-center gap-3 min-h-11 text-base font-semibold cursor-pointer ${s.heading}`}>
                        <input
                            id={id}
                            type="checkbox"
                            checked={chosen.includes(item.field)}
                            onChange={() => toggle(item.field)}
                            disabled={busy !== "idle"}
                            className="w-6 h-6 flex-shrink-0 accent-blue-600"
                        />
                        {item.existing ? `Replace my ${spec.label.toLowerCase()} with this` : `Use this as my ${spec.label.toLowerCase()}`}
                    </label>
                )}
            </li>
        );
    };

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">
            <section aria-labelledby="import-heading" className={`${s.card} p-5 sm:p-8`}>
                <h1 id="import-heading" className={`text-2xl sm:text-3xl font-bold ${s.heading}`}>Bring in details from your website</h1>
                <p className={`mt-2 text-base ${s.muted}`}>
                    We read a few pages of your own website and show you what we found. Nothing is saved until you choose it, and you can always type your details in by hand instead.
                </p>

                <form noValidate onSubmit={(event) => { event.preventDefault(); check(); }} className="mt-6 space-y-4">
                    <div>
                        <label htmlFor="import-url" className={s.label}>Your website address</label>
                        <input
                            id="import-url"
                            type="url"
                            inputMode="url"
                            autoComplete="url"
                            autoCapitalize="none"
                            spellCheck={false}
                            value={url}
                            onChange={(event) => { setUrl(event.target.value); setCheckError(null); }}
                            placeholder="www.yourbusiness.co.uk"
                            maxLength={2000}
                            disabled={busy !== "idle"}
                            className={`${s.input} mt-1.5`}
                        />
                    </div>

                    <label htmlFor="import-permission" className={`flex items-start gap-3 min-h-11 text-base cursor-pointer ${s.body}`}>
                        <input
                            id="import-permission"
                            type="checkbox"
                            checked={permission}
                            onChange={(event) => { setPermission(event.target.checked); setCheckError(null); }}
                            disabled={busy !== "idle"}
                            className="mt-0.5 w-6 h-6 flex-shrink-0 accent-blue-600"
                        />
                        <span>This is my own business&apos;s website, and I&apos;m happy for Constructa to read it to suggest details for my profile.</span>
                    </label>

                    {checkError && (
                        <div role="alert" className={`${s.errorBox} flex items-start gap-3`}>
                            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden />
                            <p className="min-w-0 text-sm">{checkError}</p>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button type="submit" disabled={busy !== "idle"} className={`${s.primaryButton} w-full sm:w-auto`}>
                            {busy === "checking" ? (<><Loader2 className="w-5 h-5 animate-spin" aria-hidden /> Reading your website…</>)
                                : checkError ? "Try again"
                                : draft ? "Check my website again"
                                : "Check my website"}
                        </button>
                        <Link href={PROFILE_PATH} className={`${s.secondaryButton} w-full sm:w-auto`}>Enter details by hand</Link>
                    </div>
                </form>
            </section>

            {draft && (
                <section aria-labelledby="import-results-heading" className={`${s.card} p-5 sm:p-8`}>
                    <h2 id="import-results-heading" className={`text-lg font-bold ${s.heading}`}>What we found</h2>
                    <p className={`mt-1 text-sm break-words ${s.muted}`}>
                        Read from {draft.website} on {when(draft.fetchedAt)}. {draft.pages.length} {draft.pages.length === 1 ? "page" : "pages"} read.
                    </p>

                    {expired && (
                        <div role="status" className={`mt-4 ${s.noticeBox} text-sm space-y-3`}>
                            <p>
                                This preview is more than a day old, so nothing can be saved from it. Your website may have changed since. Check it again to see what it says now.
                            </p>
                            <button type="button" onClick={check} disabled={busy !== "idle"} className={`${s.secondaryButton} min-h-11 text-sm`}>
                                {busy === "checking" ? "Reading your website…" : "Check my website again"}
                            </button>
                        </div>
                    )}

                    {draft.items.length === 0 ? (
                        <p className={`mt-4 ${s.noticeBox} text-sm`}>
                            We couldn&apos;t find any details we were sure enough about to suggest. You can enter your details by hand instead.
                        </p>
                    ) : (
                        <>
                            {!expired && (
                                <p className={`mt-3 text-sm ${s.muted}`}>
                                    Check each one against what you know to be true. Tick only the changes you want. This preview can be used until {when(draft.expiresAt)}.
                                </p>
                            )}
                            {GROUPS.map((group) => {
                                const items = draft.items.filter((item) => specOf(item.field).group === group);
                                if (items.length === 0) return null;
                                return (
                                    <div key={group} className="mt-6">
                                        <h3 className={`text-sm font-semibold ${s.muted}`}>{IMPORT_GROUP_LABELS[group]}</h3>
                                        <ul className="mt-2 space-y-3">{items.map(renderItem)}</ul>
                                    </div>
                                );
                            })}

                            {saveError && (
                                <div role="alert" className={`mt-5 ${s.errorBox} flex items-start gap-3`}>
                                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden />
                                    <p className="min-w-0 text-sm">{saveError}</p>
                                </div>
                            )}

                            <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
                                {pending.length > 0 && (
                                    <button type="button" onClick={save} disabled={busy !== "idle"} className={`${s.primaryButton} w-full sm:w-auto`}>
                                        {busy === "saving" ? (<><Loader2 className="w-5 h-5 animate-spin" aria-hidden /> Saving…</>)
                                            : saveError && chosen.length > 0 ? "Try again"
                                            : `Save ${chosen.length} ticked ${chosen.length === 1 ? "change" : "changes"}`}
                                    </button>
                                )}
                                <Link href={PROPOSAL_READINESS_PATH} className={`${s.quietButton}`}>See what your proposals can use so far</Link>
                            </div>
                            <p aria-live="polite" className={`mt-2 text-sm ${s.muted}`}>
                                {expired ? "Nothing can be saved from this preview."
                                    : pending.length === 0 ? "Nothing left to decide."
                                    : `${pending.length} left to decide. Anything you leave unticked stays as it is.`}
                            </p>
                        </>
                    )}
                </section>
            )}
        </div>
    );
}
