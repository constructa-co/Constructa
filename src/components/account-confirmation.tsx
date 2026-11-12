"use client";

import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import ui from "./first-session.module.css";

export default function AccountConfirmation({ message, onSignIn, footnote = "Already confirmed? Sign in with the email and password you used here." }: {
    message: string;
    onSignIn: () => void;
    /** Shown under the sign-in button. The default suits an account that still needs email confirmation. */
    footnote?: string;
}) {
    const nextAction = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        // The signup form has been removed; keep keyboard users at the next action.
        nextAction.current?.focus();
    }, []);

    const returnToSignIn = () => {
        onSignIn();
        requestAnimationFrame(() => document.getElementById("email")?.focus());
    };

    return (
        <div>
            <p className={ui.success} role="status">{message}</p>
            <button ref={nextAction} type="button" onClick={returnToSignIn} className={ui.primary}>
                Back to sign in<ArrowRight size={18} aria-hidden="true" />
            </button>
            <p className={ui.footnote}>{footnote}</p>
        </div>
    );
}
