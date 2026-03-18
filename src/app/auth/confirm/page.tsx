'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthConfirmPage() {
    const router = useRouter()
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const handleHashFragment = async () => {
            const hash = window.location.hash.substring(1)
            const params = new URLSearchParams(hash)

            const access_token = params.get('access_token')
            const refresh_token = params.get('refresh_token')
            const type = params.get('type')

            if (!access_token || !refresh_token) {
                setError('Missing authentication tokens. Please request a new password reset link.')
                return
            }

            const supabase = createClient()
            const { error } = await supabase.auth.setSession({
                access_token,
                refresh_token,
            })

            if (error) {
                setError(error.message)
                return
            }

            if (type === 'recovery') {
                router.replace('/auth/reset-password')
            } else {
                router.replace('/dashboard')
            }
        }

        handleHashFragment()
    }, [router])

    if (error) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-md w-full text-center">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="text-slate-400 text-sm">Verifying...</div>
        </div>
    )
}
