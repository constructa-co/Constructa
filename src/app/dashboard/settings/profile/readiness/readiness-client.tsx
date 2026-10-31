"use client";

import Link from "next/link";
import { ArrowRight, Check, Circle, CircleDashed } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { workspaceStyles } from "@/lib/workspace-styles";
import { NEW_PROJECT_PATH, PROFILE_PATH } from "@/lib/first-session";
import type { CompanyReadiness, CompanyReadinessStatus } from "@/lib/company-readiness";

/**
 * Where a contractor lands after setup, and where they come back to while
 * building their company profile. One action starts a project; everything
 * else on the page is optional and says so.
 */
export default function ReadinessClient({ readiness, hasProjects }: {
    readiness: CompanyReadiness;
    hasProjects: boolean;
}) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const s = workspaceStyles(isDark);

    const badge: Record<CompanyReadinessStatus, string> = {
        ready: isDark ? "bg-emerald-500/15 text-emerald-200" : "bg-emerald-100 text-emerald-900",
        included: isDark ? "bg-emerald-500/15 text-emerald-200" : "bg-emerald-100 text-emerald-900",
        started: isDark ? "bg-amber-500/15 text-amber-100" : "bg-amber-100 text-amber-900",
        todo: isDark ? "bg-white/10 text-slate-200" : "bg-gray-100 text-gray-800",
    };
    const icon: Record<CompanyReadinessStatus, React.ReactNode> = {
        ready: <Check className="w-4 h-4" />,
        included: <Check className="w-4 h-4" />,
        started: <CircleDashed className="w-4 h-4" />,
        todo: <Circle className="w-4 h-4" />,
    };

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">
            <section aria-labelledby="readiness-heading" className={`${s.card} p-5 sm:p-8`}>
                <p className={`text-sm font-semibold ${isDark ? "text-emerald-300" : "text-emerald-800"}`}>
                    {hasProjects ? "Your company" : "You're set up"}
                </p>
                <h1 id="readiness-heading" className={`mt-1 text-2xl sm:text-3xl font-bold break-words ${s.heading}`}>
                    {readiness.companyName || "Your business"}
                </h1>
                {readiness.workType && (
                    <p className={`mt-2 text-base break-words ${s.body}`}>{readiness.workType}</p>
                )}
                <p className={`mt-4 text-base ${s.muted}`}>
                    You can price a job and send a proposal now. Everything below is optional and makes your proposals look more complete.
                </p>

                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <Link href={NEW_PROJECT_PATH} className={`${s.primaryButton} w-full sm:w-auto`}>
                        {hasProjects ? "Create a project" : "Create first project"}
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                    <Link href={PROFILE_PATH} className={`${s.secondaryButton} w-full sm:w-auto`}>
                        Build company profile
                    </Link>
                </div>
            </section>

            <section aria-labelledby="readiness-list-heading" className={`${s.card} p-5 sm:p-8`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 id="readiness-list-heading" className={`text-lg font-bold ${s.heading}`}>What your proposals can use</h2>
                    <p className={`text-sm ${s.muted}`}>{readiness.readyCount} of {readiness.total} in place</p>
                </div>

                <ul className="mt-4 space-y-3">
                    {readiness.items.map((entry) => (
                        <li key={entry.key} data-readiness={entry.key} data-status={entry.status} className={`${s.inset} p-4 flex flex-col sm:flex-row sm:items-center gap-3`}>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                    <h3 className={`text-base font-semibold ${s.heading}`}>{entry.title}</h3>
                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${badge[entry.status]}`}>
                                        <span aria-hidden>{icon[entry.status]}</span>
                                        {entry.statusLabel}
                                    </span>
                                </div>
                                <p className={`mt-1.5 text-sm ${s.muted}`}>{entry.detail}</p>
                            </div>
                            {entry.action && (
                                <Link
                                    href={entry.action.href}
                                    aria-label={`${entry.action.label}: ${entry.title}`}
                                    className={`${s.quietButton} self-start sm:self-center flex-shrink-0 border ${isDark ? "border-[#3a3a3a]" : "border-gray-300"}`}
                                >
                                    {entry.action.label}
                                </Link>
                            )}
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
