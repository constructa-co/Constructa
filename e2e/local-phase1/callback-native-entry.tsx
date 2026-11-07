import React from "react";
import { createRoot } from "react-dom/client";
import LoginPage from "@/app/login/page";

/**
 * Offline native fixture over canonical LoginPage (constructa @ f422538 notice).
 * AuthCallbackNotice reads the real browser address after hydration only.
 * Supabase auth and signup transport are refused; router push/refresh blocked.
 */
interface Fixture {
    calls: string[];
    router: { push: (href: string) => void; refresh: () => void };
}

declare global {
    interface Window {
        __callbackNativeLocal: Fixture;
    }
}

const fixture: Fixture = {
    calls: [],
    router: { push: () => blocked("router.push"), refresh: () => blocked("router.refresh") },
};

function blocked(name: string): never {
    fixture.calls.push(name);
    throw new Error(`Real navigation excluded from callback-native fixture: ${name}`);
}

window.__callbackNativeLocal = fixture;

createRoot(document.getElementById("app")!).render(<LoginPage />);
