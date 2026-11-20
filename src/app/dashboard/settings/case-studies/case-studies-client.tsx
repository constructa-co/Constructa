"use client";

import { useEffect, useId, useReducer, useRef, useState, type Reducer } from "react";
import ui from "@/components/past-work.module.css";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronUp, Upload, Loader2, MapPin, Briefcase, Calendar, PoundSterling, Sparkles } from "lucide-react";
import { saveCaseStudiesAction, enhanceCaseStudyAction } from "./actions";
import type { CaseStudyResult, CaseStudySection } from "@/lib/cohort-ai/case-study-enhance";
import { caseStudyTextEnhanceEnabled } from "@/lib/cohort-ai/case-study-enhance-enabled";
import { COHORT_AI_OFF } from "@/lib/cohort-ai/shared";
import { pendingFrom, sectionState, settle, type PendingCaseStudySuggestion } from "@/lib/cohort-ai/case-study-suggestion";
import { uploadProfileImageAction } from "@/app/storage/actions";
import { PUBLIC_IMAGE_LIMITS_HINT, publicImageProblem } from "@/lib/storage/public-image";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";
import {
    CASE_STUDY_DUPLICATE_PHOTO_MESSAGE,
    CASE_STUDY_PRIMARY_LABEL,
    caseStudyPhotoContentHash,
    legacyTailPhotoCount,
    mergeLegacyProfilePhotoUrls,
    splitLegacyProfilePhotoUrls,
} from "@/lib/case-library/case-study-photo-behaviour";
import { SAVE_MESSAGES, initialSaveState, needsLeaveWarning, requestOf, saveReducer, statusLine, type SaveAction, type SaveCaseStudiesResult, type SaveState } from "./save-state";
import { JOB_TYPE_EXAMPLES } from "@/lib/job-type-options";
import type { CaseStudySectorId } from "@/lib/case-study-example-tags";
import { exampleTagSuggestions, legacyCaseStudyForSave } from "@/lib/case-study-example-tags";
import ExampleTagsSection from "./example-tags-section";
import {
    coreFocusRing,
    coreFocusVisibleRing,
    coreProfileFieldBase,
    coreProfileTextarea,
    coreSuggestionPrimary,
} from "@/lib/core-editing-palette";
import ChallengeResolution, { type StoryNotes } from "./challenge-resolution";
import { typedValueAmount } from "@/lib/case-study-value";

type Enhance = (whatWeDelivered: string, valueAdded: string, projectName: string, projectType: string) => Promise<CaseStudyResult>;
type Save = (caseStudies: unknown, expectedFingerprint: string, unconfirmed: unknown[][]) => Promise<SaveCaseStudiesResult>;

interface CaseStudy {
    id: string;
    projectName: string;
    projectType: string;
    contractValue: string;
    programmeDuration: string;
    client: string;
    location: string;
    whatWeDelivered: string;
    valueAdded: string;
    photos: string[];
    /** Which of the three active slots is the main picture on proposals (0–2). */
    primaryPhotoIndex?: number | null;
    disciplineTags?: string[];
    sectorTags?: CaseStudySectorId[];
    disciplineTagsExplicit?: boolean;
    sectorTagsExplicit?: boolean;
    /** CON-062: an optional client quote and who said it, shown as an attributed pull quote on new proposals. */
    clientQuote?: string;
    clientQuoteAttribution?: string;
    /** CON-063: the challenge and its solution, kept as their own fields once kept; older entries may still hold both inside `whatWeDelivered`. */
    challenge?: string;
    solution?: string;
    /** CON-064: a numeric contract value with its VAT basis. Absent on older entries, whose free-text `contractValue` is shown as typed. */
    contractValueAmount?: number | null;
    contractValueVatBasis?: string;
}

/**
 * The older case-study editor. A save is confirmed only when storage still
 * holds what this tab last knew, or a list this tab sent itself; stale tabs
 * are refused rather than overwriting a newer list.
 */
