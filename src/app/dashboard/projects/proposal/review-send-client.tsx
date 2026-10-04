"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronDown, Circle, Loader2, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import ProgrammeTimeline from "@/components/programme-timeline";
import ProposalDocumentView from "@/components/proposal/proposal-document-view";
import SaveStatus from "@/components/save-status";
import { newClientId } from "@/lib/client-id";
import { copyTextWithFallback } from "@/lib/clipboard-copy";
import { programmePlanForProject } from "@/lib/programme-plan";
import { buildProposalDocument, vatLines, vatNote } from "@/lib/proposal-document";
import type { ProposalPublicationSnapshot } from "@/lib/proposal-publication";
import type { ReadinessKey, RecommendedKey } from "@/lib/proposal-readiness";
import { RESPONSE_KINDS, responseWording } from "@/lib/proposal-response";
import {
    MAX_PAYMENT_STAGES,
    MAX_PHOTOS,
    REVIEW_STATUS_LABEL,
    SEND_BLOCK_MESSAGE,
    buildPreviewSnapshot,
    draftFromProject,
    initialReviewState,
    isSuggestionStale,
    paymentShareField,
    paymentStageField,
    requestWording,
    retryDelivery,
    reviewReadiness,
    reviewReducer,
    reviewSaveStatus,
    saveDraft,
    savedDraftFromProject,
    sendBlock,
    sendProposal,
    standardTermDrafts,
    termField,
    type AskWording,
    type ProposalDraft,
    type PublishProposal,
    type RetryDelivery,
    type ReviewContext,
    type SaveProposalDraft,
    type WordingField,
} from "@/lib/proposal-review";
import { useTheme } from "@/lib/theme-context";
import { useReducerStore } from "@/lib/use-reducer-store";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";
import { workspaceStyles, type WorkspaceStyles } from "@/lib/workspace-styles";
import {
    getProposalPublicationAction,
    publishProposalAction,
    retryProposalDeliveryAction,
    saveProposalDraftAction,
    suggestProposalWordingAction,
    uploadPhotoAction,
} from "./actions";
import PublicationHistoryPanel, { type ProposalPublicationHistoryRow } from "./publication-history-panel";

export interface CaseStudyOption {
    /** The case study's own id, or its position when it has none. */
    id: string;
    index: number;
    title: string;
    projectType: string;
}

export interface ReviewServer {
    save: SaveProposalDraft;
    ask: AskWording;
    publish: PublishProposal;
    retry: RetryDelivery;
    upload: (file: File) => Promise<{ url?: string; error?: string }>;
    loadPublication: (publicationId?: string) => Promise<
        { success: true; snapshot: ProposalPublicationSnapshot; snapshotHash: string } | { success: false; error: string }
    >;
}

interface Props {
    context: ReviewContext;
    caseStudies: CaseStudyOption[];
    /** Why pre-contract information can no longer be changed, if it cannot. */
    lockReason: string | null;
    /** Why there is no single estimate to price from, if there is not. */
    estimateIssue: string | null;
    publications: ProposalPublicationHistoryRow[];
    /** Defaults to the real server actions; replaced only by tests and evidence capture. */
    server?: ReviewServer;
    /** The time shown on the preview. Fixed only for evidence capture. */
    now?: string;
}

function realServer(projectId: string): ReviewServer {
    return {
        save: (payload) => saveProposalDraftAction(projectId, payload),
        ask: (field, text) => suggestProposalWordingAction(projectId, field, text),
        publish: (input) => publishProposalAction(projectId, input),
        retry: (input) => retryProposalDeliveryAction(projectId, input),
        upload: (file) => {
            const form = new FormData();
            form.set("file", file);
            form.set("projectId", projectId);
            return uploadPhotoAction(form);
        },
        loadPublication: (publicationId) => getProposalPublicationAction(projectId, publicationId),
    };
}

const FIELD_LABEL: Record<WordingField, string> = {
    introduction: "Opening message",
    scope: "The work included",
    exclusions: "What's not included",
    clarifications: "Clarifications",
    closing: "Closing message",
};

