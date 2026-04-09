"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminData } from "./types";
import OverviewTab from "./tabs/overview-tab";
import RevenueTab from "./tabs/revenue-tab";
import GrowthTab from "./tabs/growth-tab";
import RetentionTab from "./tabs/retention-tab";
import EngagementTab from "./tabs/engagement-tab";
import GeographyTab from "./tabs/geography-tab";
import CostsTab from "./tabs/costs-tab";
import WebsiteTab from "./tabs/website-tab";
import ReportsTab from "./tabs/reports-tab";
import BenchmarksTab from "./tabs/benchmarks-tab";
import IntelligenceTab from "./tabs/intelligence-tab";

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
    { id: "overview",      label: "Overview",      icon: "⚡" },
    { id: "revenue",       label: "Revenue & P&L", icon: "💰" },
    { id: "growth",        label: "Growth",        icon: "📈" },
    { id: "retention",     label: "Retention",     icon: "🔄" },
    { id: "engagement",    label: "Engagement",    icon: "🛠" },
    { id: "geography",     label: "Geography",     icon: "🌍" },
    { id: "costs",         label: "Costs",         icon: "💸" },
    { id: "website",       label: "Website",       icon: "🌐" },
    { id: "benchmarks",    label: "Benchmarks",    icon: "📊" },
    { id: "intelligence",  label: "Intelligence",  icon: "🧠" },
    { id: "reports",       label: "Reports",       icon: "📄" },
] as const;

type TabId = typeof TABS[number]["id"];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminClient({ data }: { data: AdminData }) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabId>("overview");

    const now = new Date();
    const refreshedTime = now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        <div className="space-y-0">
            {/* ── Tab bar ── */}
            <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950">
                <div className="flex items-center justify-between px-4 pt-3 pb-0">
                    {/* Scrollable tab row */}
                    <div className="flex min-w-0 overflow-x-auto scrollbar-none gap-0">
                        {TABS.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={[
                                        "flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors",
                                        "border-b-2 focus:outline-none",
                                        isActive
                                            ? "border-amber-500 text-amber-400"
                                            : "border-transparent text-zinc-400 hover:text-zinc-200",
                                    ].join(" ")}
                                >
                                    <span>{tab.icon}</span>
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Right side: last refreshed + refresh link */}
                    <div className="ml-4 flex shrink-0 items-center gap-3 pb-2.5 text-xs text-zinc-500">
                        <span>Data as of {refreshedTime}</span>
                        <button
                            onClick={() => router.refresh()}
                            className="flex items-center gap-1 rounded px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                        >
                            ↻ Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Tab content ── */}
            <div className="p-4 md:p-6">
                {activeTab === "overview"     && <OverviewTab     data={data} />}
                {activeTab === "revenue"      && <RevenueTab      data={data} />}
                {activeTab === "growth"       && <GrowthTab       data={data} />}
                {activeTab === "retention"    && <RetentionTab    data={data} />}
                {activeTab === "engagement"   && <EngagementTab   data={data} />}
                {activeTab === "geography"    && <GeographyTab    data={data} />}
                {activeTab === "costs"        && <CostsTab        data={data} />}
                {activeTab === "website"      && <WebsiteTab      data={data} />}
                {activeTab === "benchmarks"   && <BenchmarksTab   data={data} />}
                {activeTab === "intelligence" && <IntelligenceTab data={data} />}
                {activeTab === "reports"      && <ReportsTab      data={data} />}
            </div>
        </div>
    );
}
