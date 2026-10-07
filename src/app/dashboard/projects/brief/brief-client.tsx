"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, Loader2, Sparkles, X } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { isCapabilityEnabled } from "@/lib/launch-profile";
import { newClientId } from "@/lib/client-id";
import { useReducerStore } from "@/lib/use-reducer-store";
import { workspaceStyles, type WorkspaceStyles } from "@/lib/workspace-styles";
import SaveStatus from "@/components/save-status";
import {
    BRIEF_STAGES,
    BRIEF_TRADES,
    CLIENT_TYPES,
    SAVE_STATUS_LABEL,
    adjacentStage,
    briefReducer,
    briefSaveStatus,
    continueToPricing,
    initialBriefState,
    isBriefConfirmed,
    isSuggestionStale,
    pricingPathForProject,
    requestSuggestion,
    saveBrief,
    stageIndex,
    suggestionFromRaw,
    suggestionParts,
    type AskAssistant,
    type BriefDraft,
    type BriefProjectFields,
    type BriefStageKey,
    type BriefSuggestion,
    type ClientType,
    type SaveBrief,
    type SuggestionPart,
} from "@/lib/guided-brief";
import { saveBriefAction, suggestBriefAction, type VideoAnalysisResult } from "./actions";

const VideoWalkthrough = dynamic(() => import("./video-walkthrough"), {
    ssr: false,
    loading: () => <p className="text-sm">Loading…</p>,
});

interface Project extends BriefProjectFields {
    id: string;
    name: string;
    client_name: string;
    site_address: string;
    postcode: string;
}

interface Props {
    project: Project;
    /** Default to the real server actions; replaced only by tests and evidence capture. */
    ask?: (projectId: string, description: string) => ReturnType<AskAssistant>;
    save?: (projectId: string, payload: Parameters<SaveBrief>[0]) => ReturnType<SaveBrief>;
}

const CLIENT_TYPE_LABEL: Record<ClientType, string> = {
    domestic: "A homeowner",
    commercial: "A business",
    public: "Public sector",
};

const formatValue = (raw: string): string => {
    const n = Number(raw.replace(/[£,\s]/g, ""));
    return raw.trim() && Number.isFinite(n) ? `£${n.toLocaleString("en-GB")}` : raw.trim();
};