export default function ReviewSendClient({ context, caseStudies, lockReason, estimateIssue, publications, server, now }: Props) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const s = workspaceStyles(isDark);
    const router = useRouter();
    const { project } = context;
    const api = useMemo(() => server ?? realServer(project.id), [server, project.id]);

    const [state, store] = useReducerStore(reviewReducer, () => {
        // Keys for saved rows are positional so the first render matches on
        // the server and in the browser.
        const positional = () => {
            let n = 0;
            return () => `saved-${n++}`;
        };
        return initialReviewState(draftFromProject(project, positional()), savedDraftFromProject(project, positional()));
    });
    const { draft, fieldErrors } = state;
    const status = reviewSaveStatus(state);
    const saving = state.save.status === "saving";
    const locked = lockReason !== null;
    const busy = saving || state.send.status === "publishing" || locked;

    const [previewTime] = useState(() => now ?? new Date().toISOString());
    const [previewOpen, setPreviewOpen] = useState(true);
    const [termsOpen, setTermsOpen] = useState(false);
    const [deliverByEmail, setDeliverByEmail] = useState(Boolean(project.client_email));
    const [upload, setUpload] = useState<{ busy: boolean; error: string }>({ busy: false, error: "" });
    const [copy, setCopy] = useState("");
    const [pdfNote, setPdfNote] = useState<{ busy: boolean; text: string; failed: boolean }>({ busy: false, text: "", failed: false });
    const fileRef = useRef<HTMLInputElement>(null);
    const linkRef = useRef<HTMLInputElement>(null);
    const saveAlertRef = useRef<HTMLDivElement>(null);
    const resultRef = useRef<HTMLDivElement>(null);

    const readiness = useMemo(() => reviewReadiness(context, draft), [context, draft]);
    const plan = useMemo(() => programmePlanForProject(project), [project]);
    const preview = useMemo(
        () => buildPreviewSnapshot(context, draft, state.responseKind, previewTime),
        [context, draft, state.responseKind, previewTime],
    );
    const previewDocument = useMemo(() => (preview ? buildProposalDocument(preview, { isDraft: true }) : null), [preview]);
    const block = sendBlock(state, readiness);
    const current = publications[0] ?? null;

    useUnsavedGuard(
        !locked && (status === "unsaved" || status === "failed" || status === "saving"),
        "Your proposal has changes that are not saved yet.\n\nPress Cancel to stay here and save them, or OK to leave without saving.",
    );

    // A save or a send can be started from the bottom of a long page. Bring
    // the outcome into view. "nearest" moves the page's own scroller only as
    // far as it needs to; centring would drag the whole app shell with it.
    // Each target keeps a margin above it so it clears the phone's top bar.
    const saveFailed = state.save.status === "failed";
    useEffect(() => {
        if (saveFailed) saveAlertRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [saveFailed]);
    const sendStatus = state.send.status;
    useEffect(() => {
        if (sendStatus === "published" || sendStatus === "failed" || sendStatus === "unknown") {
            resultRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
        // A new version, or an outcome we could not confirm: reload the sent versions.
        if (sendStatus === "published" || sendStatus === "unknown") router.refresh();
    }, [sendStatus, router]);

    const edit = (patch: Partial<ProposalDraft>) => store.dispatch({ type: "draft/change", patch });
    const handleSave = () => void saveDraft(store, api.save);
    const handleSend = () => void sendProposal(store, {
        save: api.save,
        publish: api.publish,
        readiness: () => reviewReadiness(context, store.getState().draft),
        deliverByEmail: deliverByEmail && Boolean(project.client_email),
    });

    const href = (path: string) => `/dashboard/projects/${path}?projectId=${encodeURIComponent(project.id)}`;
    const requiredFix: Partial<Record<ReadinessKey, { href: string; label: string }>> = {
        identity: { href: href("settings"), label: "Open project details" },
        scope: { href: "#review-scope", label: "Go to the scope" },
        contractValue: { href: href("costs"), label: "Open Estimating" },
        programme: { href: href("schedule"), label: "Open Programme" },
        payment: { href: "#review-price", label: "Go to payment stages" },
        terms: { href: "#review-terms", label: "Go to the terms" },
    };
    const recommendedFix: Partial<Record<RecommendedKey, { href: string; label: string }>> = {
        introduction: { href: "#review-cover", label: "Go to the opening message" },
        about: { href: "/dashboard/settings/profile", label: "Open company profile" },
        photos: { href: "#review-scope", label: "Go to photos" },
        caseStudies: { href: "#review-experience", label: "Go to past jobs" },
        exclusions: { href: "#review-scope", label: "Go to the scope" },
        clarifications: { href: "#review-scope", label: "Go to the scope" },
        closingStatement: { href: "#review-closing", label: "Go to the closing message" },
        paymentCoverage: { href: "#review-price", label: "Go to payment stages" },
    };

    // ── Wording field with a pending AI suggestion ───────────────────────────

    const wordingField = (field: WordingField, options: { rows: number; help?: string; placeholder?: string }) => {
        const suggestion = state.suggestion?.field === field ? state.suggestion : null;
        const stale = suggestion ? isSuggestionStale(suggestion, draft) : false;
        const asking = state.ai.status === "loading" && state.ai.field === field;
        const aiFailed = state.ai.status === "failed" && state.ai.field === field;
        const id = `wording-${field}`;
        return (
            <div>
                <label htmlFor={id} className={s.label}>{FIELD_LABEL[field]}</label>
                {options.help && <p id={`${id}-help`} className={`mt-0.5 text-sm ${s.muted}`}>{options.help}</p>}
                <textarea
                    id={id}
                    rows={options.rows}
                    value={draft[field]}
                    disabled={busy}
                    placeholder={options.placeholder}
                    aria-describedby={[options.help ? `${id}-help` : "", fieldErrors[field] ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}
                    aria-invalid={fieldErrors[field] ? true : undefined}
                    onChange={(e) => edit({ [field]: e.target.value })}
                    className={`${s.textarea} mt-1.5`}
                />
                {fieldErrors[field] && <p id={`${id}-error`} className={`mt-1.5 text-sm ${s.errorText}`}>{fieldErrors[field]}</p>}

                {!locked && !suggestion && (
                    <button
                        type="button"
                        onClick={() => void requestWording(store, api.ask, field, newClientId())}
                        disabled={busy || !draft[field].trim() || state.ai.status === "loading" || state.suggestion !== null}
                        className={`${s.quietButton} -ml-3 mt-1`}
                    >
                        {asking
                            ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Asking the assistant…</>
                            : <><Sparkles className="w-4 h-4" aria-hidden="true" /> Suggest clearer wording</>}
                    </button>
                )}
                {aiFailed && (
                    <div role="alert" className={`mt-2 ${s.noticeBox} flex flex-wrap items-center gap-3 text-sm`}>
                        <p className="flex-1 min-w-[12rem]">{state.ai.error}</p>
                        <button type="button" onClick={() => store.dispatch({ type: "ai/dismiss" })} className="underline font-semibold min-h-11 min-w-11 px-2">Dismiss</button>
                    </div>
                )}
                {suggestion && (
                    <section className={`mt-3 ${s.suggestionBox} p-4 space-y-3`} aria-label={`Suggested wording for ${FIELD_LABEL[field]}`} data-suggestion="pending">
                        <p className={`text-sm font-bold ${s.heading}`}>Suggested wording. Nothing has changed yet.</p>
                        <p className={`text-base whitespace-pre-wrap break-words ${s.body}`}>{suggestion.text}</p>
                        <p className={`text-sm ${s.muted}`}>
                            {stale
                                ? "You have changed your text since asking, so this suggestion no longer matches it. Discard it and ask again."
                                : "Check it says only what is true. Apply puts it in your draft; you still need to save."}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <button type="button" disabled={stale || busy} onClick={() => store.dispatch({ type: "suggestion/apply" })} className={`${s.primaryButton} min-h-11 text-sm`}>
                                Apply
                            </button>
                            <button type="button" onClick={() => store.dispatch({ type: "suggestion/discard" })} className={`${s.secondaryButton} min-h-11 text-sm`}>
                                Discard
                            </button>
                        </div>
                    </section>
                )}
            </div>
        );
    };

    // ── Photos ───────────────────────────────────────────────────────────────

    const addPhoto = async (file: File | undefined) => {
        if (!file || draft.photos.length >= MAX_PHOTOS) return;
        setUpload({ busy: true, error: "" });
        try {
            const result = await api.upload(file);
            if (result.url) {
                edit({ photos: [...store.getState().draft.photos, { url: result.url, caption: "" }] });
                setUpload({ busy: false, error: "" });
            } else {
                setUpload({ busy: false, error: result.error || "The photo could not be uploaded. Try again." });
            }
        } catch {
            setUpload({ busy: false, error: "The photo could not be uploaded. Check your connection and try again." });
        }
        if (fileRef.current) fileRef.current.value = "";
    };

    // ── After publishing ─────────────────────────────────────────────────────

    const copyLink = async () => {
        if (!state.published) return;
        const outcome = await copyTextWithFallback(state.published.url);
        if (outcome === "copied") {
            setCopy("Link copied.");
        } else {
            linkRef.current?.focus();
            linkRef.current?.select();
            setCopy("Copying isn't available here. The link is selected: copy it by hand.");
        }
    };

    const downloadCurrentPdf = async () => {
        setPdfNote({ busy: true, text: "", failed: false });
        try {
            const publication = await api.loadPublication(state.published?.publicationId);
            if (!publication.success) {
                setPdfNote({ busy: false, text: publication.error, failed: true });
                return;
            }
            const { downloadProposalPdf } = await import("@/lib/pdf/proposal-brochure");
            const result = await downloadProposalPdf(publication.snapshot, publication.snapshotHash);
            setPdfNote({
                busy: false,
                failed: false,
                text: result.skippedImages > 0
                    ? `The PDF was made without ${result.skippedImages} ${result.skippedImages === 1 ? "image" : "images"} that could not be loaded.`
                    : "",
            });
        } catch {
            setPdfNote({ busy: false, text: "The PDF could not be made. Try again.", failed: true });
        }
    };

    const estimateTotals = preview && preview.commercial.contract_sum_ex_vat > 0 ? vatLines(preview.commercial) : null;
    const terms = draft.terms ?? standardTermDrafts();
    const shownTerms = terms.filter((clause) => !clause.hidden);
    const sectionCard = `${s.card} p-4 sm:p-6 space-y-5 scroll-mt-4`;
    const sectionTitle = (id: string, step: number, title: string, note: string) => (
        <div>
            <p className={`text-xs font-bold tracking-widest ${s.muted}`} aria-hidden="true">{String(step).padStart(2, "0")}</p>
            <h2 id={`${id}-title`} className={`text-lg font-bold ${s.heading}`}>{title}</h2>
            <p className={`mt-1 text-sm ${s.muted}`}>{note}</p>
        </div>
    );
    // Links out are full-height targets on their own line, not words inside a sentence.
    const elsewhere = (text: string, to: string, label: string) => (
        <div>
            <p className={`text-sm ${s.muted}`}>{text}</p>
            <Link href={to} className={`${s.quietButton} -ml-3`}>{label}</Link>
        </div>
    );

    return (
        <div className="space-y-5">
            {/* Title and save state */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className={`text-2xl sm:text-3xl font-bold break-words ${s.heading}`}>Review and send</h1>
                    <p className={`mt-1 text-base break-words ${s.muted}`}>
                        {project.name}{project.client_name ? ` for ${project.client_name}` : ""}
                    </p>
                </div>
                {!locked && <SaveStatus status={status} label={REVIEW_STATUS_LABEL[status]} isDark={isDark} />}
            </div>

            {locked && <p role="status" className={`${s.noticeBox} text-sm`} data-review-locked>{lockReason}</p>}

            {current && (
                <p role="status" className={`${s.successBox} text-sm`} data-current-version>
                    Version {current.version_number} has been sent. Your client sees that version exactly as it was sent.
                    {locked ? "" : " Anything you change here stays in your draft until you send a new version."}
                </p>
            )}

            {/* Readiness */}
            {!locked && (
                <section className={`${s.card} p-4 sm:p-6`} aria-labelledby="readiness-title" data-readiness={readiness.ready ? "ready" : "not-ready"}>
                    <h2 id="readiness-title" className={`text-lg font-bold ${s.heading}`}>
                        {readiness.ready ? "Everything needed is in place" : `${readiness.missing.length} ${readiness.missing.length === 1 ? "thing is" : "things are"} needed before you can send`}
                    </h2>
                    {estimateIssue && <p role="alert" className={`mt-3 ${s.errorBox} text-sm`}>{estimateIssue}</p>}

                    <h3 className={`mt-4 text-sm font-semibold ${s.body}`}>Needed</h3>
                    <ul className="mt-2 space-y-2">
                        {readiness.mandatory.map((item) => (
                            <li key={item.key} className="flex items-start gap-2.5 text-sm" data-readiness-item={item.key} data-ok={item.ok}>
                                {item.ok
                                    ? <Check className="w-5 h-5 flex-shrink-0 text-emerald-500" aria-hidden="true" />
                                    : <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${s.errorText}`} aria-hidden="true" />}
                                <span className="min-w-0">
                                    <span className={`font-semibold ${s.body}`}>{item.label}</span>
                                    <span className={s.muted}> {item.ok ? "Done" : "Missing"}</span>
                                    {!item.ok && (
                                        <span className={`block ${s.body}`}>
                                            {item.fix}
                                            {requiredFix[item.key] && (
                                                <span className="block">
                                                    <a href={requiredFix[item.key]!.href} className={`${s.quietButton} -ml-3`}>
                                                        {requiredFix[item.key]!.label}
                                                    </a>
                                                </span>
                                            )}
                                        </span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>

                    {readiness.recommended.some((item) => !item.ok) && (
                        <>
                            <h3 className={`mt-5 text-sm font-semibold ${s.body}`}>Would improve it. You can send without these.</h3>
                            <ul className="mt-2 space-y-2">
                                {readiness.recommended.filter((item) => !item.ok).map((item) => (
                                    <li key={item.key} className="flex items-start gap-2.5 text-sm" data-recommended-item={item.key}>
                                        <Circle className={`w-5 h-5 flex-shrink-0 ${s.muted}`} aria-hidden="true" />
                                        <span className="min-w-0">
                                            <span className={`font-semibold ${s.body}`}>{item.label}</span>
                                            <span className={`block ${s.muted}`}>
                                                {item.fix}
                                                {recommendedFix[item.key] && (
                                                    <span className="block">
                                                        <a href={recommendedFix[item.key]!.href} className={`${s.quietButton} -ml-3`}>
                                                            {recommendedFix[item.key]!.label}
                                                        </a>
                                                    </span>
                                                )}
                                            </span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </section>
            )}

            {saveFailed && (
                <div ref={saveAlertRef} role="alert" className={`${s.errorBox} flex flex-wrap items-center gap-3 text-sm scroll-mt-20`} data-review-save-error>
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                    <p className="flex-1 min-w-[12rem]">{state.save.error}</p>
                    <button type="button" onClick={handleSave} className={`${s.secondaryButton} min-h-11 text-sm`}>Try again</button>
                </div>
            )}

            <form noValidate onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-5">
                <fieldset disabled={locked} className="space-y-5 min-w-0">
                    <legend className="sr-only">The proposal, in the order your client reads it</legend>

                    {/* 1. Cover and opening */}
                    <section id="review-cover" className={sectionCard} aria-labelledby="review-cover-title">
                        {sectionTitle("review-cover", 1, "Cover and opening message", "The first thing your client reads.")}
                        <dl className={`grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm ${s.inset} p-3 sm:p-4`}>
                            {[
                                ["Job", project.name],
                                ["Client", project.client_name || "Not set"],
                                ["Site", project.site_address || project.client_address || "Not set"],
                                ["From", context.profile.company_name || "Not set"],
                            ].map(([label, value]) => (
                                <div key={label} className="min-w-0">
                                    <dt className={`font-semibold ${s.muted}`}>{label}</dt>
                                    <dd className={`break-words ${s.body}`}>{value}</dd>
                                </div>
                            ))}
                        </dl>
                        {elsewhere("These come from the project.", href("settings"), "Change project details")}
                        {wordingField("introduction", {
                            rows: 4,
                            help: "A few lines in your own words: why you want the job and what matters about it.",
                        })}
                    </section>

                    {/* 2. About */}
                    <section id="review-about" className={sectionCard} aria-labelledby="review-about-title">
                        {sectionTitle("review-about", 2, "About your business", "Shown as you wrote it in your company profile. Nothing is added.")}
                        {context.profile.capability_statement?.trim()
                            ? <p className={`text-base whitespace-pre-wrap break-words ${s.body}`}>{context.profile.capability_statement}</p>
                            : <p className={`text-base ${s.muted}`}>You have not described your business yet, so this section is left out.</p>}
                        {elsewhere("Years trading, accreditations, insurance and your logo also come from the profile.", "/dashboard/settings/profile", "Change company profile")}
                    </section>

                    {/* 3. Experience */}
                    <section id="review-experience" className={sectionCard} aria-labelledby="review-experience-title">
                        {sectionTitle("review-experience", 3, "Relevant experience", "Choose the past jobs to show. Only the ones you tick are included.")}
                        {caseStudies.length === 0 ? (
                            <p className={`text-base ${s.muted}`}>You have no past jobs saved, so this section is left out.</p>
                        ) : (
                            <ul className="space-y-1">
                                {caseStudies.map((study) => {
                                    const checked = draft.caseStudyIds.includes(study.id) || draft.caseStudyIds.includes(String(study.index));
                                    return (
                                        <li key={study.id}>
                                            <label className={`flex items-start gap-3 min-h-11 py-2 text-base ${s.body}`}>
                                                <input
                                                    type="checkbox"
                                                    className="mt-1 w-5 h-5 flex-shrink-0"
                                                    checked={checked}
                                                    disabled={busy}
                                                    onChange={() => edit({
                                                        caseStudyIds: checked
                                                            ? draft.caseStudyIds.filter((id) => id !== study.id && id !== String(study.index))
                                                            : [...draft.caseStudyIds, study.id],
                                                    })}
                                                />
                                                <span className="min-w-0 break-words">
                                                    <span className="font-semibold">{study.title}</span>
                                                    {study.projectType && <span className={s.muted}> · {study.projectType}</span>}
                                                </span>
                                            </label>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        {elsewhere("Past jobs are written once and reused.", "/dashboard/settings/case-studies", "Add or change past jobs")}
                    </section>

                    {/* 4. Scope */}
                    <section id="review-scope" className={sectionCard} aria-labelledby="review-scope-title">
                        {sectionTitle("review-scope", 4, "Scope of works", "What the price covers, and what it does not.")}
                        {wordingField("scope", { rows: 7, help: "Start a line with a dash to make it a bullet point." })}

                        <div>
                            <p className={s.label}>Site photos</p>
                            <p className={`mt-0.5 text-sm ${s.muted}`}>Optional. Up to {MAX_PHOTOS}. A caption is shown only if you write one.</p>
                            {draft.photos.length > 0 && (
                                <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {draft.photos.map((photo, index) => (
                                        <li key={photo.url} className={`${s.inset} p-3 space-y-2`} data-review-photo>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={photo.url} alt={photo.caption || `Site photo ${index + 1}`} className="w-full aspect-[4/3] object-cover rounded-lg" />
                                            <label htmlFor={`photo-caption-${index}`} className="sr-only">Caption for photo {index + 1}</label>
                                            <input
                                                id={`photo-caption-${index}`}
                                                value={photo.caption}
                                                maxLength={300}
                                                disabled={busy}
                                                placeholder="Caption (optional)"
                                                onChange={(e) => edit({ photos: draft.photos.map((p, i) => (i === index ? { ...p, caption: e.target.value } : p)) })}
                                                className={s.input}
                                            />
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() => edit({ photos: draft.photos.filter((_, i) => i !== index) })}
                                                className={`${s.quietButton} -ml-3`}
                                            >
                                                <Trash2 className="w-4 h-4" aria-hidden="true" /> Remove photo {index + 1}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {!locked && draft.photos.length < MAX_PHOTOS && (
                                <div className="mt-3">
                                    <input
                                        ref={fileRef}
                                        id="review-photo-file"
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        className="sr-only"
                                        onChange={(e) => void addPhoto(e.target.files?.[0])}
                                    />
                                    <label htmlFor="review-photo-file" className={`${s.secondaryButton} min-h-11 text-sm cursor-pointer ${upload.busy ? "opacity-60 pointer-events-none" : ""}`}>
                                        {upload.busy
                                            ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Uploading…</>
                                            : <><Plus className="w-4 h-4" aria-hidden="true" /> Add a photo</>}
                                    </label>
                                    {upload.error && <p role="alert" className={`mt-2 text-sm ${s.errorText}`}>{upload.error}</p>}
                                </div>
                            )}
                        </div>

                        {wordingField("exclusions", { rows: 4, help: "One item per line." })}
                        {wordingField("clarifications", { rows: 4, help: "One item per line: assumptions, access, anything the price depends on." })}
                    </section>

                    {/* 5. Price */}
                    <section id="review-price" className={sectionCard} aria-labelledby="review-price-title">
                        {sectionTitle("review-price", 5, "Price", "The total comes from your estimate. Your client sees prices, never your overhead, risk or profit.")}
                        {estimateTotals ? (
                            <dl className={`${s.inset} p-3 sm:p-4 space-y-1.5`} data-review-totals>
                                {estimateTotals.map((line) => (
                                    <div key={line.label} className="flex items-baseline justify-between gap-3">
                                        <dt className={`text-base ${line.strong ? `font-bold ${s.heading}` : s.body}`}>{line.label}</dt>
                                        <dd className={`whitespace-nowrap ${line.strong ? `text-xl font-bold ${s.heading}` : `text-base ${s.body}`}`}>{line.value}</dd>
                                    </div>
                                ))}
                                {preview && vatNote(preview.commercial) && <p className={`pt-1 text-sm ${s.muted}`}>{vatNote(preview.commercial)}</p>}
                            </dl>
                        ) : (
                            <p className={`text-base ${s.muted}`}>There is no price yet.</p>
                        )}
                        {elsewhere("Lines and totals are changed in the estimate.", href("costs"), "Open Estimating")}

                        <div>
                            <p className={s.label}>Payment stages</p>
                            <p className={`mt-0.5 text-sm ${s.muted}`}>When you get paid, as a share of the price. For example: Deposit, 30%, on booking.</p>

                            {draft.fixedPayments ? (
                                <div className={`mt-3 ${s.noticeBox} text-sm space-y-3`} data-fixed-payments>
                                    <p>
                                        These stages use fixed amounts set in the earlier proposal editor. They are sent as they are:
                                        {" "}{draft.fixedPayments.map((row) => String((row as { stage?: unknown }).stage ?? "")).filter(Boolean).join(", ")}.
                                    </p>
                                    <button type="button" disabled={busy} onClick={() => edit({ fixedPayments: null, payments: [] })} className={`${s.secondaryButton} min-h-11 text-sm`}>
                                        Replace them with percentage stages
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <ol className="mt-3 space-y-3">
                                        {draft.payments.map((row, index) => {
                                            const stageError = fieldErrors[paymentStageField(row.key)];
                                            const shareError = fieldErrors[paymentShareField(row.key)];
                                            const change = (patch: Partial<typeof row>) =>
                                                edit({ payments: draft.payments.map((p) => (p.key === row.key ? { ...p, ...patch } : p)) });
                                            return (
                                                <li key={row.key} className={`${s.inset} p-3 sm:p-4`} data-payment-stage>
                                                    <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
                                                        <div>
                                                            <label htmlFor={`payment-${index}-stage`} className={s.label}>Stage {index + 1}</label>
                                                            <input
                                                                id={`payment-${index}-stage`}
                                                                value={row.stage}
                                                                disabled={busy}
                                                                maxLength={200}
                                                                autoComplete="off"
                                                                placeholder="e.g. Deposit"
                                                                aria-invalid={stageError ? true : undefined}
                                                                onChange={(e) => change({ stage: e.target.value })}
                                                                className={`${s.input} mt-1.5`}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label htmlFor={`payment-${index}-share`} className={s.label}>Share (%)</label>
                                                            <input
                                                                id={`payment-${index}-share`}
                                                                inputMode="decimal"
                                                                autoComplete="off"
                                                                value={row.percentage}
                                                                disabled={busy}
                                                                aria-invalid={shareError ? true : undefined}
                                                                onChange={(e) => change({ percentage: e.target.value })}
                                                                className={`${s.input} mt-1.5`}
                                                            />
                                                        </div>
                                                    </div>
                                                    <label htmlFor={`payment-${index}-when`} className={`${s.label} mt-3`}>When it is due (optional)</label>
                                                    <input
                                                        id={`payment-${index}-when`}
                                                        value={row.when}
                                                        disabled={busy}
                                                        maxLength={1000}
                                                        autoComplete="off"
                                                        placeholder="e.g. On booking"
                                                        onChange={(e) => change({ when: e.target.value })}
                                                        className={`${s.input} mt-1.5`}
                                                    />
                                                    {(stageError || shareError) && (
                                                        <p role="alert" className={`mt-1.5 text-sm ${s.errorText}`}>{[stageError, shareError].filter(Boolean).join(" ")}</p>
                                                    )}
                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        onClick={() => edit({ payments: draft.payments.filter((p) => p.key !== row.key) })}
                                                        className={`${s.quietButton} -ml-3 mt-1`}
                                                    >
                                                        <Trash2 className="w-4 h-4" aria-hidden="true" /> Remove stage {index + 1}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                    {fieldErrors.payments && <p role="alert" className={`mt-2 text-sm ${s.errorText}`}>{fieldErrors.payments}</p>}
                                    {!locked && draft.payments.length < MAX_PAYMENT_STAGES && (
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => edit({ payments: [...draft.payments, { key: newClientId(), stage: "", when: "", percentage: "" }] })}
                                            className={`${s.secondaryButton} min-h-11 text-sm mt-3`}
                                        >
                                            <Plus className="w-4 h-4" aria-hidden="true" /> Add a payment stage
                                        </button>
                                    )}
                                </>
                            )}
                        </div>

                        <div>
                            <label htmlFor="review-validity" className={s.label}>How many days the price is valid for</label>
                            <input
                                id="review-validity"
                                inputMode="numeric"
                                autoComplete="off"
                                value={draft.validityDays}
                                disabled={busy}
                                aria-invalid={fieldErrors.validityDays ? true : undefined}
                                onChange={(e) => edit({ validityDays: e.target.value })}
                                className={`${s.input} mt-1.5 max-w-[10rem]`}
                            />
                            {fieldErrors.validityDays && <p className={`mt-1.5 text-sm ${s.errorText}`}>{fieldErrors.validityDays}</p>}
                        </div>
                    </section>

                    {/* 6. Programme */}
                    <section id="review-programme" className={sectionCard} aria-labelledby="review-programme-title">
                        {sectionTitle("review-programme", 6, "Programme", "Every proposal shows when the job starts, how long it takes and when it finishes.")}
                        {plan
                            ? <ProgrammeTimeline plan={plan} tone={isDark ? "dark" : "light"} />
                            : <p className={`text-base ${s.muted}`}>There is no programme yet.</p>}
                        {elsewhere("Dates and stages are changed in the programme.", href("schedule"), "Open Programme")}
                    </section>

                    {/* 7. Terms */}
                    <section id="review-terms" className={sectionCard} aria-labelledby="review-terms-title">
                        {sectionTitle("review-terms", 7, "Terms", draft.terms ? "Your own version of the terms is sent." : "The standard terms are sent unless you change them.")}
                        <p className={`text-sm ${s.body}`}>
                            {shownTerms.length} {shownTerms.length === 1 ? "term is" : "terms are"} shown to the client: {shownTerms.map((clause) => clause.title).join(", ") || "none"}.
                        </p>
                        {!locked && (
                            <button type="button" onClick={() => setTermsOpen((open) => !open)} aria-expanded={termsOpen} aria-controls="review-terms-editor" className={`${s.secondaryButton} min-h-11 text-sm`}>
                                {termsOpen ? "Close the terms" : "Change the terms"}
                            </button>
                        )}
                        {termsOpen && !locked && (
                            <div id="review-terms-editor" className="space-y-3">
                                {fieldErrors.terms && <p role="alert" className={`text-sm ${s.errorText}`}>{fieldErrors.terms}</p>}
                                {terms.map((clause, index) => {
                                    const change = (patch: Partial<typeof clause>) =>
                                        edit({ terms: terms.map((c, i) => (i === index ? { ...c, ...patch } : c)) });
                                    const error = fieldErrors[termField(clause.clause_number)];
                                    return (
                                        <div key={clause.clause_number} className={`${s.inset} p-3 sm:p-4 space-y-2`} data-term>
                                            <label htmlFor={`term-${index}-title`} className={s.label}>Term {index + 1}{clause.hidden ? " (hidden from the client)" : ""}</label>
                                            <input id={`term-${index}-title`} value={clause.title} disabled={busy} maxLength={500} onChange={(e) => change({ title: e.target.value })} className={s.input} />
                                            <label htmlFor={`term-${index}-body`} className="sr-only">Wording of term {index + 1}</label>
                                            <textarea id={`term-${index}-body`} rows={3} value={clause.body} disabled={busy} onChange={(e) => change({ body: e.target.value })} className={s.textarea} />
                                            {error && <p role="alert" className={`text-sm ${s.errorText}`}>{error}</p>}
                                            <div className="flex flex-wrap gap-1 -ml-3">
                                                <button type="button" disabled={busy} onClick={() => change({ hidden: !clause.hidden })} className={s.quietButton}>
                                                    {clause.hidden ? "Show this term" : "Hide this term"}
                                                </button>
                                                {clause.custom && (
                                                    <button type="button" disabled={busy} onClick={() => edit({ terms: terms.filter((_, i) => i !== index) })} className={s.quietButton}>
                                                        <Trash2 className="w-4 h-4" aria-hidden="true" /> Remove
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => edit({
                                            terms: [...terms, { clause_number: Math.max(0, ...terms.map((c) => c.clause_number)) + 1, title: "", body: "", hidden: false, custom: true }],
                                        })}
                                        className={`${s.secondaryButton} min-h-11 text-sm`}
                                    >
                                        <Plus className="w-4 h-4" aria-hidden="true" /> Add a term
                                    </button>
                                    {draft.terms && (
                                        <button type="button" disabled={busy} onClick={() => edit({ terms: null })} className={s.quietButton}>
                                            Go back to the standard terms
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* 8. Closing */}
                    <section id="review-closing" className={sectionCard} aria-labelledby="review-closing-title">
                        {sectionTitle("review-closing", 8, "Closing message", "The last thing your client reads before they respond.")}
                        {wordingField("closing", { rows: 4, help: "In your own words. Leave it empty and this section is left out." })}
                    </section>
                </fieldset>

                {!locked && (
                    <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                        <button type="submit" disabled={saving || state.send.status === "publishing"} className={s.secondaryButton} data-save-draft>
                            {saving
                                ? <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Saving…</>
                                : saveFailed ? "Try again" : status === "saved" ? "Saved" : "Save draft"}
                        </button>
                    </div>
                )}
            </form>

            {/* Preview */}
            {!locked && (
                <section className={s.card} aria-labelledby="review-preview-title" data-review-preview>
                    <button
                        type="button"
                        onClick={() => setPreviewOpen((open) => !open)}
                        aria-expanded={previewOpen}
                        aria-controls="review-preview"
                        className={`w-full min-h-14 px-4 sm:px-5 py-3 flex items-center justify-between gap-3 text-left ${s.body}`}
                    >
                        <span>
                            <span id="review-preview-title" className={`block text-lg font-bold ${s.heading}`}>What your client will see</span>
                            <span className={`block text-sm ${s.muted}`}>
                                The web page and the PDF are both made from this.{status !== "saved" ? " It includes your unsaved changes." : ""}
                            </span>
                        </span>
                        <ChevronDown className={`w-5 h-5 flex-shrink-0 transition-transform ${previewOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                    {previewOpen && (
                        <div id="review-preview" className="bg-stone-200 p-2 sm:p-6 rounded-b-2xl">
                            {previewDocument ? (
                                <ProposalDocumentView doc={previewDocument}>
                                    <h2 id="doc-response" className="font-serif text-3xl leading-tight text-stone-900">{previewDocument.response.heading}</h2>
                                    <p className="mt-4 border-l-2 border-[var(--doc-accent)] bg-[var(--doc-accent-soft)] px-4 py-3 text-base leading-relaxed text-stone-800">
                                        {previewDocument.response.notice}
                                    </p>
                                    <p className="mt-4 min-h-14 flex items-center justify-center bg-[var(--doc-accent)] px-5 text-base font-semibold text-white opacity-80" aria-hidden="true">
                                        {previewDocument.response.actionLabel}
                                    </p>
                                    <p className="mt-2 text-sm text-stone-600">Your client fills in their name and presses this button. It does nothing in the preview.</p>
                                </ProposalDocumentView>
                            ) : (
                                <p className="bg-white p-6 text-base text-stone-700">
                                    The preview appears once the job has a name and an estimate.
                                </p>
                            )}
                        </div>
                    )}
                </section>
            )}

            {/* Send */}
            {!locked && (
                <section className={`${s.card} p-4 sm:p-6 space-y-5`} aria-labelledby="review-send-title" data-review-send>
                    <div>
                        <h2 id="review-send-title" className={`text-lg font-bold ${s.heading}`}>Send to your client</h2>
                        <p className={`mt-1 text-sm ${s.muted}`}>
                            Sending makes version {context.nextVersion}: a fixed copy your client can open from a private link.
                            {current ? ` It replaces version ${current.version_number}, which stays in your sent versions.` : ""}
                        </p>
                    </div>

                    <fieldset className="space-y-2" disabled={state.send.status === "publishing"}>
                        <legend className={s.label}>What do you want your client to do?</legend>
                        {RESPONSE_KINDS.map((kind) => {
                            const wording = responseWording(kind);
                            const chosen = state.responseKind === kind;
                            return (
                                <label
                                    key={kind}
                                    data-response-option={kind}
                                    className={`flex items-start gap-3 rounded-xl border p-3 sm:p-4 cursor-pointer ${
                                        chosen ? "border-blue-500 ring-1 ring-blue-500" : isDark ? "border-[#3a3a3a]" : "border-gray-300"
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="response-kind"
                                        className="mt-1 w-5 h-5 flex-shrink-0"
                                        checked={chosen}
                                        onChange={() => store.dispatch({ type: "response/choose", kind })}
                                    />
                                    <span className="min-w-0">
                                        <span className={`block text-base font-semibold ${s.heading}`}>{wording.optionLabel}</span>
                                        <span className={`block text-sm ${s.muted}`}>{wording.optionHelp}</span>
                                    </span>
                                </label>
                            );
                        })}
                        <p className={`text-sm ${s.muted}`}>
                            Neither option is acceptance. A proposal sent here cannot be accepted as a binding contract online.
                        </p>
                    </fieldset>

                    <div>
                        {project.client_email ? (
                            <label className={`flex items-start gap-3 min-h-11 py-1 text-base ${s.body}`}>
                                <input
                                    type="checkbox"
                                    className="mt-1 w-5 h-5 flex-shrink-0"
                                    checked={deliverByEmail}
                                    disabled={state.send.status === "publishing"}
                                    onChange={(e) => setDeliverByEmail(e.target.checked)}
                                />
                                <span className="min-w-0 break-words">Email the link to <strong>{project.client_email}</strong></span>
                            </label>
                        ) : (
                            <div>
                                <p className={`text-sm ${s.muted}`}>No client email is saved, so you will get a link to share yourself.</p>
                                <Link href={href("settings")} className={`${s.quietButton} -ml-3`}>Add the client&apos;s email</Link>
                            </div>
                        )}
                    </div>

                    <label className={`flex items-start gap-3 min-h-11 py-1 text-base ${s.body}`}>
                        <input
                            type="checkbox"
                            className="mt-1 w-5 h-5 flex-shrink-0"
                            checked={state.confirmed}
                            disabled={!readiness.ready || state.send.status === "publishing"}
                            onChange={(e) => store.dispatch({ type: "confirm/set", confirmed: e.target.checked })}
                            data-send-confirm
                        />
                        <span className="min-w-0">
                            I have read the preview and it is right. Send version {context.nextVersion} to {project.client_name || "the client"}.
                        </span>
                    </label>

                    {block && block !== "publishing" && (
                        <p id="send-block-reason" className={`text-sm ${s.muted}`} data-send-block={block}>{SEND_BLOCK_MESSAGE[block]}</p>
                    )}

                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={block !== null}
                        aria-describedby={block && block !== "publishing" ? "send-block-reason" : undefined}
                        className={`${s.primaryButton} w-full sm:w-auto`}
                        data-send-button
                    >
                        {state.send.status === "publishing"
                            ? <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Sending…</>
                            : <><Send className="w-5 h-5" aria-hidden="true" /> {state.send.status === "failed" ? "Try sending again" : `Send version ${context.nextVersion}`}</>}
                    </button>

                    <div ref={resultRef} className="scroll-mt-20 scroll-mb-4">
                        {state.send.status === "failed" && (
                            <div role="alert" className={`${s.errorBox} flex items-start gap-3 text-sm`} data-send-result="failed">
                                <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                                <p>{state.send.error} Nothing was sent and your draft is unchanged.</p>
                            </div>
                        )}
                        {state.send.status === "unknown" && (
                            <div role="alert" className={`${s.noticeBox} flex items-start gap-3 text-sm`} data-send-result="unknown">
                                <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                                <p>{state.send.error}</p>
                            </div>
                        )}
                        {state.published && (
                            <div role="status" className={`${s.successBox} space-y-3 text-sm`} data-send-result="published">
                                <p className="text-base font-bold">Version {state.published.versionNumber} is published.</p>
                                <p>{responseWording(state.published.responseKind).optionHelp}</p>

                                {state.published.delivery.status === "sent" && (
                                    <p data-delivery="sent">The link was emailed to {state.published.delivery.email}.</p>
                                )}
                                {state.published.delivery.status === "not_requested" && (
                                    <p data-delivery="not_requested">No email was sent. Share the link below with your client.</p>
                                )}
                                {state.published.delivery.status === "failed" && (
                                    <div role="alert" className={`${s.errorBox} space-y-2`} data-delivery="failed">
                                        <p>
                                            The proposal is published, but the email to {state.published.delivery.email} could not be sent.
                                            Share the link below yourself, or try the email again.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => void retryDelivery(store, api.retry)}
                                            disabled={state.delivery.status === "sending"}
                                            className={`${s.secondaryButton} min-h-11 text-sm`}
                                        >
                                            {state.delivery.status === "sending"
                                                ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Sending the email…</>
                                                : "Try the email again"}
                                        </button>
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="published-link" className="font-semibold">Private link for your client</label>
                                    <input id="published-link" ref={linkRef} readOnly value={state.published.url} onFocus={(e) => e.currentTarget.select()} className={`${s.input} mt-1.5`} />
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <button type="button" onClick={() => void copyLink()} className={`${s.secondaryButton} min-h-11 text-sm`}>Copy the link</button>
                                    <button type="button" onClick={() => void downloadCurrentPdf()} disabled={pdfNote.busy} className={`${s.secondaryButton} min-h-11 text-sm`}>
                                        {pdfNote.busy ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Making the PDF…</> : "Download the PDF"}
                                    </button>
                                </div>
                                {copy && <p aria-live="polite">{copy}</p>}
                                {pdfNote.text && <p role={pdfNote.failed ? "alert" : "status"}>{pdfNote.text}</p>}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {publications.length > 0 && (
                <PublicationHistoryPanel
                    publications={publications}
                    s={s as WorkspaceStyles}
                    loadPublication={(publicationId) => api.loadPublication(publicationId)}
                />
            )}
        </div>
    );
}