export default function CaseStudiesClient({ initialCaseStudies, initialStoredFingerprint, userId, enhance = enhanceCaseStudyAction, save = saveCaseStudiesAction }: {
    initialCaseStudies: CaseStudy[];
    initialStoredFingerprint: string;
    userId: string;
    /** Defaults to the real server action; replaced only by tests and the fixture harness. */
    enhance?: Enhance;
    /** Defaults to the real server action; replaced only by tests and the fixture harness. */
    save?: Save;
}) {
    const [state, dispatch] = useReducer(
        saveReducer as Reducer<SaveState<CaseStudy>, SaveAction<CaseStudy>>,
        initialCaseStudies,
        (loaded) => initialSaveState(loaded, initialStoredFingerprint),
    );
    const caseStudies = state.draft;
    const isPending = state.saving !== null;
    const sentToken = useRef(0);
    /** Every change to the list goes through here: it changes what is on screen and nothing else. */
    const setCaseStudies = (change: (previous: CaseStudy[]) => CaseStudy[]) => dispatch({ type: "edit", change });
    // One handle per row on this page, in list order, changed only where a row is added or removed. A stored
    // `id` can be missing or shared, so it cannot say which row an upload was for. Handles are never saved.
    const rowHandles = useRef(initialCaseStudies.map((_, index) => index));
    const nextRowHandle = useRef(initialCaseStudies.length);
    /** The latest pick for each row and slot. A reply from an older pick for that slot is not used. */
    const latestPhotoPick = useRef(new Map<string, symbol>());
    /** Rows, by handle, with a challenge or how it was resolved typed but not yet added to "What We Delivered". */
    const [storyRows, setStoryRows] = useState<number[]>([]);

    // Reload, closing the tab and plain links ask first, also while a challenge is typed but not added. Navigation made by code, and Back and Forward, are not covered.
    useUnsavedGuard(needsLeaveWarning(state) || storyRows.length > 0, SAVE_MESSAGES.leaveConfirm);

    // Sends the save the rules started: exactly the copy they recorded, once, however often this runs or the button is pressed.
    useEffect(() => {
        const request = requestOf(state);
        if (!request || sentToken.current === request.token) return;
        sentToken.current = request.token;
        void (async () => {
            let result: SaveCaseStudiesResult;
            try {
                result = await save(
                    request.sent.map((entry) => legacyCaseStudyForSave(entry)),
                    request.expectedFingerprint,
                    // Earlier saves that were never answered, as they were sent: one of them may be what is stored now.
                    request.unconfirmed.map((sent) => sent.map((entry) => legacyCaseStudyForSave(entry))),
                );
            } catch {
                // The request itself failed. Whether it reached the server is not known.
                result = { status: "unknown", message: SAVE_MESSAGES.unknown };
            }
            dispatch({ type: "save/reply", token: request.token, result });
            // A success message only with evidence of a save.
            if (result.status === "saved") toast.success("Case studies saved");
        })();
    });

    const addCaseStudy = () => {
        rowHandles.current.push(nextRowHandle.current++);
        setCaseStudies(prev => [...prev, {
            id: crypto.randomUUID(),
            projectName: "",
            projectType: "",
            contractValue: "",
            programmeDuration: "",
            client: "",
            location: "",
            whatWeDelivered: "",
            valueAdded: "",
            photos: ["", "", ""],
            clientQuote: "",
            clientQuoteAttribution: "",
            challenge: "",
            solution: "",
        }]);
    };

    const updateCaseStudy = (index: number, field: keyof CaseStudy, value: string | string[] | CaseStudySectorId[] | boolean | number | null) => {
        setCaseStudies(prev => prev.map((cs, i) => {
            if (i !== index) return cs;
            const next = { ...cs, [field]: value } as CaseStudy;
            if (field === "disciplineTags") return { ...next, disciplineTagsExplicit: true };
            if (field === "sectorTags") return { ...next, sectorTagsExplicit: true };
            return next;
        }));
    };

    const removeCaseStudy = (index: number) => {
        const [removed] = rowHandles.current.splice(index, 1);
        setStoryRows(prev => prev.filter(handle => handle !== removed));
        setCaseStudies(prev => prev.filter((_, i) => i !== index));
    };

    /** Keeps the leave warning on while a row has a challenge or how it was resolved typed but not added. */
    const markStory = (index: number, typed: boolean) => {
        const handle = rowHandles.current[index];
        setStoryRows(prev => (typed ? (prev.includes(handle) ? prev : [...prev, handle]) : prev.filter(entry => entry !== handle)));
    };

    /** Asks the rules to start a save. They decide whether one starts; with nothing to save, nothing is sent. */
    const handleSave = () => dispatch({ type: "save/start" });
    const status = statusLine(state);
    const trouble = state.notice.kind === "failed" || state.notice.kind === "unknown" || state.uncertain;

    /** Resolves true only when the picture was put on the example. */
    const handlePhotoUpload = async (csIndex: number, slot: number, file: File): Promise<boolean> => {
        // Rows and photos can change while this waits, so the reply is placed from what is there when it arrives.
        const row = rowHandles.current[csIndex];
        const pickKey = `${row}:${slot}`;
        const pick = Symbol();
        latestPhotoPick.current.set(pickKey, pick);
        const formData = new FormData();
        formData.set("file", file);
        formData.set("purpose", "case-study");
        let result: Awaited<ReturnType<typeof uploadProfileImageAction>>;
        try {
            result = await uploadProfileImageAction(formData);
        } catch {
            // The request itself failed. Whether the file reached storage is not known; the photo has not been added.
            result = { error: "We couldn't confirm that photo uploaded, so it hasn't been added. Please try again." };
        }
        const rowIndex = rowHandles.current.indexOf(row);
        if (rowIndex === -1) {
            toast.error("That past work was removed, so its photo wasn't added.");
            return false;
        }
        if (latestPhotoPick.current.get(pickKey) !== pick) return false;
        const { url } = result;
        if (url) {
            setCaseStudies(prev => prev.map((cs, i) => {
                if (i !== rowIndex) return cs;
                const { active, legacyTail } = splitLegacyProfilePhotoUrls(cs.photos);
                const hadNone = active.every((entry) => entry.trim() === "");
                const nextActive = [...active] as [string, string, string];
                nextActive[slot] = url;
                return {
                    ...cs,
                    photos: mergeLegacyProfilePhotoUrls(nextActive, legacyTail),
                    primaryPhotoIndex: hadNone && cs.primaryPhotoIndex == null ? slot : cs.primaryPhotoIndex,
                };
            }));
            toast.success("Photo uploaded");
            return true;
        }
        toast.error(result.error || "Upload failed");
        return false;
    };

    /** Takes a photo off the screen copy only. The file stays in storage; a pick still on its way for this slot no longer counts. */
    const handlePhotoRemove = (csIndex: number, slot: number) => {
        latestPhotoPick.current.set(`${rowHandles.current[csIndex]}:${slot}`, Symbol());
        setCaseStudies(prev => prev.map((cs, i) => {
            if (i !== csIndex) return cs;
            const { active, legacyTail } = splitLegacyProfilePhotoUrls(cs.photos);
            const nextActive = [...active] as [string, string, string];
            nextActive[slot] = "";
            return { ...cs, photos: mergeLegacyProfilePhotoUrls(nextActive, legacyTail) };
        }));
    };

    const inputCls = `${coreProfileFieldBase} h-10 ${coreFocusRing}`;
    const labelCls = "text-xs font-medium text-slate-400 block mb-1";
    const editor = useRef<HTMLDivElement>(null);
    const previousCount = useRef(caseStudies.length);
    const focusedCard = useRef<number | null>(null);
    useEffect(() => {
        if (previousCount.current !== caseStudies.length && document.activeElement === document.body) {
            const cards = editor.current?.querySelectorAll<HTMLElement>("[data-past-work-card]");
            const index = caseStudies.length > previousCount.current ? caseStudies.length - 1 : Math.min(focusedCard.current ?? 0, caseStudies.length - 1);
            const target = index >= 0 ? cards?.[index]?.querySelector<HTMLElement>("[data-past-work-heading]")
                : editor.current?.querySelector<HTMLElement>("[data-add-example]");
            target?.focus();
        }
        previousCount.current = caseStudies.length;
    }, [caseStudies.length]);

    return (
        <div ref={editor} className={`${ui.editor} space-y-6`} onFocusCapture={(event) => {
            const index = event.target.closest<HTMLElement>("[data-work-index]")?.dataset.workIndex;
            focusedCard.current = index === undefined ? null : Number(index);
        }}>
            <datalist id="case-study-job-type-examples">
                {JOB_TYPE_EXAMPLES.map(type => <option key={type} value={type} />)}
            </datalist>
            {caseStudies.length === 0 && (
                <div className={ui.empty}>
                    <Briefcase className="w-10 h-10" aria-hidden />
                    <h2>Your next client hasn&apos;t seen your best work yet.</h2>
                    <p>Start with one past project. Explain the work and the difference you made.</p>
                    <button onClick={addCaseStudy} className={ui.primary}>
                        Add your first example
                    </button>
                </div>
            )}

            {caseStudies.map((cs, index) => (
                <CaseStudyCard
                    key={cs.id}
                    cs={cs}
                    index={index}
                    onChange={(field, value) => updateCaseStudy(index, field, value)}
                    onRemove={() => removeCaseStudy(index)}
                    onPhotoUpload={(slot, file) => handlePhotoUpload(index, slot, file)}
                    onPhotoRemove={(slot) => handlePhotoRemove(index, slot)}
                    onStoryTyped={(typed) => markStory(index, typed)}
                    inputCls={inputCls}
                    labelCls={labelCls}
                    enhance={enhance}
                />
            ))}

            <div className={ui.saveBar}>
                <button
                    onClick={addCaseStudy}
                    data-add-example
                    className={`flex items-center gap-2 text-sm font-semibold text-emerald-200 hover:text-emerald-100 bg-emerald-950/30 hover:bg-emerald-950/50 border border-emerald-600/40 rounded-lg px-4 py-2.5 transition-colors ${coreFocusVisibleRing}`}
                >
                    <Plus className="w-4 h-4" />
                    Add another example
                </button>

                <button
                    onClick={handleSave}
                    disabled={isPending}
                    className={ui.primary}
                >
                    {isPending ? "Saving..." : state.notice.kind === "failed" || state.notice.kind === "unknown" ? "Try again" : "Save all past work"}
                </button>
            </div>
            <p className={ui.saveNote}>Your changes stay on this page until you save. This button saves the whole list, not just the open example.</p>
            <p role="status" aria-live="polite" data-case-studies-save-status data-trouble={trouble} className={status ? ui.status : "sr-only"}>{status}</p>
        </div>
    );
}

