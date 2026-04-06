"use client";

import { useState } from "react";
import type { AdminData } from "../types";
import { PLAN_PRICE_GBP } from "../types";
import { sendReportEmailAction } from "../actions";

interface Props {
  data: AdminData;
}

type ReportType = "daily" | "weekly" | "monthly" | "quarterly" | "annual";

const REPORT_TYPES: { key: ReportType; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
  { key: "annual", label: "Annual" },
];

function fmtGBP(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function pct(n: number | null | undefined, digits = 1) {
  if (n == null) return "N/A";
  return `${n.toFixed(digits)}%`;
}

function todayStr() {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function weekOfStr() {
  const d = new Date();
  const startOfWeek = new Date(d);
  startOfWeek.setDate(d.getDate() - d.getDay() + 1);
  return startOfWeek.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function currentMonthStr() {
  return new Date().toLocaleString("en-GB", { month: "long", year: "numeric" });
}

function currentQuarterStr() {
  const m = new Date().getMonth();
  const q = Math.floor(m / 3) + 1;
  return `Q${q} ${new Date().getFullYear()}`;
}

function currentYearStr() {
  return String(new Date().getFullYear());
}

function generateDailyReport(data: AdminData): string {
  const { revenue, costs, retention, engagement } = data;
  const openaiToday =
    costs.openaiDailyCosts[costs.openaiDailyCosts.length - 1]?.cost_gbp ?? 0;
  const aiCallsToday =
    (engagement.aiUsage.briefsGenerated ?? 0) / 30; // rough daily estimate

  const redMetrics: string[] = [];
  if (retention.churnRate > 5) redMetrics.push(`Churn rate elevated: ${retention.churnRate.toFixed(1)}%`);
  if (retention.atRiskUsers.length > 0)
    redMetrics.push(`${retention.atRiskUsers.length} at-risk users`);
  if (revenue.mrr === 0) redMetrics.push("No MRR yet — billing not live");

  return `📊 Constructa Daily Digest — ${todayStr()}

SUBSCRIBERS
Total: ${data.totalSubscribers} | New today: ${data.signupsToday} | Active (DAU): ${retention.dau}

REVENUE
MRR: ${fmtGBP(revenue.mrr)} | ARR: ${fmtGBP(revenue.arr)}

PLATFORM ACTIVITY
Projects created today: ~${Math.round(data.totalProjects / 30)}
AI calls today: ~${Math.round(aiCallsToday)}
OpenAI spend today: £${openaiToday.toFixed(2)}

ALERTS
${redMetrics.length > 0 ? redMetrics.map((m) => `• ${m}`).join("\n") : "All clear ✅"}`;
}

function generateWeeklyReport(data: AdminData): string {
  const { revenue, retention, engagement } = data;
  const prevWeekSignups = Math.round(data.signupsThisMonth / 4);
  const signupChangePct =
    prevWeekSignups > 0
      ? (((data.signupsThisWeek - prevWeekSignups) / prevWeekSignups) * 100).toFixed(1)
      : "N/A";

  const atRiskList =
    retention.atRiskUsers.length > 0
      ? retention.atRiskUsers
          .slice(0, 10)
          .map(
            (u) =>
              `• ${u.company_name ?? u.email ?? u.id} — ${u.activation_status}`
          )
          .join("\n")
      : "• None this week";

  return `📈 Constructa Weekly Report — Week of ${weekOfStr()}

GROWTH
New signups this week: ${data.signupsThisWeek} (vs ~${prevWeekSignups} last week: ${signupChangePct !== "N/A" ? `+${signupChangePct}%` : "N/A"})
Cumulative subscribers: ${data.totalSubscribers}

REVENUE
MRR: ${fmtGBP(revenue.mrr)} | New MRR this week: ${fmtGBP(Math.round(data.signupsThisWeek * PLAN_PRICE_GBP))}
MoM growth: ${pct(revenue.momGrowthPct)}

ENGAGEMENT
WAU: ${retention.wau} | Proposals sent this week: ~${Math.round(data.totalProposalsSent / 52)}
Acceptance rate: ${pct(engagement.acceptanceRate)}

AT-RISK USERS: ${retention.atRiskUsers.length} users need attention

TOP ACTIONS NEEDED:
${atRiskList}`;
}

function generateMonthlyReport(data: AdminData): string {
  const { revenue, costs, retention, engagement, geography } = data;

  const featureAdoptionLines = engagement.featureAdoption
    .map((f) => `  ${f.icon} ${f.feature}: ${f.usersCount} users (${f.pct.toFixed(0)}%)`)
    .join("\n");

  const topCountries = geography.usersByCountry
    .slice(0, 5)
    .map((g) => `  ${g.label}: ${g.count} (${g.pct.toFixed(0)}%)`)
    .join("\n");

  return `📅 Constructa Monthly Report — ${currentMonthStr()}

═══ P&L SUMMARY ═══
Revenue (MRR):           ${fmtGBP(revenue.mrr)}
Cost of Revenue (COGS):  £${costs.totalMonthlyCostGbp.toFixed(0)}
Gross Profit:            ${fmtGBP(revenue.mrr - costs.totalMonthlyCostGbp)} (${costs.grossMarginPct.toFixed(0)}% margin)
EBITDA (est.):           ${fmtGBP(revenue.mrr - costs.totalMonthlyCostGbp)}

═══ SAAS METRICS ═══
MRR:              ${fmtGBP(revenue.mrr)}
ARR:              ${fmtGBP(revenue.arr)}
ARPU:             ${fmtGBP(revenue.arpu)}
LTV (est.):       ${fmtGBP(revenue.ltv)}
MoM Growth:       ${pct(revenue.momGrowthPct)}
Churn Rate:       ${pct(retention.churnRate)}

═══ SUBSCRIBERS ═══
Total:            ${data.totalSubscribers}
New this month:   ${data.signupsThisMonth}
MAU:              ${retention.mau}
DAU:              ${retention.dau}
Stickiness:       ${pct(retention.stickiness)} (DAU/MAU)
Activation Rate:  ${pct(retention.activationRate)}
At-Risk Users:    ${retention.atRiskUsers.length}

═══ COHORT SUMMARY ═══
${retention.cohorts.slice(-3).map((c) => `  ${c.cohortLabel}: ${c.cohortSize} users, M+1 retention: ${c.retention[1] != null ? `${c.retention[1]?.toFixed(0)}%` : "—"}`).join("\n") || "  No cohort data yet"}

═══ FEATURE ADOPTION ═══
${featureAdoptionLines || "  No data yet"}

═══ GEOGRAPHY ═══
Top countries:
${topCountries || "  No data yet"}

═══ ENGAGEMENT ═══
Total projects:      ${data.totalProjects}
Proposals sent:      ${data.totalProposalsSent}
Proposals accepted:  ${data.totalProposalsAccepted}
Acceptance rate:     ${pct(engagement.acceptanceRate)}
AI: Briefs generated: ${engagement.aiUsage.briefsGenerated} | Contracts reviewed: ${engagement.aiUsage.contractsReviewed}`;
}

function generateQuarterlyReport(data: AdminData): string {
  const { revenue, costs, retention } = data;

  return `📊 Constructa Quarterly Report — ${currentQuarterStr()}

═══ INVESTOR KPIs ═══
Rule of 40 Score:       ${data.ruleOf40Score != null ? data.ruleOf40Score.toFixed(0) : "N/A"}
LTV:CAC Ratio:          ${data.ltvCacRatio != null ? data.ltvCacRatio.toFixed(1) + "x" : "N/A"}
CAC Payback (months):   ${data.cacPaybackMonths != null ? data.cacPaybackMonths.toFixed(0) : "N/A"}
Burn Multiple:          ${data.burnMultiple != null ? data.burnMultiple.toFixed(2) + "x" : "N/A"}

═══ REVENUE (QoQ) ═══
Current MRR:         ${fmtGBP(revenue.mrr)}
Current ARR:         ${fmtGBP(revenue.arr)}
QoQ Growth:          ${pct(revenue.qoqGrowthPct)}
Projected ARR (EoY): ${fmtGBP(revenue.projectedArrEoy)}

═══ UNIT ECONOMICS ═══
ARPU:             ${fmtGBP(revenue.arpu)}
LTV (est.):       ${fmtGBP(revenue.ltv)}
Gross Margin:     ${pct(costs.grossMarginPct)}
Cost per User:    £${costs.costPerUserGbp.toFixed(2)}

═══ RETENTION ═══
MAU:              ${retention.mau} (prev: ${retention.mauPrev})
Churn Rate:       ${pct(retention.churnRate)}
Activation Rate:  ${pct(retention.activationRate)}
Stickiness:       ${pct(retention.stickiness)}

═══ GROWTH ═══
New subscribers (quarter): ${data.signupsThisQuarter}
Total subscribers:         ${data.totalSubscribers}

═══ SCALE ═══
Total projects:      ${data.totalProjects}
Total proposals:     ${data.totalProposalsSent}
AI usage — Briefs: ${data.engagement.aiUsage.briefsGenerated} | Contracts: ${data.engagement.aiUsage.contractsReviewed}

Note: Rule of 40 = revenue growth % + profit margin %. Score ≥ 40 is healthy for SaaS.`;
}

function generateAnnualReport(data: AdminData): string {
  const { revenue, costs, retention } = data;

  return `📗 Constructa Annual Review — ${currentYearStr()}

═══ EXECUTIVE SUMMARY ═══
Constructa ended the year with ${data.totalSubscribers} total subscribers,
${fmtGBP(revenue.mrr)} MRR, and ${fmtGBP(revenue.arr)} ARR.
YoY growth: ${pct(revenue.yoyGrowthPct)}.

═══ REVENUE ═══
Current MRR:         ${fmtGBP(revenue.mrr)}
ARR:                 ${fmtGBP(revenue.arr)}
ARPU:                ${fmtGBP(revenue.arpu)}
YoY MRR Growth:      ${pct(revenue.yoyGrowthPct)}
Projected ARR (EoY): ${fmtGBP(revenue.projectedArrEoy)}

═══ GROWTH ═══
New subscribers this year: ${data.signupsThisYear}
Total subscribers:         ${data.totalSubscribers}

═══ UNIT ECONOMICS ═══
LTV (est.):       ${fmtGBP(revenue.ltv)}
LTV:CAC:          ${data.ltvCacRatio != null ? data.ltvCacRatio.toFixed(1) + "x" : "N/A"}
Gross Margin:     ${pct(costs.grossMarginPct)}

═══ RETENTION ═══
Avg Monthly Churn: ${pct(retention.churnRate)}
Activation Rate:   ${pct(retention.activationRate)}
Stickiness:        ${pct(retention.stickiness)}

═══ INVESTOR SCORECARD ═══
Rule of 40:     ${data.ruleOf40Score != null ? data.ruleOf40Score.toFixed(0) : "N/A"} ${data.ruleOf40Score != null && data.ruleOf40Score >= 40 ? "✅ Healthy" : data.ruleOf40Score != null ? "⚠️ Below threshold" : ""}
Burn Multiple:  ${data.burnMultiple != null ? data.burnMultiple.toFixed(2) + "x" : "N/A"} ${data.burnMultiple != null && data.burnMultiple < 1 ? "✅ Efficient" : data.burnMultiple != null ? "⚠️ Review burn" : ""}

═══ PLATFORM SCALE ═══
Total projects:         ${data.totalProjects}
Total proposals sent:   ${data.totalProposalsSent}
Total accepted:         ${data.totalProposalsAccepted}
AI briefs generated:    ${data.engagement.aiUsage.briefsGenerated}
Contracts reviewed:     ${data.engagement.aiUsage.contractsReviewed}

═══ STRATEGIC SUMMARY ═══
Constructa has established product-market fit in the UK construction SME sector.
Key priorities for ${Number(currentYearStr()) + 1}:
  • Convert free-tier pipeline to paid subscriptions
  • Expand enterprise / team plan features
  • Grow MRR to £${(revenue.mrr * 12).toLocaleString("en-GB")} ARR target via organic and paid acquisition
  • Maintain gross margin above 70%`;
}

function subjectForReport(type: ReportType): string {
  const map: Record<ReportType, string> = {
    daily: `Constructa Daily Digest — ${todayStr()}`,
    weekly: `Constructa Weekly Report — Week of ${weekOfStr()}`,
    monthly: `Constructa Monthly Report — ${currentMonthStr()}`,
    quarterly: `Constructa Quarterly Report — ${currentQuarterStr()}`,
    annual: `Constructa Annual Review — ${currentYearStr()}`,
  };
  return map[type];
}

export default function ReportsTab({ data }: Props) {
  const [selectedReport, setSelectedReport] = useState<ReportType>("daily");
  const [emailTo, setEmailTo] = useState(data.website?.available ? "" : "");
  const [emailStatus, setEmailStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [emailError, setEmailError] = useState<string | null>(null);

  const reportText = (() => {
    switch (selectedReport) {
      case "daily":
        return generateDailyReport(data);
      case "weekly":
        return generateWeeklyReport(data);
      case "monthly":
        return generateMonthlyReport(data);
      case "quarterly":
        return generateQuarterlyReport(data);
      case "annual":
        return generateAnnualReport(data);
    }
  })();

  async function handleSendEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEmailStatus("sending");
    setEmailError(null);

    const fd = new FormData();
    fd.set("to", emailTo);
    fd.set("subject", subjectForReport(selectedReport));
    fd.set("body", reportText);

    const result = await sendReportEmailAction(fd);
    if (result.success) {
      setEmailStatus("success");
      setTimeout(() => setEmailStatus("idle"), 4000);
    } else {
      setEmailStatus("error");
      setEmailError(result.error ?? "Failed to send email");
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Report Type Selector ── */}
      <div className="flex gap-1 rounded-lg bg-zinc-800 border border-zinc-700 p-1 w-fit">
        {REPORT_TYPES.map((rt) => (
          <button
            key={rt.key}
            onClick={() => setSelectedReport(rt.key)}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
              selectedReport === rt.key
                ? "bg-zinc-600 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {rt.label}
          </button>
        ))}
      </div>

      {/* ── Generated Report ── */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-700 bg-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-300">
            {REPORT_TYPES.find((r) => r.key === selectedReport)?.label} Report
          </h3>
          <button
            onClick={() => window.print()}
            className="text-xs px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
          >
            🖨️ Print / Save as PDF
          </button>
        </div>
        <div className="overflow-auto max-h-[60vh] p-5">
          <pre className="text-sm text-zinc-200 font-mono whitespace-pre-wrap leading-relaxed">
            {reportText}
          </pre>
        </div>
      </div>

      {/* ── Export & Email Section ── */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">
          Email Report
        </h3>
        <form onSubmit={handleSendEmail} className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400">
              To{" "}
              <span className="text-zinc-600">(comma-separated for multiple)</span>
            </label>
            <input
              type="text"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="robert@constructa.co, investor@example.com"
              required
              className="rounded-md bg-zinc-700 border border-zinc-600 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-zinc-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400">Subject</label>
            <input
              type="text"
              value={subjectForReport(selectedReport)}
              readOnly
              className="rounded-md bg-zinc-800 border border-zinc-700 text-zinc-400 px-3 py-2 text-sm cursor-default"
            />
          </div>
          {emailError && (
            <p className="text-xs text-red-400">{emailError}</p>
          )}
          {emailStatus === "success" && (
            <p className="text-xs text-emerald-400">
              Report sent successfully.
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={emailStatus === "sending"}
              className="text-sm px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium transition-colors"
            >
              {emailStatus === "sending" ? "Sending…" : "📧 Send Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
