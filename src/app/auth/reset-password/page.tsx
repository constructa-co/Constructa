'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getLaunchLandingPath } from '@/lib/launch-profile'
import {
    FORGOT_PASSWORD_PATH,
    isRecoveryLinkFailureHash,
    isRecoveryLinkFailureSearch,
    RECOVERY_LINK_EXPIRED_MESSAGE,
} from '@/lib/auth-recovery-link-failure'

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [sessionReady, setSessionReady] = useState(false)
    const router = useRouter()

    useEffect(() => {
        if (isRecoveryLinkFailureSearch(window.location.search)) {
            setError(RECOVERY_LINK_EXPIRED_MESSAGE)
            window.history.replaceState(null, '', '/auth/reset-password')
            return
        }

        if (isRecoveryLinkFailureHash(window.location.hash)) {
            setError(RECOVERY_LINK_EXPIRED_MESSAGE)
            window.history.replaceState(null, '', '/auth/reset-password')
            return
        }

        const supabase = createClient()

        // Handle the case where we land here with a hash fragment from the
        // Supabase recovery link (e.g. #access_token=...&refresh_token=...&type=recovery)
        const hash = window.location.hash.substring(1)
        const params = new URLSearchParams(hash)
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')

        if (access_token && refresh_token) {
            supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
                if (error) {
                    setError(RECOVERY_LINK_EXPIRED_MESSAGE)
                } else {
                    // Clear the hash from the URL bar
                    window.history.replaceState(null, '', '/auth/reset-password')
                    setSessionReady(true)
                }
            })
        } else {
            // Already have a session (landed here via /auth/confirm redirect)
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (session) {
                    setSessionReady(true)
                } else {
                    setError(RECOVERY_LINK_EXPIRED_MESSAGE)
                }
            })
        }
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters.')
            return
        }

        setLoading(true)

        const supabase = createClient()
        const { error } = await supabase.auth.updateUser({ password })

        if (error) {
            setError(error.message)
            setLoading(false)
            return
        }

        setSuccess(true)
        setTimeout(() => router.push(getLaunchLandingPath()), 2000)
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <Card className="w-full max-w-md bg-slate-900 border-slate-800">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl text-slate-100">Reset Password</CardTitle>
                    <CardDescription className="text-slate-400">
                        Enter your new password below.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {success ? (
                        <div className="p-3 bg-green-900/20 border border-green-900/50 rounded-lg text-green-200 text-sm text-center">
                            Password updated — redirecting to dashboard...
                        </div>
                    ) : !sessionReady ? (
                        <div className="space-y-4">
                            {error ? (
                                <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-200 text-sm" role="alert">
                                    {error}
                                    <div className="mt-2 flex flex-col gap-1 text-xs">
                                        <a href={FORGOT_PASSWORD_PATH} className="text-blue-400 underline">
                                            Request a new reset link
                                        </a>
                                        <a href="/login" className="text-slate-400 underline">
                                            Back to login
                                        </a>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-slate-400 text-sm text-center py-4">
                                    Verifying reset link…
                                </div>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-slate-300">
                                    New password
                                </Label>
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-slate-300">
                                    Confirm password
                                </Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500"
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-200 text-sm">
                                    {error}
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-white text-slate-950 hover:bg-slate-200"
                            >
                                {loading ? 'Updating...' : 'Update password'}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
