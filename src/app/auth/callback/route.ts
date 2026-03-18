import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type')
    const next = searchParams.get('next') ?? '/dashboard'

    // Handle PKCE code exchange (standard OAuth / email confirmation)
    if (code) {
        const supabase = createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
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
        const supabase = createClient()
        const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as 'recovery' | 'email' | 'signup',
        })
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
