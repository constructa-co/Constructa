/**
 * Guided Brief.
 *
 * Everything the Brief screen decides lives here as plain functions so it can
 * be tested without a browser:
 *
 *  - the contractor's draft and the last version the server confirmed;
 *  - AI output, which is held as a pending suggestion and never touches the
 *    draft until the contractor applies it;
 *  - the save state, and the rule that Estimating is only opened after a
 *    confirmed save.
 */

export const BRIEF_TRADES: readonly string[] = [
    "Site Setup & Preliminaries", "Demolition & Strip Out", "Asbestos Removal",
    "Temporary Works / Propping / Shoring", "Groundworks & Civils", "Drainage",
    "Utilities – Water", "Utilities – Gas", "Utilities – Electric / Ducting",
    "Utilities – Telecoms / Data Ducting", "Attenuation / SuDS / Stormwater",
    "Piling", "Underpinning & Structural Stabilisation", "Concrete / RC Works",
    "Steel Frame / Steel Erection", "Structural Timber / Framing",
    "Masonry / Brickwork / Blockwork", "Cladding & Rainscreen", "Roofing",
    "Waterproofing", "Insulation", "Windows, Doors & Glazing",
    "Builders / General Building", "Landscaping & External Works",
    "Surfacing, Paving & Kerbing", "Fencing & Gates",
    "Swimming Pools & Water Features", "Signage", "Line Marking & Road Furniture",
    "External Lighting", "Domestic Electrical", "Commercial Electrical",
    "Industrial Electrical", "EV Chargers", "Street Electrical / Feeder Pillars",
    "Substations", "Domestic Plumbing", "Commercial Plumbing / Public Health",
    "Mechanical / HVAC", "Domestic Heating", "Air Conditioning / Refrigeration",
    "Fire Alarm & Life Safety", "Security / CCTV / Access Control",
    "Drylining & Partitions", "Plastering & Rendering", "Carpentry & Joinery",
    "Kitchen Installation", "Bathroom Installation", "Tiling", "Flooring",
    "Ceilings", "Painting & Decorating", "Fire Stopping",
    "Passive Fire Protection / Intumescent", "Diamond Drilling & Sawing",
    "Builderswork in Connection", "Specialist Finishes", "Waste Management / Logistics",
    "Scaffolding & Access",
];

// ── Stages ───────────────────────────────────────────────────────────────────

export const BRIEF_STAGES = [
    { key: "client", short: "The job", title: "What does the client want?" },
    { key: "work", short: "Work included", title: "What work is included?" },
    { key: "site", short: "Site and assumptions", title: "Anything about the site we should know?" },
    { key: "review", short: "Review", title: "Review and confirm" },
] as const;

export type BriefStageKey = (typeof BRIEF_STAGES)[number]["key"];

export function stageIndex(stage: BriefStageKey): number {
    return BRIEF_STAGES.findIndex((s) => s.key === stage);
}

export function adjacentStage(stage: BriefStageKey, direction: 1 | -1): BriefStageKey {
    const next = Math.min(BRIEF_STAGES.length - 1, Math.max(0, stageIndex(stage) + direction));
    return BRIEF_STAGES[next].key;
}

// ── Draft ────────────────────────────────────────────────────────────────────

export type ClientType = "domestic" | "commercial" | "public";
export const CLIENT_TYPES: readonly ClientType[] = ["domestic", "commercial", "public"];

export interface BriefDraft {
    /** What the client wants, in the contractor's words. */
    work: string;
    /** Site, access and assumption notes. Saved inside the scope text. */
    siteNotes: string;
    clientType: ClientType;
    trades: string[];
    /** Rough value exactly as typed; parsed only when saving. */
    roughValue: string;
    startDate: string;
    lat: number | null;
    lng: number | null;
    region: string;
}

/**
 * The scope is stored in one column. Site notes are kept under this heading
 * inside it so they survive a reload without a schema change, and so they
 * read sensibly wherever the scope text is shown.
 */
export const SITE_NOTES_HEADING = "Site, access and assumptions:";

const SITE_NOTES_PATTERN = /(?:^|\n\n)Site, access and assumptions:\n/;

export function composeScope(work: string, siteNotes: string): string {
    const w = work.trim();
    const n = siteNotes.trim();
    if (!n) return w;
    return w ? `${w}\n\n${SITE_NOTES_HEADING}\n${n}` : `${SITE_NOTES_HEADING}\n${n}`;
}

