export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import AdminClient from "./admin-client";
import {
    PLAN_PRICE_GBP,
    AdminData,
    SubscriberRow,
    ActivationStatus,
    DataPoint,
    MrrMonth,
    CohortRow,
    FeatureAdoptionRow,
    GeoRow,
    OpenAIUsageDay,
    PlausibleMetrics,
} from "./types";

// ─── Helper functions ─────────────────────────────────────────────────────────

function daysDiff(a: Date, b: Date): number {
    return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function toMonthKey(iso: string): string {
    return iso.substring(0, 7); // "2024-01"
}

function monthLabel(key: string): string {
    // "2024-01" → "Jan 24"
    const [year, month] = key.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[parseInt(month, 10) - 1]} ${year.substring(2)}`;
}

function dayLabel(iso: string): string {
    // "2024-04-06" → "06 Apr"
    const d = new Date(iso + "T00:00:00Z");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${String(d.getUTCDate()).padStart(2, "0")} ${months[d.getUTCMonth()]}`;
}

function getLast13MonthKeys(): string[] {
    // Returns oldest → newest, 13 months ending current month
    const now = new Date();
    const keys: string[] = [];
    for (let i = 12; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    }
    return keys;
}

function getLast30DayKeys(): string[] {
    // Returns oldest → newest, 30 days ending today
    const now = new Date();
    const keys: string[] = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
        keys.push(d.toISOString().substring(0, 10));
    }
    return keys;
}

function getLast12WeekKeys(): string[] {
    // Returns oldest → newest ISO week keys "YYYY-WXX"
    const now = new Date();
    // Find the most recent Monday
    const dayOfWeek = now.getUTCDay(); // 0=Sun,1=Mon,...
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisMonday = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysToMonday)
    );

    const keys: string[] = [];
    for (let i = 11; i >= 0; i--) {
        const weekStart = new Date(thisMonday.getTime() - i * 7 * 86400000);
        const jan4 = new Date(Date.UTC(weekStart.getUTCFullYear(), 0, 4));
        const dayOfJan4 = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
        const weekNum = Math.ceil(
            ((weekStart.getTime() - jan4.getTime()) / 86400000 + dayOfJan4) / 7
        );
        const isoYear = weekStart.getUTCFullYear();
        keys.push(`${isoYear}-W${String(weekNum).padStart(2, "0")}`);
    }
    return keys;
}

function getISOWeekKey(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00Z");
    const dayOfWeek = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    const thursday = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - dayOfWeek)
    );
    const jan1 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((thursday.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
    return `${thursday.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function weekLabel(key: string): string {
    // "2024-W14" → "Wk 14"
    const wk = key.split("-W")[1];
    return `Wk ${parseInt(wk, 10)}`;
}

// ─── External API fetches ─────────────────────────────────────────────────────

async function fetchOpenAICosts(): Promise<{ mtdCostGbp: number; dailyCosts: OpenAIUsageDay[] }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { mtdCostGbp: 0, dailyCosts: [] };

    const USD_TO_GBP = 0.79;
    const dailyCosts: OpenAIUsageDay[] = [];
    let totalCostUsd = 0;

    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    for (let d = new Date(startOfMonth); d <= now; d.setUTCDate(d.getUTCDate() + 1)) {
        const dateStr = d.toISOString().substring(0, 10);
        try {
            const res = await fetch(`https://api.openai.com/v1/usage?date=${dateStr}`, {
                headers: { Authorization: `Bearer ${apiKey}` },
                next: { revalidate: 3600 },
            });
            if (res.ok) {
                const data = await res.json();
                const dailyTokens = (
                    (data.data ?? []) as Array<{
                        n_context_tokens_total?: number;
                        n_generated_tokens_total?: number;
                    }>
                ).reduce(
                    (sum, item) =>
                        sum + (item.n_context_tokens_total ?? 0) + (item.n_generated_tokens_total ?? 0),
                    0
                );
                const approxCostUsd = (dailyTokens / 1_000_000) * 0.4;
                totalCostUsd += approxCostUsd;
                dailyCosts.push({
                    date: dateStr,
                    cost_usd: approxCostUsd,
                    cost_gbp: approxCostUsd * USD_TO_GBP,
                    requests: (data.data as unknown[])?.length ?? 0,
                });
            }
        } catch {
            /* skip failed days */
        }
    }

    return { mtdCostGbp: totalCostUsd * USD_TO_GBP, dailyCosts };
}

