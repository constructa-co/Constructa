// A023 signup policy — the operator's signup gate.
//
// Signup stays off pending Rob's approval after the consent migration.
// This is deliberately NOT env-, request- or deployment-driven. This source
// guard does not apply a migration or change deployed settings.
//
// Kept out of the "use server" action module because file-level "use server"
// files may only export async functions; the action imports this instead.

export function isPlatformSignupDisabled(): boolean {
    return true;
}