export function splitScope(scope: string): { work: string; siteNotes: string } {
    const text = scope ?? "";
    const match = SITE_NOTES_PATTERN.exec(text);
    if (!match) return { work: text, siteNotes: "" };
    return {
        work: text.slice(0, match.index),
        siteNotes: text.slice(match.index + match[0].length),
    };
}

export interface BriefProjectFields {
    brief_scope: string;
    brief_trade_sections: string[];
    client_type: string;
    potential_value: number | null;
    start_date: string;
    lat: number | null;
    lng: number | null;
    region: string;
    brief_completed: boolean;
}

function asClientType(value: unknown): ClientType | null {
    return CLIENT_TYPES.includes(value as ClientType) ? (value as ClientType) : null;
}

/** Builds the draft from what the project already holds. Nothing is cleared. */
export function draftFromProject(project: BriefProjectFields): BriefDraft {
    const { work, siteNotes } = splitScope(project.brief_scope || "");
    return {
        work,
        siteNotes,
        clientType: asClientType(project.client_type) ?? "domestic",
        trades: [...(project.brief_trade_sections || [])],
        roughValue: project.potential_value ? String(project.potential_value) : "",
        startDate: project.start_date || "",
        lat: project.lat,
        lng: project.lng,
        region: project.region || "",
    };
}

export function draftsEqual(a: BriefDraft, b: BriefDraft): boolean {
    return (
        a.work === b.work &&
        a.siteNotes === b.siteNotes &&
        a.clientType === b.clientType &&
        a.roughValue === b.roughValue &&
        a.startDate === b.startDate &&
        a.lat === b.lat &&
        a.lng === b.lng &&
        a.region === b.region &&
        a.trades.length === b.trades.length &&
        a.trades.every((t, i) => t === b.trades[i])
    );
}

// ── Save payload ─────────────────────────────────────────────────────────────

export interface BriefSavePayload {
    brief_scope: string;
    brief_trade_sections: string[];
    client_type: ClientType;
    lat?: number;
    lng?: number;
    region?: string;
    brief_completed: boolean;
    potential_value: number | null;
    start_date: string | null;
}

export const MAX_SCOPE_LENGTH = 20_000;
export const MAX_ROUGH_VALUE = 100_000_000;

/** Plain digits with an optional pence part. No exponent, sign or hex forms. */
export function parseRoughValue(raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
    const cleaned = raw.trim().replace(/[£,\s]/g, "");
    if (!cleaned) return { ok: true, value: null };
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
        return { ok: false, error: "Enter the rough value as a number, for example 45000." };
    }
    const value = Number(cleaned);
    if (value > MAX_ROUGH_VALUE) return { ok: false, error: "That value is too large." };
    return { ok: true, value };
}

export type BriefPayloadResult =
    | { ok: true; payload: BriefSavePayload }
    | { ok: false; error: string; stage: BriefStageKey };

export function buildBriefPayload(draft: BriefDraft, completed: boolean): BriefPayloadResult {
    const scope = composeScope(draft.work, draft.siteNotes);
    if (scope.length > MAX_SCOPE_LENGTH) {
        return { ok: false, stage: "client", error: "The description is too long to save. Shorten it and try again." };
    }
    const value = parseRoughValue(draft.roughValue);
    if (!value.ok) return { ok: false, stage: "site", error: value.error };
    if (draft.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(draft.startDate)) {
        return { ok: false, stage: "site", error: "Choose the start date from the calendar." };
    }

    const payload: BriefSavePayload = {
        brief_scope: scope,
        brief_trade_sections: draft.trades,
        client_type: draft.clientType,
        brief_completed: completed,
        potential_value: value.value,
        start_date: draft.startDate || null,
    };
    if (draft.lat !== null && draft.lng !== null) {
        payload.lat = draft.lat;
        payload.lng = draft.lng;
    }
    if (draft.region) payload.region = draft.region;
    return { ok: true, payload };
}

// ── AI suggestion ────────────────────────────────────────────────────────────

/** The untrusted shape that comes back from the assistant or a video analysis. */
export interface RawBriefSuggestion {
    scope?: unknown;
    clientType?: unknown;
    suggestedTrades?: unknown;
    estimatedValue?: unknown;
    startDate?: unknown;
    response?: unknown;
    observations?: unknown;
}

export type SuggestionPart = "work" | "trades" | "clientType" | "roughValue" | "startDate" | "siteNotes";

