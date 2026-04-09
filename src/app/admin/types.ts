// ─── Constructa Admin BI — Shared Types ──────────────────────────────────────

export const PLAN_PRICE_GBP = 49; // Monthly plan price — update when Stripe goes live
export const PLAN_NAME = "Starter";

// ─── Subscriber ───────────────────────────────────────────────────────────────
export type ActivationStatus = "activated" | "at_risk" | "churned" | "new";

export interface SubscriberRow {
    id: string;
    email: string | null;
    company_name: string | null;
    country: string | null;
    signup_source: string | null;
    created_at: string;
    last_sign_in_at: string | null;
    project_count: number;
    estimate_count: number;
    proposals_sent: number;
    proposals_accepted: number;
    contracts_reviewed: number;
    has_brief: boolean;
    last_active: string | null;
    is_active_30d: boolean;
    is_active_7d: boolean;
    days_since_signup: number;
    activation_status: ActivationStatus;
}

// ─── Time-series data ─────────────────────────────────────────────────────────
export interface DataPoint {
    label: string;   // display label (e.g. "Jan 24", "Mon", "12 Apr")
    key: string;     // sort key (e.g. "2024-01")
    value: number;
}

// ─── Revenue ──────────────────────────────────────────────────────────────────
export interface MrrMonth {
    month: string;       // "2024-01"
    label: string;       // "Jan 24"
    cumulativeUsers: number;
    newUsers: number;
    mrr: number;
    newMrr: number;
    churnedMrr: number;
    netNewMrr: number;
}

export interface RevenueMetrics {
    mrr: number;
    arr: number;
    arpu: number;
    ltv: number;
    mrrByMonth: MrrMonth[];
    momGrowthPct: number | null;   // month-on-month growth
    qoqGrowthPct: number | null;
    yoyGrowthPct: number | null;
    projectedArrEoy: number;       // projected ARR end-of-year at current growth
}

// ─── Engagement ───────────────────────────────────────────────────────────────
export interface ProposalFunnel {
    projects: number;
    estimatesCreated: number;
    proposalsSent: number;
    proposalsViewed: number;
    proposalsAccepted: number;
}

export interface FeatureAdoptionRow {
    feature: string;
    icon: string;
    usersCount: number;
    pct: number;
}

export interface EngagementMetrics {
    proposalFunnel: ProposalFunnel;
    featureAdoption: FeatureAdoptionRow[];
    aiUsage: {
        briefsGenerated: number;
        contractsReviewed: number;
        closingStatements: number;
        riskRegisters: number;
    };
    avgProjectsPerUser: number;
    acceptanceRate: number;      // proposals accepted / sent %
    viewRate: number;            // proposals viewed / sent %
    projectsByMonth: DataPoint[];
}

// ─── Retention / Churn ────────────────────────────────────────────────────────
export interface CohortRow {
    cohortMonth: string;   // "2024-01"
    cohortLabel: string;   // "Jan 24"
    cohortSize: number;
    retention: (number | null)[];  // % at M+0, M+1, M+2 … M+11
}

export interface RetentionMetrics {
    dau: number;
    wau: number;
    mau: number;
    mauPrev: number;
    stickiness: number;            // DAU/MAU %
    churnRate: number;             // monthly logo churn %
    churnedThisMonth: number;
    activationRate: number;        // % who created a project
    atRiskUsers: SubscriberRow[];  // signed up >7d, no project OR inactive 14d+
    cohorts: CohortRow[];
}

// ─── Geography ────────────────────────────────────────────────────────────────
export interface GeoRow {
    label: string;
    count: number;
    pct: number;
}

export interface GeographyMetrics {
    projectsByRegion: GeoRow[];
    usersByCountry: GeoRow[];
    totalWithGeo: number;
}

// ─── Costs ────────────────────────────────────────────────────────────────────
export interface CostEntry {
    id: string;
    month: string;       // "2024-01-01" ISO date
    category: string;
    description: string | null;
    amount_gbp: number;
}

export interface OpenAIUsageDay {
    date: string;
    cost_usd: number;
    cost_gbp: number;
    requests: number;
}

export interface CostMetrics {
    manualCosts: CostEntry[];
    openaiMtdCostGbp: number;
    openaiDailyCosts: OpenAIUsageDay[];
    totalMonthlyCostGbp: number;
    grossMarginPct: number;
    costPerUserGbp: number;
}

// ─── Website (Plausible) ──────────────────────────────────────────────────────
export interface PlausibleMetrics {
    available: boolean;
    visitors30d: number;
    pageviews30d: number;
    bounceRate: number;
    visitDuration: number;   // seconds
    signupConversionRate: number;  // visitors → signups %
    topPages: Array<{ page: string; visitors: number }>;
    topSources: Array<{ source: string; visitors: number }>;
}

// ─── Benchmarks ───────────────────────────────────────────────────────────────
export interface BenchmarkRow {
    project_type: string | null;
    contract_value_band: string | null;
    count: number;
    avg_gross_margin_pct: number | null;
    avg_variation_rate_pct: number | null;
    avg_programme_delay_days: number | null;
    avg_subcontract_cost_pct: number | null;
    pct_delivered_on_time: number | null;
}

export interface BenchmarkMetrics {
    totalContributions: number;
    consentedContractors: number;
    rows: BenchmarkRow[];           // grouped by type + band
    avgMarginAll: number | null;
    avgDelayAll: number | null;
}

// ─── Intelligence ─────────────────────────────────────────────────────────────
export interface AtRiskDetail {
    id: string;
    email: string | null;
    company_name: string | null;
    created_at: string;
    last_active: string | null;
    days_since_signup: number;
    project_count: number;
    risk_reason: string;
    risk_score: number;   // 1–3: 1=low, 2=medium, 3=high
}

export interface FeatureUsageRow {
    feature: string;
    icon: string;
    users: number;
    pct: number;
    trend: "up" | "flat" | "down";
}

export interface IntelligenceMetrics {
    atRisk: AtRiskDetail[];
    featureHeatmap: FeatureUsageRow[];
    platformHealth: {
        activationRate: number;       // % who created ≥1 project
        proposalConversionRate: number;
        avgTimeToFirstProject: number; // days
        powerUsers: number;           // ≥3 projects in last 30d
    };
}

// ─── Full admin data ──────────────────────────────────────────────────────────
export interface AdminData {
    // Core subscriber list
    subscribers: SubscriberRow[];
    totalSubscribers: number;

    // Signup counts
    signupsToday: number;
    signupsThisWeek: number;
    signupsThisMonth: number;
    signupsThisQuarter: number;
    signupsThisYear: number;
    signupsPrevMonth: number;

    // Time-series
    dailySignups: DataPoint[];    // last 30 days
    weeklySignups: DataPoint[];   // last 12 weeks
    monthlySignups: DataPoint[];  // last 13 months

    // Revenue
    revenue: RevenueMetrics;

    // Retention
    retention: RetentionMetrics;

    // Engagement
    engagement: EngagementMetrics;

    // Geography
    geography: GeographyMetrics;

    // Costs
    costs: CostMetrics;

    // Website
    website: PlausibleMetrics;

    // Summary platform counts
    totalProjects: number;
    totalEstimates: number;
    totalProposalsSent: number;
    totalProposalsAccepted: number;

    // Investor KPIs
    ruleOf40Score: number | null;    // growth% + margin% (null if no revenue yet)
    ltvCacRatio: number | null;
    cacPaybackMonths: number | null;
    burnMultiple: number | null;

    // Sprint 43
    benchmarks: BenchmarkMetrics;
    intelligence: IntelligenceMetrics;
}