const formatDate = (iso: string): string => {
    const date = new Date(`${iso}T00:00:00`);
    return Number.isNaN(date.getTime())
        ? iso
        : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

export default function BriefClient({ project, ask = suggestBriefAction, save = saveBriefAction }: Props) {
    const router = useRouter();
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const s = workspaceStyles(isDark);

    const [state, store] = useReducerStore(briefReducer, () => initialBriefState(project));
    const { draft, stage, suggestion } = state;
    const status = briefSaveStatus(state);
    const confirmed = isBriefConfirmed(state);
    const saving = state.save.status === "saving";

    const [leaving, setLeaving] = useState(false);
    const [postcode, setPostcode] = useState(project.postcode);
    const [postcodeNote, setPostcodeNote] = useState("");
    const [tradeSearch, setTradeSearch] = useState("");
    const [showCapture, setShowCapture] = useState(false);
    const lastSaveWasConfirm = useRef(false);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const saveAlertRef = useRef<HTMLDivElement>(null);

    const showVideo = isCapabilityEnabled("video-walkthrough");
    const showDrawing = isCapabilityEnabled("drawing-takeoff");

    // Unsaved typing is never thrown away silently: a reload or tab close
    // asks first, and so does any link that leaves the Brief (project tabs,
    // sidebar). "Build the price" saves instead, so it is not affected.
    const dirty = status === "unsaved" || status === "failed" || status === "saving";
    useEffect(() => {
        if (!dirty) return;
        const warnOnUnload = (event: BeforeUnloadEvent) => event.preventDefault();
        const confirmOnLink = (event: MouseEvent) => {
            const link = (event.target as HTMLElement | null)?.closest?.("a[href]");
            if (!link || link.getAttribute("target") === "_blank") return;
            const stay = !window.confirm(
                "Your brief has changes that are not saved yet.\n\nPress Cancel to stay here and save them, or OK to leave without saving.",
            );
            if (stay) {
                event.preventDefault();
                event.stopPropagation();
            }
        };
        window.addEventListener("beforeunload", warnOnUnload);
        document.addEventListener("click", confirmOnLink, true);
        return () => {
            window.removeEventListener("beforeunload", warnOnUnload);
            document.removeEventListener("click", confirmOnLink, true);
        };
    }, [dirty]);

    // A save can be started from the bottom of a long page. Bring the failure
    // and its retry into view rather than leaving them off screen.
    const saveFailed = state.save.status === "failed";
    useEffect(() => {
        if (!saveFailed) return;
        saveAlertRef.current?.scrollIntoView({ block: "center" });
        saveAlertRef.current?.focus({ preventScroll: true });
    }, [saveFailed, state.save.error]);

    const edit = (patch: Partial<BriefDraft>) => store.dispatch({ type: "draft/edit", patch });
    const goTo = (next: BriefStageKey) => {
        store.dispatch({ type: "stage/set", stage: next });
        window.requestAnimationFrame(() => headingRef.current?.focus());
    };

    const saveFn: SaveBrief = (payload) => save(project.id, payload);

    const handleSave = (confirm: boolean) => {
        lastSaveWasConfirm.current = confirm;
        void saveBrief(store, saveFn, { confirm });
    };

    const handleBuildPrice = async () => {
        lastSaveWasConfirm.current = true;
        const outcome = await continueToPricing(store, saveFn, () => {
            setLeaving(true);
            router.push(pricingPathForProject(project.id));
        });
        if (outcome === "invalid") window.requestAnimationFrame(() => headingRef.current?.focus());
    };

    const handleAsk = () => {
        void requestSuggestion(store, (work) => ask(project.id, work), newClientId());
    };

    const handleVideoApply = (result: VideoAnalysisResult) => {
        // Video analysis is a suggestion like any other: it waits for Apply.
        store.dispatch({
            type: "suggestion/received",
            suggestion: suggestionFromRaw(result, {
                id: newClientId(),
                source: "video",
                basedOnWork: store.getState().draft.work,
                draft: store.getState().draft,
            }),
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handlePostcodeLookup = async () => {
        const clean = postcode.replace(/\s+/g, "").toUpperCase();
        setPostcodeNote("");
        if (clean.length < 5) return;
        try {
            const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`);
            const data = await res.json();
            if (data.status === 200 && data.result) {
                edit({
                    lat: data.result.latitude,
                    lng: data.result.longitude,
                    region: data.result.region || data.result.european_electoral_region || "",
                });
            } else {
                setPostcodeNote("We couldn't find that postcode. You can carry on without it.");
            }
        } catch {
            setPostcodeNote("We couldn't look up that postcode just now. You can carry on without it.");
        }
    };

    const filteredTrades = BRIEF_TRADES.filter((t) => t.toLowerCase().includes(tradeSearch.trim().toLowerCase()));
    const current = BRIEF_STAGES[stageIndex(stage)];
    const siteAddress = project.site_address;

    return (
        <div className="space-y-5">
            {/* Title and save state */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className={`text-2xl sm:text-3xl font-bold break-words ${s.heading}`}>Job brief</h1>
                    <p className={`mt-1 text-base break-words ${s.muted}`}>
                        {project.name}{project.client_name ? ` for ${project.client_name}` : ""}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <SaveStatus status={status} label={SAVE_STATUS_LABEL[status]} isDark={isDark} />
                    {(status === "unsaved" || status === "saving") && (
                        <button type="button" onClick={() => handleSave(false)} disabled={saving} className={s.quietButton}>
                            Save
                        </button>
                    )}
                </div>
            </div>

            {saveFailed && (
                <div ref={saveAlertRef} tabIndex={-1} role="alert" className={`${s.errorBox} flex flex-wrap items-center gap-3 focus:outline-none`}>
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                    <p className="flex-1 min-w-[12rem] text-sm">{state.save.error}</p>
                    <button
                        type="button"
                        onClick={() => handleSave(lastSaveWasConfirm.current)}
                        className={`${s.secondaryButton} min-h-11 text-sm`}
                    >
                        Try again
                    </button>
                </div>
            )}

            {/* Stages */}
            <nav aria-label="Brief steps">
                <ol className="grid grid-cols-4 gap-1.5 sm:gap-2">
                    {BRIEF_STAGES.map((item, index) => {
                        const active = item.key === stage;
                        return (
                            <li key={item.key}>
                                <button
                                    type="button"
                                    onClick={() => goTo(item.key)}
                                    aria-current={active ? "step" : undefined}
                                    className={`w-full min-h-14 px-1 py-1.5 rounded-xl border text-center transition-colors ${
                                        active
                                            ? "border-blue-500 bg-blue-600 text-white"
                                            : isDark
                                                ? "border-[#2a2a2a] bg-[#1a1a1a] text-slate-300 hover:border-slate-500"
                                                : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
                                    }`}
                                >
                                    <span className="block text-xs font-semibold">Step {index + 1}</span>
                                    <span className="block text-xs sm:text-sm font-bold leading-tight">{item.short}</span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </nav>

            {suggestion && (
                <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    draft={draft}
                    s={s}
                    onApply={(parts, replaceNewerWork) => store.dispatch({ type: "suggestion/applied", parts, replaceNewerWork })}
                    onDiscard={() => store.dispatch({ type: "suggestion/discarded" })}
                />
            )}
            {!suggestion && state.lastOutcome && (
                <p role="status" className={`${state.lastOutcome === "applied" ? s.successBox : s.inset} text-sm px-4 py-3 ${s.body}`}>
                    {state.lastOutcome === "applied"
                        ? "Suggestion applied to your draft. Check it reads right. It is not saved until you save the brief."
                        : "Suggestion discarded. Your draft has not changed."}
                </p>
            )}

            <section className={`${s.card} p-5 sm:p-8 space-y-5`} aria-labelledby="brief-stage-title">
                <h2 id="brief-stage-title" ref={headingRef} tabIndex={-1} className={`text-xl font-bold focus:outline-none ${s.heading}`}>
                    {current.title}
                </h2>

                {stage === "client" && (
                    <>
                        <div>
                            <label htmlFor="brief-work" className={s.label}>Describe the job in your own words</label>
                            <p id="brief-work-help" className={`mt-1 text-sm ${s.muted}`}>
                                Write it how you&apos;d say it to the client. Rough notes are fine.
                            </p>
                            <textarea
                                id="brief-work"
                                aria-describedby="brief-work-help"
                                rows={7}
                                value={draft.work}
                                onChange={(e) => edit({ work: e.target.value })}
                                placeholder="e.g. Strip out the old bathroom, move the soil pipe, fit new suite and tile throughout"
                                className={`${s.textarea} mt-2`}
                            />
                        </div>

                        <div className={`${s.inset} p-4 space-y-3`}>
                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleAsk}
                                    disabled={!draft.work.trim() || state.ai.status === "loading" || !!suggestion}
                                    className={`${s.secondaryButton} min-h-11 text-sm`}
                                >
                                    {state.ai.status === "loading"
                                        ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Working on it…</>
                                        : <><Sparkles className="w-4 h-4" aria-hidden="true" /> {state.ai.status === "failed" ? "Try the assistant again" : "Tidy this up for me"}</>}
                                </button>
                                {state.ai.status === "loading" && (
                                    <button type="button" onClick={() => store.dispatch({ type: "ai/cancelled" })} className={s.quietButton}>
                                        Cancel
                                    </button>
                                )}
                            </div>
                            <p className={`text-sm ${s.muted}`}>
                                {suggestion
                                    ? "Apply or discard the suggestion above before asking again."
                                    : "Optional. The assistant suggests clearer wording and the trades involved. Nothing changes until you apply it."}
                            </p>
                            {state.ai.status === "failed" && (
                                <p role="alert" className={`text-sm font-medium ${s.errorText}`}>{state.ai.error}</p>
                            )}
                        </div>

                        <fieldset>
                            <legend className={s.label}>Who is the client?</legend>
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {CLIENT_TYPES.map((type) => {
                                    const selected = draft.clientType === type;
                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => edit({ clientType: type })}
                                            className={`min-h-12 px-4 rounded-xl border text-base font-semibold transition-colors ${
                                                selected
                                                    ? "border-blue-500 bg-blue-600 text-white"
                                                    : isDark
                                                        ? "border-[#3a3a3a] text-slate-200 hover:border-slate-400"
                                                        : "border-gray-300 text-gray-800 hover:border-gray-500"
                                            }`}
                                        >
                                            {CLIENT_TYPE_LABEL[type]}
                                        </button>
                                    );
                                })}
                            </div>
                        </fieldset>
                    </>
                )}

                {stage === "work" && (
                    <>
                        <p className={`text-base ${s.muted}`}>
                            Pick the trades this job involves. Skip this if you&apos;re not sure yet.
                        </p>

                        {draft.trades.length > 0 && (
                            <div>
                                <p className={s.label}>Included ({draft.trades.length})</p>
                                <ul className="mt-2 flex flex-wrap gap-2">
                                    {draft.trades.map((trade) => (
                                        <li key={trade}>
                                            <button
                                                type="button"
                                                onClick={() => store.dispatch({ type: "draft/toggleTrade", trade })}
                                                aria-label={`Remove ${trade}`}
                                                className="min-h-11 pl-3 pr-2 rounded-full bg-blue-600 text-white text-sm font-semibold inline-flex items-center gap-1.5"
                                            >
                                                {trade}
                                                <X className="w-4 h-4" aria-hidden="true" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div>
                            <label htmlFor="brief-trade-search" className={s.label}>Find a trade</label>
                            <input
                                id="brief-trade-search"
                                type="search"
                                value={tradeSearch}
                                onChange={(e) => setTradeSearch(e.target.value)}
                                placeholder="e.g. plumbing, roofing, tiling"
                                className={`${s.input} mt-2`}
                            />
                        </div>

                        <ul className={`${s.inset} max-h-80 overflow-y-auto p-2 grid sm:grid-cols-2 gap-1.5`} aria-label="Trades">
                            {filteredTrades.map((trade) => {
                                const selected = draft.trades.includes(trade);
                                return (
                                    <li key={trade}>
                                        <button
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => store.dispatch({ type: "draft/toggleTrade", trade })}
                                            className={`w-full min-h-11 px-3 py-2 rounded-lg border text-left text-sm font-medium flex items-center gap-2 transition-colors ${
                                                selected
                                                    ? isDark ? "border-blue-400 bg-blue-500/20 text-white" : "border-blue-500 bg-blue-50 text-blue-900"
                                                    : isDark ? "border-transparent text-slate-200 hover:bg-white/5" : "border-transparent text-gray-800 hover:bg-white"
                                            }`}
                                        >
                                            <span className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                                                selected ? "bg-blue-600 border-blue-600 text-white" : isDark ? "border-slate-500" : "border-gray-400"
                                            }`}>
                                                {selected && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                                            </span>
                                            {trade}
                                        </button>
                                    </li>
                                );
                            })}
                            {filteredTrades.length === 0 && (
                                <li className={`px-3 py-3 text-sm ${s.muted}`}>No trade matches that. Try a different word.</li>
                            )}
                        </ul>
                    </>
                )}

                {stage === "site" && (
                    <>
                        <div className={`${s.inset} px-4 py-3`}>
                            <p className={`text-sm font-semibold ${s.body}`}>Site address</p>
                            <p className={`mt-0.5 text-base break-words ${siteAddress ? s.body : s.muted}`}>
                                {siteAddress || "No site address has been added to this project."}
                            </p>
                        </div>

                        <div>
                            <label htmlFor="brief-site-notes" className={s.label}>Access, restrictions and assumptions</label>
                            <p id="brief-site-notes-help" className={`mt-1 text-sm ${s.muted}`}>
                                Parking, working hours, who supplies what, anything you&apos;re assuming. Leave it blank if there&apos;s nothing to add.
                            </p>
                            <textarea
                                id="brief-site-notes"
                                aria-describedby="brief-site-notes-help"
                                rows={5}
                                value={draft.siteNotes}
                                onChange={(e) => edit({ siteNotes: e.target.value })}
                                placeholder="e.g. Rear access only. Client to clear the room before we start."
                                className={`${s.textarea} mt-2`}
                            />
                        </div>

                        <div className="grid sm:grid-cols-2 gap-5">
                            <div>
                                <label htmlFor="brief-start-date" className={s.label}>Likely start date</label>
                                <input
                                    id="brief-start-date"
                                    type="date"
                                    value={draft.startDate}
                                    onChange={(e) => edit({ startDate: e.target.value })}
                                    className={`${s.input} mt-2`}
                                />
                            </div>
                            <div>
                                <label htmlFor="brief-rough-value" className={s.label}>Rough value (£)</label>
                                <input
                                    id="brief-rough-value"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    value={draft.roughValue}
                                    onChange={(e) => edit({ roughValue: e.target.value })}
                                    placeholder="Optional"
                                    className={`${s.input} mt-2`}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="brief-postcode" className={s.label}>Site postcode</label>
                            <p id="brief-postcode-help" className={`mt-1 text-sm ${s.muted}`}>Optional. Used to find the region.</p>
                            <input
                                id="brief-postcode"
                                aria-describedby="brief-postcode-help"
                                autoComplete="off"
                                value={postcode}
                                onChange={(e) => setPostcode(e.target.value)}
                                onBlur={handlePostcodeLookup}
                                placeholder="e.g. SW1A 1AA"
                                className={`${s.input} mt-2 sm:max-w-xs`}
                            />
                            {(draft.region || postcodeNote) && (
                                <p role="status" className={`mt-1.5 text-sm ${s.muted}`}>
                                    {postcodeNote || `Region: ${draft.region}`}
                                </p>
                            )}
                        </div>

                        {(showVideo || showDrawing) && (
                            <div className={`rounded-xl border ${s.divider}`}>
                                <button
                                    type="button"
                                    onClick={() => setShowCapture((open) => !open)}
                                    aria-expanded={showCapture}
                                    aria-controls="brief-capture"
                                    className={`w-full min-h-12 px-4 flex items-center justify-between gap-3 text-left text-sm font-semibold ${s.body}`}
                                >
                                    <span className="py-2">
                                        <span className="block">Other ways to capture the job</span>
                                        <span className={`block font-normal ${s.muted}`}>Optional. Site video or drawings.</span>
                                    </span>
                                    <ChevronDown className={`w-5 h-5 flex-shrink-0 transition-transform ${showCapture ? "rotate-180" : ""}`} aria-hidden="true" />
                                </button>
                                {showCapture && (
                                    <div id="brief-capture" className="px-4 pb-4 space-y-4">
                                        {showVideo && (
                                            <div className="rounded-xl bg-slate-950 p-3">
                                                <VideoWalkthrough onApply={handleVideoApply} />
                                            </div>
                                        )}
                                        {showDrawing && (
                                            <p className={`text-sm ${s.muted}`}>
                                                Have a drawing? Take quantities off it under Advanced estimating once you start{" "}
                                                <Link href={pricingPathForProject(project.id)} className="underline font-semibold">
                                                    building the price
                                                </Link>.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {stage === "review" && (
                    <>
                        <p className={`text-base ${s.muted}`}>
                            This is what will be saved. Change anything that isn&apos;t right.
                        </p>
                        <dl className={`divide-y ${isDark ? "divide-[#2a2a2a]" : "divide-gray-200"}`}>
                            <ReviewRow s={s} label="The job" onChange={() => goTo("client")}>
                                {draft.work.trim()
                                    ? <span className="whitespace-pre-wrap">{draft.work.trim()}</span>
                                    : <span className={s.errorText}>Not described yet. Add a description before you confirm.</span>}
                            </ReviewRow>
                            <ReviewRow s={s} label="Client" onChange={() => goTo("client")}>
                                {CLIENT_TYPE_LABEL[draft.clientType]}
                            </ReviewRow>
                            <ReviewRow s={s} label="Work included" onChange={() => goTo("work")}>
                                {draft.trades.length > 0 ? draft.trades.join(", ") : <span className={s.muted}>No trades picked</span>}
                            </ReviewRow>
                            <ReviewRow s={s} label="Site and assumptions" onChange={() => goTo("site")}>
                                {draft.siteNotes.trim()
                                    ? <span className="whitespace-pre-wrap">{draft.siteNotes.trim()}</span>
                                    : <span className={s.muted}>Nothing added</span>}
                            </ReviewRow>
                            <ReviewRow s={s} label="Start and value" onChange={() => goTo("site")}>
                                {draft.startDate ? `Start ${formatDate(draft.startDate)}` : "No start date"}
                                {" · "}
                                {draft.roughValue.trim() ? `About ${formatValue(draft.roughValue)}` : "No rough value"}
                            </ReviewRow>
                        </dl>
                    </>
                )}

                {/* Stage actions */}
                <div className={`pt-5 border-t ${s.divider} flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3`}>
                    {stage !== "client" ? (
                        <button type="button" onClick={() => goTo(adjacentStage(stage, -1))} className={s.secondaryButton}>
                            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
                        </button>
                    ) : <span />}

                    {stage !== "review" ? (
                        <button type="button" onClick={() => goTo(adjacentStage(stage, 1))} className={s.primaryButton}>
                            Next <ArrowRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                    ) : (
                        <div className="flex flex-col sm:flex-row gap-3">
                            {!confirmed && (
                                <button type="button" onClick={() => handleSave(true)} disabled={saving || leaving} className={s.secondaryButton}>
                                    Confirm and save
                                </button>
                            )}
                            <button type="button" onClick={handleBuildPrice} disabled={saving || leaving} className={s.primaryButton}>
                                {saving || leaving
                                    ? <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> {leaving ? "Opening pricing…" : "Saving…"}</>
                                    : <>{confirmed ? "Build the price" : "Save and build the price"} <ArrowRight className="w-4 h-4" aria-hidden="true" /></>}
                            </button>
                        </div>
                    )}
                </div>
                {stage === "review" && !confirmed && (
                    <p className={`text-sm ${s.muted}`}>
                        Your brief is saved before pricing opens. If the save fails you stay here with everything you typed.
                    </p>
                )}
            </section>
        </div>
    );
}

function ReviewRow({ s, label, onChange, children }: { s: WorkspaceStyles; label: string; onChange: () => void; children: React.ReactNode }) {
    return (
        // A term, its value and its action sit directly in the group so the
        // list is read out as terms and values.
        <div className="py-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3">
            <dt className={`col-start-1 text-sm font-semibold ${s.muted}`}>{label}</dt>
            <dd className={`col-start-1 mt-0.5 text-base break-words ${s.body}`}>{children}</dd>
            <dd className="col-start-2 row-start-1 row-span-2">
                <button type="button" onClick={onChange} aria-label={`Change ${label.toLowerCase()}`} className={s.quietButton}>
                    Change
                </button>
            </dd>
        </div>
    );
}

const PART_LABEL: Record<SuggestionPart, string> = {
    work: "Clearer wording for the job",
    trades: "Trades to add",
    siteNotes: "Site notes to add",
    clientType: "Client",
    roughValue: "Rough value you mentioned",
    startDate: "Start date you mentioned",
};

function SuggestionCard({
    suggestion,
    draft,
    s,
    onApply,
    onDiscard,
}: {
    suggestion: BriefSuggestion;
    draft: BriefDraft;
    s: WorkspaceStyles;
    onApply: (parts: SuggestionPart[], replaceNewerWork: boolean) => void;
    onDiscard: () => void;
}) {
    const parts = suggestionParts(suggestion);
    const stale = isSuggestionStale(suggestion, draft);
    const [picked, setPicked] = useState<SuggestionPart[]>(parts);
    const [replaceNewer, setReplaceNewer] = useState(false);

    // Wording written from an older description is only applied when the
    // contractor has said, after the change, that they want it.
    const chosen = picked.filter((part) => !(part === "work" && stale && !replaceNewer));

    const toggle = (part: SuggestionPart, on: boolean) => {
        if (part === "work" && stale) setReplaceNewer(on);
        setPicked((prev) => (on ? Array.from(new Set([...prev, part])) : prev.filter((p) => p !== part)));
    };

    const content = (part: SuggestionPart): React.ReactNode => {
        switch (part) {
            case "work": return <span className="whitespace-pre-wrap">{suggestion.work}</span>;
            case "trades": return suggestion.trades.join(", ");
            case "siteNotes": return <span className="whitespace-pre-wrap">{suggestion.siteNotes}</span>;
            case "clientType": return suggestion.clientType ? CLIENT_TYPE_LABEL[suggestion.clientType] : null;
            case "roughValue": return suggestion.roughValue !== null ? `£${suggestion.roughValue.toLocaleString("en-GB")}` : null;
            case "startDate": return suggestion.startDate ? formatDate(suggestion.startDate) : null;
        }
    };

    return (
        <section className={`${s.suggestionBox} p-4 sm:p-5 space-y-4`} aria-labelledby="brief-suggestion-title" data-suggestion="pending">
            <div>
                <p className={`text-xs font-bold uppercase tracking-wide ${s.muted}`}>Suggestion · not applied</p>
                <h2 id="brief-suggestion-title" className={`mt-1 text-lg font-bold ${s.heading}`}>
                    {suggestion.source === "video" ? "From your site video" : "From the assistant"}
                </h2>
                <p className={`mt-1 text-sm ${s.muted}`}>
                    {parts.length > 0
                        ? "Nothing below is in your brief yet. Tick what you want, then Apply. Discard leaves your draft as it is."
                        : "The assistant had nothing to add to what you wrote."}
                </p>
            </div>

            {parts.length > 0 && (
                <ul className="space-y-2">
                    {parts.map((part) => {
                        const isStaleWork = part === "work" && stale;
                        const checked = isStaleWork ? replaceNewer : picked.includes(part);
                        return (
                            <li key={part}>
                                <label className={`${s.card} flex items-start gap-3 p-3 cursor-pointer`}>
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => toggle(part, e.target.checked)}
                                        className="mt-0.5 w-6 h-6 flex-shrink-0 accent-blue-600"
                                    />
                                    <span className="min-w-0">
                                        <span className={`block text-sm font-semibold ${s.muted}`}>{PART_LABEL[part]}</span>
                                        <span className={`block mt-0.5 text-base break-words ${s.body}`}>{content(part)}</span>
                                        {part === "work" && draft.work.trim() && (
                                            <span className={`block mt-1.5 text-sm ${isStaleWork ? s.errorText : s.muted}`}>
                                                {isStaleWork
                                                    ? "You've changed your description since asking. This wording is based on the older version, so it is unticked. Ticking it replaces what you have now."
                                                    : "Applying this replaces your description."}
                                            </span>
                                        )}
                                    </span>
                                </label>
                            </li>
                        );
                    })}
                </ul>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
                {parts.length > 0 && (
                    <button
                        type="button"
                        onClick={() => onApply(chosen, stale && replaceNewer)}
                        disabled={chosen.length === 0}
                        className={s.primaryButton}
                    >
                        Apply
                    </button>
                )}
                <button type="button" onClick={onDiscard} className={s.secondaryButton}>
                    Discard
                </button>
            </div>
        </section>
    );
}
