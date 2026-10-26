// A023 signup policy — the operator's signup gate.
//
// Source signup enabled per Rob's 26 Oct 09:05 backup-only approval.
// This is deliberately NOT env-, request- or deployment-driven. Source
// enablement does not apply a QA migration or change deployed settings.
//
// Kept out of the "use server" action module because file-level "use server"
// files may only export async functions; the action imports this instead.

export function isPlatformSignupDisabled(): boolean {
    return false;
}

