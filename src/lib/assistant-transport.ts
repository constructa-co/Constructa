/**
 * A055 shared vocabulary for the job assistant's request path.
 *
 * The browser sends only identifiers, the contractor's own words, the
 * conversation so far and a SHA-256 fingerprint of what the page is showing.
 * The server rebuilds the job context itself and refuses when the fingerprint
 * does not match what is saved. A fingerprint is a freshness check, never
 * proof of permission or correctness. No imports: both conversations and the
 * server handlers use this.
 */

export type AssistantTurnStatus = "off" | "stale" | "unavailable" | "invalid" | "rejected";
export type AssistantTurnMessage = { role: "user" | "assistant"; content: string };
export interface AssistantProvenance {
    projectId: string;
    /** Pricing only: the selected estimate, or null before a first estimate exists. */
    estimateId?: string | null;
    revision: string;
}
export type AssistantTurnResult<R = unknown> =
    | { status: "reply"; reply: R; provenance: AssistantProvenance }
    | { status: AssistantTurnStatus; message: string };

/** Thrown by a request adapter so a conversation can tell "off" or "changed" from a failed reply. */
export class AssistantTransportError extends Error {
    constructor(readonly status: AssistantTurnStatus, message: string) {
        super(message);
        this.name = "AssistantTransportError";
    }
}

// Server text is shown to the contractor only when it is a short plain string.
const MESSAGE_LIMIT = 500;
const STATUSES: readonly string[] = ["off", "stale", "unavailable", "invalid", "rejected"];

export async function sha256Hex(text: string): Promise<string> {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Accepts a reply only when the server says which job, estimate and saved
 * revision it was checked against, and they are the ones this page asked about.
 */
export function unwrapAssistantTurn(result: unknown, expected: AssistantProvenance, fallback: string): unknown {
    if (!result || typeof result !== "object") throw new AssistantTransportError("unavailable", fallback);
    const value = result as { status?: unknown; message?: unknown; reply?: unknown; provenance?: Partial<AssistantProvenance> };
    if (value.status === "reply") {
        const provenance = value.provenance;
        const matches = !!provenance && provenance.projectId === expected.projectId && provenance.revision === expected.revision
            && ("estimateId" in expected ? provenance.estimateId === expected.estimateId : provenance.estimateId === undefined);
        if (!matches) throw new AssistantTransportError("stale", fallback);
        return value.reply;
    }
    if (typeof value.status !== "string" || !STATUSES.includes(value.status)) throw new AssistantTransportError("unavailable", fallback);
    const message = typeof value.message === "string" && value.message.trim() && value.message.length <= MESSAGE_LIMIT ? value.message : fallback;
    throw new AssistantTransportError(value.status as AssistantTurnStatus, message);
}
