"use client";

import type { AdminData } from "../types";
import BarChart from "../components/bar-chart";

interface Props {
    data: AdminData;
}

const FLAG_MAP: Record<string, string> = {
    UK: "🇬🇧",
    "United Kingdom": "🇬🇧",
    GB: "🇬🇧",
    US: "🇺🇸",
    "United States": "🇺🇸",
    IE: "🇮🇪",
    Ireland: "🇮🇪",
    AU: "🇦🇺",
    Australia: "🇦🇺",
    CA: "🇨🇦",
    Canada: "🇨🇦",
    DE: "🇩🇪",
    Germany: "🇩🇪",
    FR: "🇫🇷",
    France: "🇫🇷",
};

function countryFlag(name: string): string {
    return FLAG_MAP[name] ?? "🌐";
}

export default function GeographyTab({ data }: Props) {
    const geo = data.geography;

    // Derived counts
    const distinctRegions = geo.projectsByRegion.filter((r) => r.count > 0).length;
    const distinctCountries = geo.usersByCountry.filter((c) => c.count > 0).length;

    const topRegions = [...geo.projectsByRegion]
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    const hasCountryData = geo.usersByCountry.some((c) => c.count > 0);

    const totalProjects = topRegions.reduce((sum, r) => sum + r.count, 0) || 1;

    // UK % of signups
    const ukUsers =
        geo.usersByCountry.find(
            (c) => c.label === "UK" || c.label === "United Kingdom" || c.label === "GB"
        )?.count ?? 0;
    const ukPct =
        data.totalSubscribers > 0
            ? Math.round((ukUsers / data.totalSubscribers) * 100)
            : 0;

    // Last 20 geolocated subscribers (proxy: those with a project + region data)
    // Geography raw data comes from projectsByRegion; we surface subscribers with geo
    const geoSubscribers = data.subscribers
        .filter((s) => s.project_count > 0)
        .slice(0, 20);

    return (
        <div className="space-y-8">

            {/* ── 1. Header cards ── */}
            <section>
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    Coverage Overview
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                        <div className="text-xs text-zinc-400 mb-1">Projects with Location Data</div>
                        <div className="text-3xl font-bold text-zinc-100">{geo.totalWithGeo}</div>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                        <div className="text-xs text-zinc-400 mb-1">UK Regions Covered</div>
                        <div className="text-3xl font-bold text-zinc-100">{distinctRegions}</div>
                        <div className="text-xs text-zinc-500 mt-1">distinct regions</div>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                        <div className="text-xs text-zinc-400 mb-1">Countries</div>
                        <div className="text-3xl font-bold text-zinc-100">{distinctCountries}</div>
                        <div className="text-xs text-zinc-500 mt-1">distinct countries</div>
                    </div>
                </div>
            </section>

            {/* ── 2. UK Regions ── */}
            <section>
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    UK Regions
                </h2>
                {topRegions.length === 0 ? (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 text-sm text-zinc-400">
                        No region data yet — will populate as projects are created with postcodes.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                        {/* Chart — 60% */}
                        <div className="lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                            <BarChart
                                data={topRegions.map((r) => ({
                                    label: r.label,
                                    value: r.count,
                                }))}
                                height={200}
                                color="bg-amber-500"
                            />
                        </div>

                        {/* Table — 40% */}
                        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-zinc-800">
                                        <th className="text-left text-zinc-400 font-medium px-4 py-2.5">Region</th>
                                        <th className="text-right text-zinc-400 font-medium px-4 py-2.5">Projects</th>
                                        <th className="text-right text-zinc-400 font-medium px-4 py-2.5">% of Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topRegions.map((r) => (
                                        <tr
                                            key={r.label}
                                            className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                                        >
                                            <td className="px-4 py-2 text-zinc-200 whitespace-nowrap">
                                                {r.label}
                                            </td>
                                            <td className="px-4 py-2 text-zinc-300 text-right tabular-nums">
                                                {r.count}
                                            </td>
                                            <td className="px-4 py-2 text-zinc-400 text-right tabular-nums">
                                                {r.pct.toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </section>

            {/* ── 3. Countries ── */}
            <section>
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    Countries
                </h2>
                {!hasCountryData ? (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 text-sm text-zinc-400">
                        🌍 Country tracking enabled — will populate as new users sign up. Existing users can be updated manually.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                        {/* Chart */}
                        <div className="lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                            <BarChart
                                data={geo.usersByCountry
                                    .filter((c) => c.count > 0)
                                    .sort((a, b) => b.count - a.count)
                                    .map((c) => ({
                                        label: `${countryFlag(c.label)} ${c.label}`,
                                        value: c.count,
                                    }))}
                                height={200}
                                color="bg-amber-500"
                            />
                        </div>

                        {/* Table */}
                        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-zinc-800">
                                        <th className="text-left text-zinc-400 font-medium px-4 py-2.5">Country</th>
                                        <th className="text-right text-zinc-400 font-medium px-4 py-2.5">Users</th>
                                        <th className="text-right text-zinc-400 font-medium px-4 py-2.5">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {geo.usersByCountry
                                        .filter((c) => c.count > 0)
                                        .sort((a, b) => b.count - a.count)
                                        .map((c) => (
                                            <tr
                                                key={c.label}
                                                className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                                            >
                                                <td className="px-4 py-2 text-zinc-200 whitespace-nowrap">
                                                    <span className="mr-1.5">
                                                        {countryFlag(c.label)}
                                                    </span>
                                                    {c.label}
                                                </td>
                                                <td className="px-4 py-2 text-zinc-300 text-right tabular-nums">
                                                    {c.count}
                                                </td>
                                                <td className="px-4 py-2 text-zinc-400 text-right tabular-nums">
                                                    {c.pct.toFixed(1)}%
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </section>

            {/* ── 4. Global Readiness ── */}
            <section>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
                    <div>
                        <h2 className="text-sm font-semibold text-zinc-300 mb-1">
                            Global Readiness
                        </h2>
                        <p className="text-sm text-zinc-400">
                            Constructa is designed to scale globally. Currently{" "}
                            <span className="text-zinc-200 font-semibold">{ukPct}%</span> of signups
                            are UK-based.
                        </p>
                    </div>
                    <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2 text-zinc-300">
                            <span className="mt-0.5">✅</span>
                            <span>Multi-currency ready (GBP primary, Stripe will handle FX)</span>
                        </li>
                        <li className="flex items-start gap-2 text-zinc-300">
                            <span className="mt-0.5">✅</span>
                            <span>Location captured on all projects (lat/lng)</span>
                        </li>
                        <li className="flex items-start gap-2 text-zinc-300">
                            <span className="mt-0.5">✅</span>
                            <span>Country tracking active on new signups</span>
                        </li>
                        <li className="flex items-start gap-2 text-zinc-500">
                            <span className="mt-0.5">⏳</span>
                            <span>International tax rules (VAT/GST) — Sprint 25+</span>
                        </li>
                        <li className="flex items-start gap-2 text-zinc-500">
                            <span className="mt-0.5">⏳</span>
                            <span>Multi-language support — roadmap</span>
                        </li>
                    </ul>
                </div>
            </section>

            {/* ── 5. Project location raw data ── */}
            <section>
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    Recent Geolocated Projects
                    <span className="ml-2 text-xs normal-case font-normal text-zinc-500">
                        Last 20
                    </span>
                </h2>
                {geoSubscribers.length === 0 ? (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 text-sm text-zinc-400">
                        No geolocated projects yet.
                    </div>
                ) : (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-x-auto">
                        <table className="w-full text-sm min-w-max">
                            <thead>
                                <tr className="border-b border-zinc-800">
                                    <th className="text-left text-zinc-400 font-medium px-4 py-2.5">Company</th>
                                    <th className="text-left text-zinc-400 font-medium px-4 py-2.5">Country</th>
                                    <th className="text-right text-zinc-400 font-medium px-4 py-2.5">Projects</th>
                                    <th className="text-left text-zinc-400 font-medium px-4 py-2.5">Signed Up</th>
                                </tr>
                            </thead>
                            <tbody>
                                {geoSubscribers.map((s) => (
                                    <tr
                                        key={s.id}
                                        className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                                    >
                                        <td className="px-4 py-2 text-zinc-200 whitespace-nowrap">
                                            {s.company_name ?? s.email ?? "—"}
                                        </td>
                                        <td className="px-4 py-2 text-zinc-300 whitespace-nowrap">
                                            {s.country ? (
                                                <>
                                                    <span className="mr-1.5">{countryFlag(s.country)}</span>
                                                    {s.country}
                                                </>
                                            ) : (
                                                <span className="text-zinc-600">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-zinc-300 text-right tabular-nums">
                                            {s.project_count}
                                        </td>
                                        <td className="px-4 py-2 text-zinc-400 whitespace-nowrap">
                                            {new Date(s.created_at).toLocaleDateString("en-GB", {
                                                day: "numeric",
                                                month: "short",
                                                year: "2-digit",
                                            })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
