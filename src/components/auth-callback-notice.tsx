"use client";

import { useEffect, useState } from "react";
import ui from "./first-session.module.css";

// A023 — the auth callback sends a link it could not confirm to
// /login?error=auth-code-error. This says so on the sign-in page, in fixed
// words. Only that exact value is recognised; any other value, and the raw
// query itself, is never shown. Nothing is retried, sent or navigated here,
// and no cause is claimed.

/** The one error value the auth callback route sends. */
export const AUTH_CALLBACK_FAILURE = "auth-code-error";

export const AUTH_CALLBACK_NOTICE = "We couldn't confirm that sign-in link. Try signing in, or request a new link.";

/** True only when the query has exactly one `error`, and it is the callback's value. */
export function isAuthCallbackFailure(search: unknown): boolean {
    if (typeof search !== "string" || !search) return false;
    let errors: string[];
    try {
        errors = new URLSearchParams(search).getAll("error");
    } catch {
        return false;
    }
    return errors.length === 1 && errors[0] === AUTH_CALLBACK_FAILURE;
}

/**
 * Reads the address only after hydration, so the server render and the first
 * browser render are identical (both show nothing). Back and forward between
 * addresses update it; it is not stored anywhere.
 */
export default function AuthCallbackNotice() {
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        const read = () => setFailed(isAuthCallbackFailure(window.location.search));
        read();
        window.addEventListener("popstate", read);
        return () => window.removeEventListener("popstate", read);
    }, []);
    if (!failed) return null;
    return <p role="alert" className={ui.error} data-auth-callback-notice>{AUTH_CALLBACK_NOTICE}</p>;
}