function CaseStudyCard({
    cs,
    index,
    onChange,
    onRemove,
    onPhotoUpload,
    onPhotoRemove,
    onStoryTyped,
    inputCls,
    labelCls,
    enhance,
}: {
    enhance: Enhance;
    cs: CaseStudy;
    index: number;
    onChange: (field: keyof CaseStudy, value: string | string[] | CaseStudySectorId[] | boolean | number | null) => void;
    onRemove: () => void;
    onPhotoUpload: (slot: number, file: File) => Promise<boolean>;
    onPhotoRemove: (slot: number) => void;
    onStoryTyped: (typed: boolean) => void;
    inputCls: string;
    labelCls: string;
}) {
    const [expanded, setExpanded] = useState(true);
    const [enhancing, setEnhancing] = useState(false);
    const { active: activePhotoUrls, legacyTail } = splitLegacyProfilePhotoUrls(cs.photos);
    const legacyTailCount = legacyTailPhotoCount(cs.photos);
    const primarySlot = typeof cs.primaryPhotoIndex === "number" && cs.primaryPhotoIndex >= 0 && cs.primaryPhotoIndex < 3
        ? cs.primaryPhotoIndex
        : activePhotoUrls.findIndex((url) => url.trim() !== "") === -1 ? 0 : activePhotoUrls.findIndex((url) => url.trim() !== "");

    // Which slots have a picture on its way, so the slot says so until its reply is in. Never saved.
    const [uploading, setUploading] = useState<boolean[]>([false, false, false]);
    const [photoNote, setPhotoNote] = useState<string | null>(null);
    /** The latest pick for each slot on this card. Only its reply ends that slot's "uploading". */
    const latestPick = useRef<(symbol | null)[]>([null, null, null]);
    /** Content hashes for files placed on each slot this session. Never saved. */
    const slotHashes = useRef<(string | null)[]>([null, null, null]);
    const markUploading = (slot: number, on: boolean) => setUploading(prev => prev.map((value, i) => (i === slot ? on : value)));

    const pickPhoto = async (slot: number, input: HTMLInputElement) => {
        const file = input.files?.[0];
        // Cleared so choosing the same file again, after a failure for one, is still a change the browser reports.
        input.value = "";
        if (!file) return;
        // Refused here, in the words the upload would use, before anything is sent. A pick already on its way is left alone.
        const problem = publicImageProblem(file);
        if (problem) {
            toast.error(problem);
            return;
        }
        let hash: string;
        try {
            hash = await caseStudyPhotoContentHash(file);
        } catch {
            toast.error("That picture could not be checked, so it was not added.");
            return;
        }
        if (slotHashes.current.some((entry, index) => entry === hash && index !== slot)) {
            toast.error(CASE_STUDY_DUPLICATE_PHOTO_MESSAGE);
            return;
        }
        const pick = Symbol();
        latestPick.current[slot] = pick;
        slotHashes.current[slot] = hash;
        setPhotoNote(null);
        markUploading(slot, true);
        const added = await onPhotoUpload(slot, file);
        if (latestPick.current[slot] !== pick) return;
        markUploading(slot, false);
        if (!added) { slotHashes.current[slot] = null; return; }
    };

    const removePhoto = (slot: number) => {
        latestPick.current[slot] = null;
        slotHashes.current[slot] = null;
        markUploading(slot, false);
        setPhotoNote(null);
        onPhotoRemove(slot);
    };

    const makePrimary = (slot: number) => {
        if (!(activePhotoUrls[slot] ?? "").trim()) return;
        onChange("primaryPhotoIndex", slot);
    };

    const uploadingSlots = uploading.flatMap((on, slot) => (on ? [slot + 1] : []));
    const photoStatus = uploadingSlots.length > 0
        ? `Uploading ${uploadingSlots.length === 1 ? "photo" : "photos"} ${uploadingSlots.join(" and ")}…`
        : photoNote ?? "";

    // A reply is held here until the contractor decides. It never replaces what is in the form by arriving.
    const [pending, setPending] = useState<PendingCaseStudySuggestion | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    // A challenge and how it was resolved, as typed. Held by the card so closing it keeps them; kept
    // to the example's own fields only on an explicit press, then saved by the ordinary save.
    const savedStory: StoryNotes = { challenge: cs.challenge ?? "", response: cs.solution ?? "" };
    const [story, setStory] = useState<StoryNotes>(savedStory);
    const differsFromSaved = (next: StoryNotes): boolean => next.challenge !== savedStory.challenge || next.response !== savedStory.response;
    // The warning stays on while the boxes differ from what is saved, including
    // cleared boxes: an emptied story is still an unsaved change until it is kept.
    const changeStory = (next: StoryNotes) => { setStory(next); onStoryTyped(differsFromSaved(next)); };
    const tagSuggestions = exampleTagSuggestions({ projectType: cs.projectType, client: cs.client });

    const handleEnhance = async () => {
        // One request at a time: the button is disabled while this runs, and this guards a double press.
        if (enhancing) return;
        if (!cs.whatWeDelivered && !cs.valueAdded) return;
        if (!caseStudyTextEnhanceEnabled()) {
            setNotice(COHORT_AI_OFF);
            return;
        }
        // What the suggestion will have been written from, in case the contractor edits while it is on its way.
        const askedFrom: Record<CaseStudySection, string> = { whatWeDelivered: cs.whatWeDelivered, valueAdded: cs.valueAdded };
        setEnhancing(true);
        setNotice(null);
        setPending(null);
        try {
            const result = await enhance(askedFrom.whatWeDelivered, askedFrom.valueAdded, cs.projectName, cs.projectType);
            const next = pendingFrom(result, askedFrom);
            setPending(next);
            // A suggestion is shown beside the text it is about, so that part of the card must be open.
            if (next) setExpanded(true);
            if (!result.suggested) setNotice(result.message ?? "The assistant isn't available right now. Nothing has been changed.");
            else if (!next) setNotice("The assistant had nothing to change. Your wording is as it was.");
            else setNotice("Suggested wording is shown below. Nothing changes unless you choose to use it.");
        } catch {
            setNotice("The assistant isn't available right now. Nothing has been changed.");
        }
        setEnhancing(false);
    };

    const suggestionPanel = (section: CaseStudySection, label: string) => {
        const state = sectionState(pending, section, cs[section]);
        if (state === "none" || !pending) return null;
        const suggestion = pending.suggestions[section] ?? "";
        return (
            <div data-case-study-suggestion={section} data-state={state} role="group" aria-label={`Suggested wording for ${label}`} className="mt-2 rounded-lg border border-dashed border-violet-300 bg-violet-950 p-3 space-y-2">
                <p className="text-xs font-semibold text-violet-100">
                    Suggested wording. Check it says only what you wrote. Nothing changes unless you use it.
                </p>
                {state === "stale" && (
                    <p className="text-xs font-semibold text-amber-200">
                        You have changed this since you asked. The suggestion was written from your earlier wording, not what is in the box now.
                    </p>
                )}
                <p className="text-sm text-slate-100 whitespace-pre-wrap break-words">{suggestion}</p>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => { onChange(section, suggestion); setPending(settle(pending, section)); }} className={`${coreSuggestionPrimary} ${coreFocusVisibleRing}`}>
                        {state === "stale" ? "Replace what I have now with this" : "Use this wording"}
                    </button>
                    <button type="button" onClick={() => setPending(settle(pending, section))} className="min-h-11 px-3 rounded-lg border border-slate-400 text-sm font-semibold text-slate-100 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                        Keep my own
                    </button>
                </div>
            </div>
        );
    };

    const fieldId = useId();

    return (
        <div className={ui.card} data-past-work-card data-work-index={index}>
            {/* Header */}
            <div className={ui.cardHeader}>
                <h2 className={ui.cardTitle} data-past-work-heading tabIndex={-1}>
                    <span>Past work {index + 1}</span>
                    {cs.projectName && <span className="text-sm font-semibold">{cs.projectName}</span>}
                </h2>
                <div className={ui.cardActions}>
                    {(cs.whatWeDelivered || cs.valueAdded) && (
                        <button
                            onClick={handleEnhance}
                            disabled={enhancing || !caseStudyTextEnhanceEnabled()}
                            className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-purple-700 bg-purple-900/30 text-purple-50 hover:bg-purple-800/40 text-xs font-bold transition-colors disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        >
                            {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            {enhancing ? "Enhancing..." : caseStudyTextEnhanceEnabled() ? "AI Enhance" : "AI Enhance (not available yet)"}
                        </button>
                    )}
                    <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={`${fieldId}-fields`} aria-label={`${expanded ? "Collapse" : "Expand"} past work ${index + 1}`}>
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={onRemove} aria-label={`Remove past work ${index + 1}`} className={ui.danger}>
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Says what happened to a request for wording. Never a success unless there is a suggestion to look at. */}
            <p data-case-study-notice role="status" aria-live="polite" className={notice ? "px-5 py-3 text-sm font-semibold text-slate-100 bg-slate-950 border-b border-slate-700" : "sr-only"}>
                {notice ?? ""}
            </p>

            {expanded && (
                <div id={`${fieldId}-fields`} className="p-5 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor={`${fieldId}-name`} className={labelCls}>Project Name</label>
                            <input id={`${fieldId}-name`} className={inputCls} value={cs.projectName} onChange={e => onChange("projectName", e.target.value)} placeholder="e.g. Smith Residence Extension" />
                        </div>
                        <div>
                            <label htmlFor={`${fieldId}-type`} className={labelCls}>Project Type</label>
                            <input id={`${fieldId}-type`} className={inputCls} list="case-study-job-type-examples" value={cs.projectType} onChange={e => onChange("projectType", e.target.value)} placeholder="Not sure yet" />
                        </div>
                        <div>
                            <label htmlFor={`${fieldId}-value`} className={labelCls}>Contract Value</label>
                            {cs.contractValueAmount != null ? (
                                <div className="flex gap-2">
                                    <input
                                        id={`${fieldId}-value`}
                                        type="number"
                                        inputMode="decimal"
                                        min="0"
                                        step="any"
                                        className={inputCls}
                                        value={cs.contractValueAmount}
                                        onChange={e => {
                                            const next = e.target.value === "" ? null : Number(e.target.value);
                                            onChange("contractValueAmount", next !== null && (!Number.isFinite(next) || next < 0) ? null : next);
                                        }}
                                        placeholder="85000"
                                        aria-label="Contract Value"
                                    />
                                    <select
                                        id={`${fieldId}-value-vat`}
                                        className={inputCls}
                                        value={cs.contractValueVatBasis ?? "ex_vat"}
                                        onChange={e => onChange("contractValueVatBasis", e.target.value)}
                                        aria-label="VAT basis"
                                    >
                                        <option value="ex_vat">ex VAT</option>
                                        <option value="inc_vat">inc VAT</option>
                                    </select>
                                </div>
                            ) : (
                                <>
                                    <input id={`${fieldId}-value`} className={inputCls} value={cs.contractValue} onChange={e => onChange("contractValue", e.target.value)} placeholder="e.g. £85,000" />
                                    {typedValueAmount(cs.contractValue) !== null && (
                                        // A plain figure can be kept as a number with its VAT basis, and prints
                                        // like the proposal's other figures. The typed words stay on the record.
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onChange("contractValueAmount", typedValueAmount(cs.contractValue));
                                                onChange("contractValueVatBasis", "ex_vat");
                                            }}
                                            className={`mt-1 min-h-11 px-3 rounded-lg border border-slate-400 text-sm font-semibold text-slate-100 hover:bg-white/5 ${coreFocusVisibleRing}`}
                                        >
                                            Keep as exact figure with VAT basis
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                        <div>
                            <label htmlFor={`${fieldId}-duration`} className={labelCls}>Programme Duration</label>
                            <input id={`${fieldId}-duration`} className={inputCls} value={cs.programmeDuration} onChange={e => onChange("programmeDuration", e.target.value)} placeholder="e.g. 12 weeks" />
                        </div>
                        <div>
                            <label htmlFor={`${fieldId}-client`} className={labelCls}>Client Name</label>
                            <input id={`${fieldId}-client`} className={inputCls} value={cs.client} onChange={e => onChange("client", e.target.value)} placeholder="e.g. Mr & Mrs Smith" />
                        </div>
                        <div>
                            <label htmlFor={`${fieldId}-location`} className={labelCls}>Location</label>
                            <input id={`${fieldId}-location`} className={inputCls} value={cs.location} onChange={e => onChange("location", e.target.value)} placeholder="e.g. Surrey" />
                        </div>
                    </div>

                    <ExampleTagsSection
                        idPrefix={fieldId}
                        labelCls={labelCls}
                        disciplineTags={cs.disciplineTags ?? []}
                        sectorTags={cs.sectorTags ?? []}
                        suggestedDisciplines={tagSuggestions.disciplineTags}
                        suggestedSectors={tagSuggestions.sectorTags}
                        onDisciplines={(next) => onChange("disciplineTags", next)}
                        onSectors={(next) => onChange("sectorTags", next)}
                    />

                    <div>
                        <label htmlFor={`${fieldId}-delivered`} className={labelCls}>What We Delivered</label>
                        <textarea
                            id={`${fieldId}-delivered`}
                            className={coreProfileTextarea}
                            rows={3}
                            aria-label="What We Delivered"
                            value={cs.whatWeDelivered}
                            onChange={e => onChange("whatWeDelivered", e.target.value)}
                            placeholder="The work you carried out, in your own words. A few lines is plenty."
                        />
                        {suggestionPanel("whatWeDelivered", "What We Delivered")}
                    </div>

                    <ChallengeResolution
                        text={cs.whatWeDelivered ?? ""}
                        notes={story}
                        onNotes={changeStory}
                        onAdd={next => onChange("whatWeDelivered", next)}
                        onAddToRecord={next => {
                            onChange("challenge", next.challenge);
                            onChange("solution", next.response);
                            onStoryTyped(false);
                        }}
                        savedNotes={savedStory}
                        idPrefix={fieldId}
                        target="What We Delivered"
                        labelCls={labelCls}
                        inputCls={coreProfileTextarea}
                        hintCls="text-xs text-slate-300"
                        buttonCls={`min-h-11 px-3 rounded-lg border border-slate-400 text-sm font-semibold text-slate-100 hover:bg-white/5 ${coreFocusVisibleRing}`}
                    />

                    <div>
                        <label htmlFor={`${fieldId}-quote`} className={labelCls}>What did the client say? <span className="font-normal text-slate-300">(optional)</span></label>
                        <textarea
                            id={`${fieldId}-quote`}
                            className={coreProfileTextarea}
                            rows={2}
                            maxLength={1000}
                            aria-label="What did the client say?"
                            value={cs.clientQuote ?? ""}
                            onChange={e => onChange("clientQuote", e.target.value)}
                            placeholder="A line or two in the client's own words. Only quote what they actually said."
                        />
                    </div>
                    <div>
                        <label htmlFor={`${fieldId}-quote-by`} className={labelCls}>Who said it <span className="font-normal text-slate-300">(optional)</span></label>
                        <input id={`${fieldId}-quote-by`} className={inputCls} maxLength={200} value={cs.clientQuoteAttribution ?? ""} onChange={e => onChange("clientQuoteAttribution", e.target.value)} placeholder="e.g. Mrs Smith" />
                    </div>

                    <div>
                        <label htmlFor={`${fieldId}-added`} className={labelCls}>Value Added</label>
                        <textarea
                            id={`${fieldId}-added`}
                            className={coreProfileTextarea}
                            rows={3}
                            aria-label="Value Added"
                            value={cs.valueAdded}
                            onChange={e => onChange("valueAdded", e.target.value)}
                            placeholder="What it meant for the client, if you know. Only what actually happened."
                        />
                        {suggestionPanel("valueAdded", "Value Added")}
                    </div>

                    {/* Photos */}
                    <div>
                        <label className={labelCls}>{`Photos (up to 3. ${PUBLIC_IMAGE_LIMITS_HINT})`}</label>
                        <div className={ui.photos}>
                            {[0, 1, 2].map(slot => (
                                <div key={slot} className={`${ui.photoSlot} border rounded-lg overflow-hidden relative group`}>
                                    {(activePhotoUrls[slot] ?? "").trim() ? (
                                        <>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={activePhotoUrls[slot]} alt={`Photo ${slot + 1}`} className="w-full h-full object-cover" />
                                            {primarySlot === slot && (
                                                <span className="absolute top-1 left-1 z-10 rounded bg-emerald-900/90 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-100">{CASE_STUDY_PRIMARY_LABEL}</span>
                                            )}
                                            {primarySlot !== slot && (
                                                <button type="button" onClick={() => makePrimary(slot)} className={`absolute top-1 left-1 z-10 min-h-8 px-2 rounded-lg bg-black/70 text-[10px] font-semibold text-white hover:bg-black ${coreFocusVisibleRing}`}>
                                                    Use as main
                                                </button>
                                            )}
                                            <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                                <Upload className="w-5 h-5 text-white" />
                                                <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Replace photo ${slot + 1} for past work ${index + 1}`} className="sr-only" onChange={e => pickPhoto(slot, e.target)} />
                                            </label>
                                            <button type="button" aria-label={`Remove photo ${slot + 1} for past work ${index + 1}`} onClick={() => removePhoto(slot)} className={`absolute top-1 right-1 z-10 flex h-11 w-11 items-center justify-center rounded-lg bg-black/70 text-white hover:bg-black ${coreFocusVisibleRing}`}>
                                                <Trash2 className="w-4 h-4" aria-hidden />
                                            </button>
                                        </>
                                    ) : (
                                        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-slate-700 transition-colors">
                                            <Upload className="w-5 h-5 text-slate-500 mb-1" />
                                            <span className="text-[10px] text-slate-500">Upload</span>
                                            <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Upload photo ${slot + 1} for past work ${index + 1}`} className="sr-only" onChange={e => pickPhoto(slot, e.target)} />
                                        </label>
                                    )}
                                    {uploading[slot] && (
                                        // Shown over the slot, without blocking it: a newer pick or a removal still works, and the latest one stands.
                                        <div data-photo-uploading={slot + 1} aria-hidden className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/70 text-xs font-semibold text-white pointer-events-none">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Uploading…
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {/* Says a picture is on its way, or that the same picture was added twice. A failure is said where failures already are. */}
                        <p data-photo-status role="status" aria-live="polite" className={photoStatus ? "mt-2 text-xs font-semibold text-slate-200" : "sr-only"}>{photoStatus}</p>
                        {legacyTailCount > 0 && (
                            <div data-legacy-photos className="mt-3 space-y-2">
                                <p className="text-xs font-semibold text-slate-300">Older saved pictures (kept after your three active slots)</p>
                                <div className={`${ui.photos} opacity-90`}>
                                    {legacyTail.map((url, legacyIndex) => (
                                        <div key={`${legacyIndex}-${url}`} className={`${ui.photoSlot} border border-slate-600 rounded-lg overflow-hidden`}>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={url} alt={`Older saved photo ${legacyIndex + 1}`} className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
