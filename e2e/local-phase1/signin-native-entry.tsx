import React from "react";
import { createRoot } from "react-dom/client";
import LoginPage from "@/app/login/page";

/**
 * Offline native fixture over canonical LoginPage (constructa @ d000767).
 * Sign-in uses a labelled MOCK of browser signInWithPassword only; signup
 * server action stays excluded. No Auth DB, network, or real navigation.
 */
export type SignInMockResult = { error: { message: string } | null };

interface Fixture {
    calls: string[];
    signInInvocationCount: number;
    lastSignInInput: { email: string; password: string } | null;
    signInBehavior: () => Promise<SignInMockResult>;
    resolveSignIn: ((value: SignInMockResult) => void) | null;
    router: { push: (href: string) => void; refresh: () => void };
}

declare global {
    interface Window {
        __signinNativeLocal: Fixture;
    }
}

const fixture: Fixture = {
    calls: [],
    signInInvocationCount: 0,
    lastSignInInput: null,
    signInBehavior: async () => ({ error: { message: "signin-native fixture not configured" } }),
    resolveSignIn: null,
    router: { push: () => blocked("router.push"), refresh: () => blocked("router.refresh") },
};

function blocked(name: string): never {
    fixture.calls.push(name);
    throw new Error(`Real navigation excluded from signin-native fixture: ${name}`);
}

window.__signinNativeLocal = fixture;

createRoot(document.getElementById("app")!).render(<LoginPage />);
