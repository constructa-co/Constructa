"use client";

import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import ui from "./first-session.module.css";

export default function AccountConfirmation({ message, onSignIn }: {
    message: string;
    onSignIn: () => void;
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
            <p className={ui.footnote}>Already confirmed? Sign in with the email and password you used here.</p>
        </div>
    );
}
