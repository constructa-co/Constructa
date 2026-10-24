import React from "react";
import { createRoot } from "react-dom/client";
import PlatformTermsCompletion from "@/app/auth/platform-terms/completion-client";
import { PLATFORM_TERMS_CURRENT_REVISION } from "@/lib/platform-terms";

/**
 * Offline native fixture over canonical PlatformTermsCompletion (constructa).
 * Completion transport is a labelled MOCK of completePlatformTermsAcceptanceAction
 * only. No Auth DB, session recorder, network, or real navigation.
 */
export type CompletionMockResult =
    | { ok: true; outcome: "recorded" | "already-recorded" }
    | { ok: false; code: string };

interface Fixture {
    calls: string[];
    completionInvocationCount: number;
    lastCompletionInput: unknown;
    completionBehavior: () => Promise<CompletionMockResult>;
    rejectCompletion: ((reason: Error) => void) | null;
    router: { push: (href: string) => void; refresh: () => void };
}

declare global {
    interface Window {
        __completionNativeLocal: Fixture;
    }
}

const fixture: Fixture = {
    calls: [],
    completionInvocationCount: 0,
    lastCompletionInput: null,
    completionBehavior: async () => ({ ok: true, outcome: "recorded" }),
    rejectCompletion: null,
    router: { push: () => blocked("router.push"), refresh: () => blocked("router.refresh") },
};

function blocked(name: string): never {
    fixture.calls.push(name);
    throw new Error(`Real navigation excluded from completion-native fixture: ${name}`);
}

window.__completionNativeLocal = fixture;

createRoot(document.getElementById("app")!).render(
    <PlatformTermsCompletion revision={PLATFORM_TERMS_CURRENT_REVISION} />,
);
