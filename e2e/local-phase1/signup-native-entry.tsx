import React from "react";
import { createRoot } from "react-dom/client";
import LoginPage from "@/app/login/page";

/**
 * Offline native fixture over the canonical LoginPage (constructa @ 08e4475).
 * Signup uses a labelled MOCK of platformSignupAction only; browser Supabase
 * auth is refused. No Auth DB, network, or real accounts.
 */
export type SignupMockResult =
    | { ok: true; outcome: "confirmation-required" }
    | { ok: true; outcome: "created-and-recorded"; userId: string }
    | { ok: false; code: string };

interface Fixture {
    calls: string[];
    signupInvocationCount: number;
    lastSignupInput: unknown;
    signupBehavior: () => Promise<SignupMockResult>;
    rejectSignup: ((reason: Error) => void) | null;
    router: { push: (href: string) => void; refresh: () => void };
}

declare global {
    interface Window {
        __signupNativeLocal: Fixture;
    }
}

const fixture: Fixture = {
    calls: [],
    signupInvocationCount: 0,
    lastSignupInput: null,
    signupBehavior: async () => ({ ok: true, outcome: "confirmation-required" }),
    rejectSignup: null,
    router: { push: () => blocked("router.push"), refresh: () => blocked("router.refresh") },
};

function blocked(name: string): never {
    fixture.calls.push(name);
    throw new Error(`Real navigation excluded from signup-native fixture: ${name}`);
}

window.__signupNativeLocal = fixture;

createRoot(document.getElementById("app")!).render(<LoginPage />);