async function fetchPlausible(): Promise<PlausibleMetrics> {
    const apiKey = process.env.PLAUSIBLE_API_KEY;
    const siteId = "constructa.co";
    const empty: PlausibleMetrics = {
        available: false,
        visitors30d: 0,
        pageviews30d: 0,
        bounceRate: 0,
        visitDuration: 0,
        signupConversionRate: 0,
        topPages: [],
        topSources: [],
    };
    if (!apiKey) return empty;

    try {
        const [agg, pages, sources] = await Promise.all([
            fetch(
                `https://plausible.io/api/v1/stats/aggregate?site_id=${siteId}&period=30d&metrics=visitors,pageviews,bounce_rate,visit_duration`,
                {
                    headers: { Authorization: `Bearer ${apiKey}` },
                    next: { revalidate: 3600 },
                }
            ),
            fetch(
                `https://plausible.io/api/v1/stats/breakdown?site_id=${siteId}&period=30d&property=event:page&limit=10`,
                {
                    headers: { Authorization: `Bearer ${apiKey}` },
                    next: { revalidate: 3600 },
                }
            ),
            fetch(
                `https://plausible.io/api/v1/stats/breakdown?site_id=${siteId}&period=30d&property=visit:source&limit=10`,
                {
                    headers: { Authorization: `Bearer ${apiKey}` },
                    next: { revalidate: 3600 },
                }
            ),
        ]);

        if (!agg.ok) return empty;

        const aggData = await agg.json();
        const pagesData = pages.ok ? await pages.json() : { results: [] };
        const sourcesData = sources.ok ? await sources.json() : { results: [] };

        const visitors: number = aggData.results?.visitors?.value ?? 0;

        return {
            available: true,
            visitors30d: visitors,
            pageviews30d: aggData.results?.pageviews?.value ?? 0,
            bounceRate: aggData.results?.bounce_rate?.value ?? 0,
            visitDuration: aggData.results?.visit_duration?.value ?? 0,
            signupConversionRate: 0, // computed after with actual signup count
            topPages: (
                (pagesData.results ?? []) as Array<{ page: string; visitors: number }>
            ).map((p) => ({ page: p.page, visitors: p.visitors })),
            topSources: (
                (sourcesData.results ?? []) as Array<{ source: string; visitors: number }>
            ).map((s) => ({ source: s.source || "Direct", visitors: s.visitors })),
        };
    } catch {
        return empty;
    }
}

// ─── Main page component ──────────────────────────────────────────────────────

