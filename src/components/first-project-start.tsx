"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { FIRST_PROJECT_STEPS, NEW_PROJECT_PATH } from "@/lib/first-session";

/**
 * What Home and Pipeline show before a contractor has any projects: one
 * action and the short journey that follows it. KPI cards, filters and
 * module shortcuts mean nothing yet, so they are left out.
 */
export default function FirstProjectStart({ companyName, forceDark = false }: {
    companyName?: string | null;
    /** For pages that are always dark, whatever theme the contractor picked. */
    forceDark?: boolean;
}) {
    const { theme } = useTheme();
    const isDark = forceDark || theme === "dark";
    const name = companyName?.trim();

    return (
        <section
            aria-labelledby="first-project-heading"
            className={`rounded-2xl border p-5 sm:p-8 ${
                isDark ? "bg-[#1a1a1a] border-[#2a2a2a]" : "bg-white border-gray-200 shadow-sm"
            }`}
        >
            <h1 id="first-project-heading" className={`text-2xl sm:text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                {name ? `Welcome, ${name}` : "Welcome"}
            </h1>
            <p className={`mt-2 text-base ${isDark ? "text-slate-300" : "text-gray-600"}`}>
                Start by adding your first job. It takes a minute, and it starts blank.
            </p>

            <Link
                href={NEW_PROJECT_PATH}
                className="mt-6 w-full sm:w-auto min-h-12 px-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-base font-bold transition-colors"
            >
                Add your first job
                <ArrowRight className="w-5 h-5" />
            </Link>

            <h2 className={`mt-8 text-sm font-semibold ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                How it works
            </h2>
            <ol className="mt-3 grid gap-3 sm:grid-cols-2">
                {FIRST_PROJECT_STEPS.map((step, i) => (
                    <li
                        key={step.title}
                        className={`flex items-start gap-3 rounded-xl border p-4 ${
                            isDark ? "border-[#2a2a2a] bg-[#0d0d0d]" : "border-gray-200 bg-gray-50"
                        }`}
                    >
                        <span
                            aria-hidden
                            className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                                isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-700"
                            }`}
                        >
                            {i + 1}
                        </span>
                        <span className="min-w-0">
                            <span className={`block text-base font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{step.title}</span>
                            <span className={`block text-sm mt-0.5 ${isDark ? "text-slate-400" : "text-gray-600"}`}>{step.detail}</span>
                        </span>
                    </li>
                ))}
            </ol>
        </section>
    );
}