export interface BriefSuggestion {
    id: string;
    source: "assistant" | "video";
    /** The description the suggestion was written from. */
    basedOnWork: string;
    work: string | null;
    trades: string[];
    clientType: ClientType | null;
    roughValue: number | null;
    startDate: string | null;
    /** Site observations (video only), offered as site notes. */
    siteNotes: string | null;
    note: string | null;
}

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * Turns raw AI output into a suggestion the contractor can review.
 *
 * Anything that is not on the trade list, is malformed, or repeats what the
 * draft already says is dropped. A value is only offered when the contractor's
 * own description contains a figure: the assistant may repeat a price, never
 * supply one. Video analysis cannot meet that test, so it never offers a value.
 */
export function suggestionFromRaw(
    raw: RawBriefSuggestion,
    context: { id: string; source: "assistant" | "video"; basedOnWork: string; draft: BriefDraft },
): BriefSuggestion {
    const { draft } = context;

    const work = str(raw.scope).slice(0, MAX_SCOPE_LENGTH);
    const trades = Array.isArray(raw.suggestedTrades)
        ? Array.from(new Set(raw.suggestedTrades.filter((t): t is string => typeof t === "string")))
            .filter((t) => BRIEF_TRADES.includes(t) && !draft.trades.includes(t))
        : [];
    const clientType = asClientType(raw.clientType);

    const value = typeof raw.estimatedValue === "number" && Number.isFinite(raw.estimatedValue)
        ? Math.round(raw.estimatedValue * 100) / 100
        : 0;
    const contractorGaveAFigure = context.source === "assistant" && /\d/.test(context.basedOnWork);
    const roughValue = contractorGaveAFigure && value > 0 && value <= MAX_ROUGH_VALUE
        && String(value) !== draft.roughValue.trim()
        ? value
        : null;

    const date = str(raw.startDate);
    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && date !== draft.startDate
        ? date
        : null;

    const observations = Array.isArray(raw.observations)
        ? raw.observations.filter((o): o is string => typeof o === "string" && o.trim() !== "").map((o) => o.trim())
        : [];

    return {
        id: context.id,
        source: context.source,
        basedOnWork: context.basedOnWork,
        work: work && work !== draft.work.trim() ? work : null,
        trades,
        clientType: clientType && clientType !== draft.clientType ? clientType : null,
        roughValue,
        startDate,
        siteNotes: observations.length > 0 ? observations.map((o) => `- ${o}`).join("\n") : null,
        note: str(raw.response) || null,
    };
}

export function suggestionParts(suggestion: BriefSuggestion): SuggestionPart[] {
    const parts: SuggestionPart[] = [];
    if (suggestion.work) parts.push("work");
    if (suggestion.trades.length > 0) parts.push("trades");
    if (suggestion.siteNotes) parts.push("siteNotes");
    if (suggestion.clientType) parts.push("clientType");
    if (suggestion.roughValue !== null) parts.push("roughValue");
    if (suggestion.startDate) parts.push("startDate");
    return parts;
}

/**
 * True when the contractor has changed their description since the suggestion
 * was requested. The suggested wording was written from the older text.
 */
export function isSuggestionStale(suggestion: BriefSuggestion, draft: BriefDraft): boolean {
    return suggestion.source === "assistant" && suggestion.basedOnWork.trim() !== draft.work.trim();
}

// ── State ────────────────────────────────────────────────────────────────────

export const AI_UNAVAILABLE_ERROR =
    "The assistant isn't available right now. You can carry on and write the brief yourself, or try again.";
export const BRIEF_SAVE_ERROR =
    "We couldn't save the brief. Everything you typed is still here. Check your connection and try again.";
export const DESCRIPTION_NEEDED_ERROR = "Describe the work before you confirm the brief.";

export interface BriefState {
    stage: BriefStageKey;
    draft: BriefDraft;
    /** The last draft the server confirmed. */
    saved: BriefDraft;
    savedCompleted: boolean;
    /** True once the project holds a saved brief, now or from an earlier visit. */
    hasSavedBrief: boolean;
    save: { status: "idle" | "saving" | "failed"; error: string | null };
    ai: { status: "idle" | "loading" | "failed"; requestId: string | null; error: string | null };
    suggestion: BriefSuggestion | null;
    lastOutcome: "applied" | "discarded" | null;
}

export function initialBriefState(project: BriefProjectFields): BriefState {
    const draft = draftFromProject(project);
    return {
        stage: "client",
        draft,
        saved: draft,
        savedCompleted: project.brief_completed,
        hasSavedBrief: project.brief_completed || (project.brief_scope || "").trim() !== "",
        save: { status: "idle", error: null },
        ai: { status: "idle", requestId: null, error: null },
        suggestion: null,
        lastOutcome: null,
    };
}

