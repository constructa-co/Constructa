import React from "react";
import { createRoot } from "react-dom/client";
import LoginPage from "@/app/login/page";

/**
 * Offline native fixture over the canonical LoginPage (../constructa).
 * Signup uses a labelled MOCK of platformSignupAction with an explicit typed
 * synthetic result; browser Supabase auth and router navigation are refused.
 */
export type SignupOutcomeMockResult =
    | { ok: true; outcome: "confirmation-required" }
    | { ok: true; outcome: "created-and-recorded"; userId: string }
    | { ok: false; code: string };

interface Fixture {
    calls: string[];
    signupInvocationCount: number;
    lastSignupInput: unknown;
    signupBehavior: () => Promise<SignupOutcomeMockResult>;
    router: { push: (href: string) => void; refresh: () => void };
}

declare global {
    interface Window {
        __signupOutcomeNativeLocal: Fixture;
    }
}

const fixture: Fixture = {
    calls: [],
    signupInvocationCount: 0,
    lastSignupInput: null,
    signupBehavior: async () => ({ ok: true, outcome: "confirmation-required" }),
    router: { push: () => blocked("router.push"), refresh: () => blocked("router.refresh") },
};

function blocked(name: string): never {
    fixture.calls.push(name);
    throw new Error(`Real navigation excluded from signup-outcome-native fixture: ${name}`);
}

window.__signupOutcomeNativeLocal = fixture;

createRoot(document.getElementById("app")!).render(<LoginPage />);