export default async function AdminPage() {
    const supabase = createAdminClient();

    // ── 1. Fetch all data in parallel ────────────────────────────────────────
    const [
        { data: authData },
        { data: profiles },
        { data: projects },
        { data: estimates },
        { data: adminCosts },
        openaiResult,
        plausibleResult,
    ] = await Promise.all([
        supabase.auth.admin.listUsers({ perPage: 1000 }),
        supabase
            .from("profiles")
            .select("id, company_name, country, signup_source, created_at"),
        supabase
            .from("projects")
            .select(
                "id, user_id, created_at, updated_at, proposal_status, proposal_accepted_at, region, lat, lng, brief_completed, contract_review_flags, risk_register, closing_statement"
            ),
        supabase.from("estimates").select("id, project_id, created_at"),
        supabase.from("admin_costs").select("*").order("month", { ascending: false }),
        fetchOpenAICosts().catch(
            (): { mtdCostGbp: number; dailyCosts: OpenAIUsageDay[] } => ({
                mtdCostGbp: 0,
                dailyCosts: [],
            })
        ),
        fetchPlausible().catch(
            (): PlausibleMetrics => ({
                available: false,
                visitors30d: 0,
                pageviews30d: 0,
                bounceRate: 0,
                visitDuration: 0,
                signupConversionRate: 0,
                topPages: [],
                topSources: [],
            })
        ),
    ]);

    const authUsers = authData?.users ?? [];
    const safeProfiles = profiles ?? [];
    const safeProjects = projects ?? [];
    const safeEstimates = estimates ?? [];
    const safeAdminCosts = adminCosts ?? [];

    const now = new Date();

    // ── 2. Build lookup maps ─────────────────────────────────────────────────

    // Auth user map: id → { email, last_sign_in_at, created_at }
    const authUserMap = new Map(
        authUsers.map((u) => [
            u.id,
            {
                email: u.email ?? null,
                last_sign_in_at: u.last_sign_in_at ?? null,
                created_at: u.created_at,
            },
        ])
    );

    // Projects per user
    type ProjectRow = (typeof safeProjects)[number];
    const projectsByUser = new Map<string, ProjectRow[]>();
    for (const p of safeProjects) {
        const list = projectsByUser.get(p.user_id) ?? [];
        list.push(p);
        projectsByUser.set(p.user_id, list);
    }

    // Estimates per project
    type EstimateRow = (typeof safeEstimates)[number];
    const estimatesByProject = new Map<string, EstimateRow[]>();
    for (const e of safeEstimates) {
        const list = estimatesByProject.get(e.project_id) ?? [];
        list.push(e);
        estimatesByProject.set(e.project_id, list);
    }

    // ── 3. Build SubscriberRow[] ─────────────────────────────────────────────

    const subscribers: SubscriberRow[] = [];

    for (const profile of safeProfiles) {
        const auth = authUserMap.get(profile.id);
        const userProjects = projectsByUser.get(profile.id) ?? [];

        const signedUpAt = new Date(profile.created_at);
        const lastSignInAt = auth?.last_sign_in_at ? new Date(auth.last_sign_in_at) : null;

        const daysSinceSignup = daysDiff(signedUpAt, now);
        const daysSinceActive = lastSignInAt ? daysDiff(lastSignInAt, now) : Infinity;

        const is_active_30d = daysSinceActive <= 30;
        const is_active_7d = daysSinceActive <= 7;

        const project_count = userProjects.length;

        const estimate_count = userProjects.reduce(
            (sum, p) => sum + (estimatesByProject.get(p.id)?.length ?? 0),
            0
        );

        const proposals_sent = userProjects.filter(
            (p) => p.proposal_status && p.proposal_status !== "draft"
        ).length;

        const proposals_accepted = userProjects.filter(
            (p) => p.proposal_status === "accepted"
        ).length;

        const contracts_reviewed = userProjects.filter(
            (p) => Array.isArray(p.contract_review_flags) && p.contract_review_flags.length > 0
        ).length;

        const has_brief = userProjects.some((p) => p.brief_completed === true);

        // Activation status
        let activation_status: ActivationStatus;
        if (daysSinceSignup <= 7) {
            activation_status = "new";
        } else if (!is_active_30d && daysSinceSignup > 60) {
            activation_status = "churned";
        } else if (
            (daysSinceSignup > 7 && project_count === 0) ||
            (!is_active_30d && daysSinceSignup > 14 && project_count > 0)
        ) {
            activation_status = "at_risk";
        } else if (project_count > 0 && is_active_30d) {
            activation_status = "activated";
        } else {
            activation_status = "new";
        }

        subscribers.push({
            id: profile.id,
            email: auth?.email ?? null,
            company_name: profile.company_name ?? null,
            country: profile.country ?? null,
            signup_source: profile.signup_source ?? null,
            created_at: profile.created_at,
            last_sign_in_at: auth?.last_sign_in_at ?? null,
            project_count,
            estimate_count,
            proposals_sent,
            proposals_accepted,
            contracts_reviewed,
            has_brief,
            last_active: auth?.last_sign_in_at ?? null,
            is_active_30d,
            is_active_7d,
            days_since_signup: daysSinceSignup,
            activation_status,
        });
    }

    const totalSubscribers = subscribers.length;

    // ── 4. Signup time boundaries ────────────────────────────────────────────

    const startOfToday = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    const dayOfWeekMon = now.getUTCDay() === 0 ? 6 : now.getUTCDay() - 1;
    const startOfThisWeek = new Date(startOfToday.getTime() - dayOfWeekMon * 86400000);

    const startOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const currentQuarter = Math.floor(now.getUTCMonth() / 3);
    const startOfThisQuarter = new Date(
        Date.UTC(now.getUTCFullYear(), currentQuarter * 3, 1)
    );

    const startOfThisYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

    const startOfPrevMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
    );
    const endOfPrevMonth = new Date(startOfThisMonth.getTime() - 1);

    const signupsToday = subscribers.filter(
        (s) => new Date(s.created_at) >= startOfToday
    ).length;

    const signupsThisWeek = subscribers.filter(
        (s) => new Date(s.created_at) >= startOfThisWeek
    ).length;

    const signupsThisMonth = subscribers.filter(
        (s) => new Date(s.created_at) >= startOfThisMonth
    ).length;

    const signupsThisQuarter = subscribers.filter(
        (s) => new Date(s.created_at) >= startOfThisQuarter
    ).length;

    const signupsThisYear = subscribers.filter(
        (s) => new Date(s.created_at) >= startOfThisYear
    ).length;

    const signupsPrevMonth = subscribers.filter((s) => {
        const d = new Date(s.created_at);
        return d >= startOfPrevMonth && d <= endOfPrevMonth;
    }).length;

    // ── 5. Time-series signups ───────────────────────────────────────────────

    const dayKeys = getLast30DayKeys();
    const dailySignupCounts = new Map<string, number>();
    for (const s of subscribers) {
        const key = s.created_at.substring(0, 10);
        if (dayKeys.includes(key)) {
            dailySignupCounts.set(key, (dailySignupCounts.get(key) ?? 0) + 1);
        }
    }
    const dailySignups: DataPoint[] = dayKeys.map((key) => ({
        label: dayLabel(key),
        key,
        value: dailySignupCounts.get(key) ?? 0,
    }));

    const weekKeys = getLast12WeekKeys();
    const weeklySignupCounts = new Map<string, number>();
    for (const s of subscribers) {
        const key = getISOWeekKey(s.created_at.substring(0, 10));
        if (weekKeys.includes(key)) {
            weeklySignupCounts.set(key, (weeklySignupCounts.get(key) ?? 0) + 1);
        }
    }
    const weeklySignups: DataPoint[] = weekKeys.map((key) => ({
        label: weekLabel(key),
        key,
        value: weeklySignupCounts.get(key) ?? 0,
    }));

    const monthKeys = getLast13MonthKeys();
    const monthlySignupCounts = new Map<string, number>();
    for (const s of subscribers) {
        const key = toMonthKey(s.created_at);
        if (monthKeys.includes(key)) {
            monthlySignupCounts.set(key, (monthlySignupCounts.get(key) ?? 0) + 1);
        }
    }
    const monthlySignups: DataPoint[] = monthKeys.map((key) => ({
        label: monthLabel(key),
        key,
        value: monthlySignupCounts.get(key) ?? 0,
    }));

    // ── 6. MRR by month ──────────────────────────────────────────────────────

    const mrrByMonth: MrrMonth[] = monthKeys.map((key) => {
        const endOfMonth = new Date(`${key}-01T00:00:00Z`);
        endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1);

        const cumulativeUsers = subscribers.filter(
            (s) => new Date(s.created_at) < endOfMonth
        ).length;

        const newUsers = monthlySignupCounts.get(key) ?? 0;
        const mrr = cumulativeUsers * PLAN_PRICE_GBP;
        const newMrr = newUsers * PLAN_PRICE_GBP;

        return {
            month: key,
            label: monthLabel(key),
            cumulativeUsers,
            newUsers,
            mrr,
            newMrr,
            churnedMrr: 0,
            netNewMrr: newMrr,
        };
    });

    // ── 7. Revenue metrics ───────────────────────────────────────────────────

    const mrr = totalSubscribers * PLAN_PRICE_GBP;
    const arr = mrr * 12;
    const arpu = totalSubscribers > 0 ? mrr / totalSubscribers : 0;

    const thisMonthKey = toMonthKey(now.toISOString());
    const lastMonthKey = toMonthKey(
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString()
    );
    const thisMonthMrrEntry = mrrByMonth.find((m) => m.month === thisMonthKey);
    const lastMonthMrrEntry = mrrByMonth.find((m) => m.month === lastMonthKey);

    const thisMonthMrr = thisMonthMrrEntry?.mrr ?? 0;
    const lastMonthMrr = lastMonthMrrEntry?.mrr ?? 0;

    const momGrowthPct: number | null =
        lastMonthMrr > 0 ? ((thisMonthMrr - lastMonthMrr) / lastMonthMrr) * 100 : null;

    // QoQ: current quarter cumulative vs last quarter cumulative
    const lastQuarterStart = new Date(
        Date.UTC(now.getUTCFullYear(), currentQuarter * 3 - 3, 1)
    );
    const thisQuarterCumulative = subscribers.filter(
        (s) => new Date(s.created_at) < now
    ).length;
    const lastQuarterCumulative = subscribers.filter(
        (s) => new Date(s.created_at) < lastQuarterStart
    ).length;
    const qoqGrowthPct: number | null =
        lastQuarterCumulative > 0
            ? ((thisQuarterCumulative - lastQuarterCumulative) / lastQuarterCumulative) * 100
            : null;

    // YoY: this month's cumulative vs same month last year
    const sameMonthLastYearEnd = new Date(
        Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth() + 1, 1)
    );
    const sameMonthLastYearCumulative = subscribers.filter(
        (s) => new Date(s.created_at) < sameMonthLastYearEnd
    ).length;
    const yoyGrowthPct: number | null =
        sameMonthLastYearCumulative > 0
            ? ((totalSubscribers - sameMonthLastYearCumulative) / sameMonthLastYearCumulative) * 100
            : null;

    // Projected ARR EoY: extrapolate from current growth rate to Dec 31
    const monthsRemaining =
        11 - now.getUTCMonth() + (now.getUTCDate() < 31 ? (31 - now.getUTCDate()) / 31 : 0);
    const growthRate = momGrowthPct !== null ? momGrowthPct / 100 : 0;
    const projectedSubscribersEoy =
        growthRate > 0
            ? totalSubscribers * Math.pow(1 + growthRate, monthsRemaining)
            : totalSubscribers;
    const projectedArrEoy = projectedSubscribersEoy * PLAN_PRICE_GBP * 12;

    // ── 8. Churn ─────────────────────────────────────────────────────────────

    const churned = subscribers.filter(
        (s) => !s.is_active_30d && s.days_since_signup > 60
    ).length;

    const churnRate = totalSubscribers > 0 ? (churned / totalSubscribers) * 100 : 0;

    const churnedThisMonth = subscribers.filter((s) => {
        if (!s.last_sign_in_at || s.days_since_signup <= 60) return false;
        const daysSinceActive = daysDiff(new Date(s.last_sign_in_at), now);
        return daysSinceActive >= 30 && daysSinceActive < 60;
    }).length;

    const ltv = churnRate > 0 ? (arpu / churnRate) * 100 : arpu * 24;

    // ── 9. Activation & active user counts ───────────────────────────────────

    const activatedUsers = subscribers.filter((s) => s.project_count > 0).length;
    const activationRate =
        totalSubscribers > 0 ? (activatedUsers / totalSubscribers) * 100 : 0;

    const dau = subscribers.filter(
        (s) => s.last_sign_in_at && daysDiff(new Date(s.last_sign_in_at), now) < 1
    ).length;
    const wau = subscribers.filter(
        (s) => s.last_sign_in_at && daysDiff(new Date(s.last_sign_in_at), now) < 7
    ).length;
    const mau = subscribers.filter(
        (s) => s.last_sign_in_at && daysDiff(new Date(s.last_sign_in_at), now) < 30
    ).length;
    const mauPrev = subscribers.filter((s) => {
        if (!s.last_sign_in_at) return false;
        const d = daysDiff(new Date(s.last_sign_in_at), now);
        return d >= 30 && d < 60;
    }).length;

    const stickiness = mau > 0 ? (dau / mau) * 100 : 0;

    // ── 10. At-risk users ────────────────────────────────────────────────────

    const atRiskUsers = subscribers.filter(
        (s) =>
            (s.days_since_signup > 7 && s.project_count === 0) ||
            (!s.is_active_30d && s.days_since_signup > 14 && s.project_count > 0)
    );

    // ── 11. Cohort retention (last 12 cohort months) ──────────────────────────

    const cohortMonthKeys = getLast13MonthKeys().slice(0, 12);

    const cohorts: CohortRow[] = cohortMonthKeys.map((cohortKey) => {
        const cohortStart = new Date(`${cohortKey}-01T00:00:00Z`);
        const cohortEnd = new Date(
            Date.UTC(cohortStart.getUTCFullYear(), cohortStart.getUTCMonth() + 1, 1)
        );

        const cohortMembers = subscribers.filter((s) => {
            const d = new Date(s.created_at);
            return d >= cohortStart && d < cohortEnd;
        });

        const cohortSize = cohortMembers.length;

        const retention: (number | null)[] = [];
        for (let n = 0; n <= 11; n++) {
            const periodStart = new Date(
                Date.UTC(
                    cohortStart.getUTCFullYear(),
                    cohortStart.getUTCMonth() + n,
                    1
                )
            );
            if (periodStart > now) {
                retention.push(null);
            } else if (n === 0) {
                retention.push(100);
            } else if (cohortSize === 0) {
                retention.push(null);
            } else {
                const retained = cohortMembers.filter(
                    (s) => s.last_sign_in_at && new Date(s.last_sign_in_at) >= periodStart
                ).length;
                retention.push(Math.round((retained / cohortSize) * 100));
            }
        }

        return {
            cohortMonth: cohortKey,
            cohortLabel: monthLabel(cohortKey),
            cohortSize,
            retention,
        };
    });

    // ── 12. Feature adoption ─────────────────────────────────────────────────

    const usersWithProjects = new Set(safeProjects.map((p) => p.user_id));

    const usersWithBrief = new Set(
        safeProjects.filter((p) => p.brief_completed === true).map((p) => p.user_id)
    );

    const projectsWithEstimates = new Set(safeEstimates.map((e) => e.project_id));
    const usersWithEstimate = new Set(
        safeProjects.filter((p) => projectsWithEstimates.has(p.id)).map((p) => p.user_id)
    );

    const usersWithContracts = new Set(
        safeProjects
            .filter(
                (p) =>
                    Array.isArray(p.contract_review_flags) &&
                    p.contract_review_flags.length > 0
            )
            .map((p) => p.user_id)
    );

    const usersWithProposals = new Set(
        safeProjects
            .filter((p) => p.proposal_status && p.proposal_status !== "draft")
            .map((p) => p.user_id)
    );

    const usersWithRisk = new Set(
        safeProjects
            .filter(
                (p) => Array.isArray(p.risk_register) && p.risk_register.length > 0
            )
            .map((p) => p.user_id)
    );

    const usersWithClosing = new Set(
        safeProjects
            .filter(
                (p) =>
                    p.closing_statement !== null &&
                    p.closing_statement !== undefined &&
                    p.closing_statement !== ""
            )
            .map((p) => p.user_id)
    );

    const adoptionBase = totalSubscribers || 1;
    const featureAdoption: FeatureAdoptionRow[] = [
        {
            feature: "Brief AI",
            icon: "FileText",
            usersCount: usersWithBrief.size,
            pct: (usersWithBrief.size / adoptionBase) * 100,
        },
        {
            feature: "Estimating",
            icon: "Calculator",
            usersCount: usersWithEstimate.size,
            pct: (usersWithEstimate.size / adoptionBase) * 100,
        },
        {
            feature: "Programme",
            icon: "Calendar",
            usersCount: usersWithProjects.size,
            pct: (usersWithProjects.size / adoptionBase) * 100,
        },
        {
            feature: "Contracts",
            icon: "FileCheck",
            usersCount: usersWithContracts.size,
            pct: (usersWithContracts.size / adoptionBase) * 100,
        },
        {
            feature: "Proposals",
            icon: "Send",
            usersCount: usersWithProposals.size,
            pct: (usersWithProposals.size / adoptionBase) * 100,
        },
        {
            feature: "AI Contract Review",
            icon: "ShieldCheck",
            usersCount: usersWithContracts.size,
            pct: (usersWithContracts.size / adoptionBase) * 100,
        },
        {
            feature: "Risk Register",
            icon: "AlertTriangle",
            usersCount: usersWithRisk.size,
            pct: (usersWithRisk.size / adoptionBase) * 100,
        },
        {
            feature: "Closing Statement AI",
            icon: "CheckSquare",
            usersCount: usersWithClosing.size,
            pct: (usersWithClosing.size / adoptionBase) * 100,
        },
    ];

    // ── 13. Proposal funnel ──────────────────────────────────────────────────

    const totalProjects = safeProjects.length;
    const totalEstimates = safeEstimates.length;

    const proposalsSent = safeProjects.filter(
        (p) => p.proposal_status && p.proposal_status !== "draft"
    ).length;

    const proposalsViewed = safeProjects.filter(
        (p) => p.proposal_status === "viewed" || p.proposal_status === "accepted"
    ).length;

    const proposalsAccepted = safeProjects.filter(
        (p) => p.proposal_status === "accepted"
    ).length;

    const totalProposalsSent = proposalsSent;
    const totalProposalsAccepted = proposalsAccepted;

    const acceptanceRate =
        proposalsSent > 0 ? (proposalsAccepted / proposalsSent) * 100 : 0;
    const viewRate =
        proposalsSent > 0 ? (proposalsViewed / proposalsSent) * 100 : 0;

    // Projects by month (last 13 months)
    const projectsByMonthCounts = new Map<string, number>();
    for (const p of safeProjects) {
        const key = toMonthKey(p.created_at);
        if (monthKeys.includes(key)) {
            projectsByMonthCounts.set(key, (projectsByMonthCounts.get(key) ?? 0) + 1);
        }
    }
    const projectsByMonth: DataPoint[] = monthKeys.map((key) => ({
        label: monthLabel(key),
        key,
        value: projectsByMonthCounts.get(key) ?? 0,
    }));

    const avgProjectsPerUser = totalSubscribers > 0 ? totalProjects / totalSubscribers : 0;

    // ── 14. Geography ────────────────────────────────────────────────────────

    const regionCounts = new Map<string, number>();
    for (const p of safeProjects) {
        const region = (p.region as string | null) ?? "Unknown";
        regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
    }
    const projectsByRegion: GeoRow[] = Array.from(regionCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({
            label,
            count,
            pct: totalProjects > 0 ? (count / totalProjects) * 100 : 0,
        }));

    const countryCounts = new Map<string, number>();
    for (const p of safeProfiles) {
        const country = (p.country as string | null) ?? "Unknown";
        countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
    }
    const usersByCountry: GeoRow[] = Array.from(countryCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({
            label,
            count,
            pct: totalSubscribers > 0 ? (count / totalSubscribers) * 100 : 0,
        }));

    const totalWithGeo = safeProjects.filter(
        (p) => p.lat !== null && p.lng !== null
    ).length;

    // ── 15. Costs ────────────────────────────────────────────────────────────

    const manualCosts = safeAdminCosts.map((c) => ({
        id: String(c.id),
        month: String(c.month),
        category: String(c.category),
        description: c.description ? String(c.description) : null,
        amount_gbp: Number(c.amount_gbp),
    }));

    const currentMonthIso = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const currentMonthManualCosts = manualCosts
        .filter((c) => c.month.startsWith(currentMonthIso))
        .reduce((sum, c) => sum + c.amount_gbp, 0);

    const totalMonthlyCostGbp = currentMonthManualCosts + openaiResult.mtdCostGbp;

    const grossMarginPct =
        mrr > 0 ? ((mrr - totalMonthlyCostGbp) / mrr) * 100 : 0;

    const costPerUserGbp =
        totalSubscribers > 0 ? totalMonthlyCostGbp / totalSubscribers : 0;

    // ── 16. Rule of 40 ───────────────────────────────────────────────────────

    const ruleOf40Score: number | null =
        mrr > 0 && momGrowthPct !== null ? momGrowthPct + grossMarginPct : null;

    // ── 17. Website — compute conversion rate ────────────────────────────────

    const website: PlausibleMetrics = {
        ...plausibleResult,
        signupConversionRate:
            plausibleResult.visitors30d > 0
                ? (signupsThisMonth / plausibleResult.visitors30d) * 100
                : 0,
    };

    // ── 18. Assemble AdminData ────────────────────────────────────────────────

    const data: AdminData = {
        subscribers,
        totalSubscribers,

        signupsToday,
        signupsThisWeek,
        signupsThisMonth,
        signupsThisQuarter,
        signupsThisYear,
        signupsPrevMonth,

        dailySignups,
        weeklySignups,
        monthlySignups,

        revenue: {
            mrr,
            arr,
            arpu,
            ltv,
            mrrByMonth,
            momGrowthPct,
            qoqGrowthPct,
            yoyGrowthPct,
            projectedArrEoy,
        },

        retention: {
            dau,
            wau,
            mau,
            mauPrev,
            stickiness,
            churnRate,
            churnedThisMonth,
            activationRate,
            atRiskUsers,
            cohorts,
        },

        engagement: {
            proposalFunnel: {
                projects: totalProjects,
                estimatesCreated: totalEstimates,
                proposalsSent,
                proposalsViewed,
                proposalsAccepted,
            },
            featureAdoption,
            aiUsage: {
                briefsGenerated: usersWithBrief.size,
                contractsReviewed: usersWithContracts.size,
                closingStatements: usersWithClosing.size,
                riskRegisters: usersWithRisk.size,
            },
            avgProjectsPerUser,
            acceptanceRate,
            viewRate,
            projectsByMonth,
        },

        geography: {
            projectsByRegion,
            usersByCountry,
            totalWithGeo,
        },

        costs: {
            manualCosts,
            openaiMtdCostGbp: openaiResult.mtdCostGbp,
            openaiDailyCosts: openaiResult.dailyCosts,
            totalMonthlyCostGbp,
            grossMarginPct,
            costPerUserGbp,
        },

        website,

        totalProjects,
        totalEstimates,
        totalProposalsSent,
        totalProposalsAccepted,

        ruleOf40Score,
        ltvCacRatio: null,
        cacPaybackMonths: null,
        burnMultiple: null,
    };

    return <AdminClient data={data} />;
}