export type BriefAction =
    | { type: "stage/set"; stage: BriefStageKey }
    | { type: "draft/edit"; patch: Partial<BriefDraft> }
    | { type: "draft/toggleTrade"; trade: string }
    | { type: "ai/started"; requestId: string }
    | { type: "ai/succeeded"; requestId: string; suggestion: BriefSuggestion }
    | { type: "ai/failed"; requestId: string; error: string }
    | { type: "ai/cancelled" }
    | { type: "suggestion/received"; suggestion: BriefSuggestion }
    | { type: "suggestion/applied"; parts: SuggestionPart[]; replaceNewerWork?: boolean }
    | { type: "suggestion/discarded" }
    | { type: "save/started" }
    | { type: "save/succeeded"; snapshot: BriefDraft; completed: boolean }
    | { type: "save/failed"; error: string };

function applySuggestion(draft: BriefDraft, suggestion: BriefSuggestion, parts: SuggestionPart[]): BriefDraft {
    const next = { ...draft };
    for (const part of parts) {
        if (part === "work" && suggestion.work) next.work = suggestion.work;
        if (part === "trades") next.trades = Array.from(new Set([...next.trades, ...suggestion.trades]));
        if (part === "clientType" && suggestion.clientType) next.clientType = suggestion.clientType;
        if (part === "roughValue" && suggestion.roughValue !== null) next.roughValue = String(suggestion.roughValue);
        if (part === "startDate" && suggestion.startDate) next.startDate = suggestion.startDate;
        if (part === "siteNotes" && suggestion.siteNotes) {
            next.siteNotes = next.siteNotes.trim()
                ? `${next.siteNotes.trim()}\n${suggestion.siteNotes}`
                : suggestion.siteNotes;
        }
    }
    return next;
}

export function briefReducer(state: BriefState, action: BriefAction): BriefState {
    switch (action.type) {
        case "stage/set":
            return { ...state, stage: action.stage };

        case "draft/edit":
            return { ...state, draft: { ...state.draft, ...action.patch } };

        case "draft/toggleTrade": {
            const selected = state.draft.trades.includes(action.trade);
            const trades = selected
                ? state.draft.trades.filter((t) => t !== action.trade)
                : [...state.draft.trades, action.trade];
            return { ...state, draft: { ...state.draft, trades } };
        }

        case "ai/started":
            // One request at a time, and not while a suggestion is waiting to
            // be applied or discarded.
            if (state.ai.status === "loading" || state.suggestion) return state;
            return { ...state, ai: { status: "loading", requestId: action.requestId, error: null }, lastOutcome: null };

        case "ai/succeeded":
            // A reply to anything but the current request is out of date.
            if (state.ai.status !== "loading" || state.ai.requestId !== action.requestId) return state;
            return { ...state, ai: { status: "idle", requestId: null, error: null }, suggestion: action.suggestion };

        case "ai/failed":
            if (state.ai.status !== "loading" || state.ai.requestId !== action.requestId) return state;
            return { ...state, ai: { status: "failed", requestId: null, error: action.error } };

        case "ai/cancelled":
            return { ...state, ai: { status: "idle", requestId: null, error: null } };

        case "suggestion/received":
            return { ...state, suggestion: action.suggestion, lastOutcome: null };

        case "suggestion/applied": {
            if (!state.suggestion) return state;
            const stale = isSuggestionStale(state.suggestion, state.draft);
            const available = suggestionParts(state.suggestion);
            const parts = action.parts.filter(
                (part) => available.includes(part) && !(part === "work" && stale && !action.replaceNewerWork),
            );
            return {
                ...state,
                draft: applySuggestion(state.draft, state.suggestion, parts),
                suggestion: null,
                lastOutcome: parts.length > 0 ? "applied" : "discarded",
            };
        }

        case "suggestion/discarded":
            if (!state.suggestion) return state;
            return { ...state, suggestion: null, lastOutcome: "discarded" };

        case "save/started":
            if (state.save.status === "saving") return state;
            return { ...state, save: { status: "saving", error: null } };

        case "save/succeeded":
            return {
                ...state,
                saved: action.snapshot,
                savedCompleted: action.completed,
                hasSavedBrief: true,
                save: { status: "idle", error: null },
            };

        case "save/failed":
            return { ...state, save: { status: "failed", error: action.error } };
    }
}

// ── Derived save status ──────────────────────────────────────────────────────

export type BriefSaveStatus = "empty" | "unsaved" | "saving" | "saved" | "failed";

