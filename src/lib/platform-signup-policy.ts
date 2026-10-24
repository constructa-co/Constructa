// A023 signup policy — the operator's signup gate.
//
// Hard-coded OFF per Rob's standing instruction ("Signup remains OFF"). This
// is deliberately NOT env-, request- or deployment-driven: preserving the
// disabled gate exactly means there is no configuration path that enables
// signup. Enabling it later is a deliberate, reviewed code change to this
// one function — never a flag.
//
// Kept out of the "use server" action module because file-level "use server"
// files may only export async functions; the action imports this instead.

export function isPlatformSignupDisabled(): boolean {
    return true;
}

