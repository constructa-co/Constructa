import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Only a path on this site is followed after sign-in. Anything that could
// name another host (a scheme, //, \, userinfo such as @host, or control
// characters the URL parser drops) falls back to the dashboard.
function localReturn(next: string | null, origin: string): string {
    const unsafe = [...(next ?? '')].some((c) => c === '\\' || c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)
    if (!next || !next.startsWith('/') || next.startsWith('//') || unsafe) return '/dashboard'
    try {
        const url = new URL(next, origin)
        return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : '/dashboard'
    } catch {
        return '/dashboard'
    }
}

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type')
    const next = localReturn(searchParams.get('next'), origin)

    // Handle PKCE code exchange (standard OAuth / email confirmation)
    if (code) {
        const supabase = await createClient()
        let exchanged: Awaited<ReturnType<typeof supabase.auth.exchangeCodeForSession>>
        try {
            exchanged = await supabase.auth.exchangeCodeForSession(code)
        } catch {
            // An uncertain exchange must not trigger a second provider attempt.
            return NextResponse.redirect(`${origin}/login?error=auth-code-error`)
        }
        const { error } = exchanged
        if (!error) {
            // If the code exchange was for a recovery flow, redirect to reset-password
            if (type === 'recovery') {
                return NextResponse.redirect(`${origin}/auth/reset-password`)
            }
            return NextResponse.redirect(`${origin}${next}`)
        }
    }

    // Handle token_hash flow (e.g. email links with token_hash + type)
    if (token_hash && type) {
        const supabase = await createClient()
        let verified: Awaited<ReturnType<typeof supabase.auth.verifyOtp>>
        try {
            verified = await supabase.auth.verifyOtp({
                token_hash,
                type: type as 'recovery' | 'email' | 'signup',
            })
        } catch {
            return NextResponse.redirect(`${origin}/login?error=auth-code-error`)
        }
        const { error } = verified
        if (!error) {
            if (type === 'recovery') {
                return NextResponse.redirect(`${origin}/auth/reset-password`)
            }
            return NextResponse.redirect(`${origin}${next}`)
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/login?error=auth-code-error`)
}