export function isDirty(state: BriefState): boolean {
    return !draftsEqual(state.draft, state.saved);
}

export function briefSaveStatus(state: BriefState): BriefSaveStatus {
    if (state.save.status === "saving") return "saving";
    if (state.save.status === "failed") return "failed";
    if (isDirty(state)) return "unsaved";
    return state.hasSavedBrief ? "saved" : "empty";
}

export const SAVE_STATUS_LABEL: Record<BriefSaveStatus, string> = {
    empty: "Nothing to save yet",
    unsaved: "Unsaved",
    saving: "Saving",
    saved: "Saved",
    failed: "Failed - try again",
};

/** True only when the server holds exactly what is on screen, confirmed. */
export function isBriefConfirmed(state: BriefState): boolean {
    return state.save.status === "idle" && state.savedCompleted && !isDirty(state);
}

// ── Controllers ──────────────────────────────────────────────────────────────

export interface BriefStore {
    getState: () => BriefState;
    dispatch: (action: BriefAction) => void;
}

export type AskAssistant = (work: string) => Promise<{ ok: true; result: RawBriefSuggestion } | { ok: false; error: string }>;
export type SaveBrief = (payload: BriefSavePayload) => Promise<{ success: true } | { success: false; error: string }>;

/** Asks the assistant about the current description. Never changes the draft. */
export async function requestSuggestion(store: BriefStore, ask: AskAssistant, requestId: string): Promise<void> {
    const before = store.getState();
    const work = before.draft.work.trim();
    if (!work || before.ai.status === "loading" || before.suggestion) return;

    store.dispatch({ type: "ai/started", requestId });
    try {
        const reply = await ask(work);
        if (!reply.ok) {
            store.dispatch({ type: "ai/failed", requestId, error: reply.error || AI_UNAVAILABLE_ERROR });
            return;
        }
        store.dispatch({
            type: "ai/succeeded",
            requestId,
            suggestion: suggestionFromRaw(reply.result, {
                id: requestId,
                source: "assistant",
                basedOnWork: work,
                draft: store.getState().draft,
            }),
        });
    } catch {
        store.dispatch({ type: "ai/failed", requestId, error: AI_UNAVAILABLE_ERROR });
    }
}

export type SaveOutcome = "saved" | "failed" | "invalid" | "busy";

/**
 * Saves the draft as it stands. `confirm` marks the brief as confirmed; a
 * plain save keeps whatever the project already says. The draft is never
 * cleared or replaced by a failed save.
 */
export async function saveBrief(store: BriefStore, save: SaveBrief, options: { confirm: boolean }): Promise<SaveOutcome> {
    const state = store.getState();
    if (state.save.status === "saving") return "busy";

    if (options.confirm && !state.draft.work.trim()) {
        store.dispatch({ type: "stage/set", stage: "client" });
        store.dispatch({ type: "save/failed", error: DESCRIPTION_NEEDED_ERROR });
        return "invalid";
    }

    const completed = options.confirm || state.savedCompleted;
    const built = buildBriefPayload(state.draft, completed);
    if (!built.ok) {
        store.dispatch({ type: "stage/set", stage: built.stage });
        store.dispatch({ type: "save/failed", error: built.error });
        return "invalid";
    }

    const snapshot = state.draft;
    store.dispatch({ type: "save/started" });
    try {
        const result = await save(built.payload);
        if (result.success) {
            store.dispatch({ type: "save/succeeded", snapshot, completed });
            return "saved";
        }
        store.dispatch({ type: "save/failed", error: result.error || BRIEF_SAVE_ERROR });
        return "failed";
    } catch {
        store.dispatch({ type: "save/failed", error: BRIEF_SAVE_ERROR });
        return "failed";
    }
}

/**
 * "Build the price". Estimating is opened only when the server has confirmed
 * exactly what is on screen. Anything unsaved is saved first; if that save
 * does not succeed the contractor stays on the Brief with their inputs.
 */
export async function continueToPricing(
    store: BriefStore,
    save: SaveBrief,
    navigate: () => void,
): Promise<"navigated" | SaveOutcome> {
    if (!isBriefConfirmed(store.getState())) {
        const outcome = await saveBrief(store, save, { confirm: true });
        if (outcome !== "saved") return outcome;
        // Typing during the save leaves newer text unsaved: stay and say so.
        if (!isBriefConfirmed(store.getState())) return "busy";
    }
    navigate();
    return "navigated";
}

export function pricingPathForProject(projectId: string): string {
    return `/dashboard/projects/costs?projectId=${encodeURIComponent(projectId)}`;
}
