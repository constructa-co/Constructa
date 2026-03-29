"use client";

import { useState } from "react";
import { acceptProposalAction } from "./actions";

interface Props {
    project: any;
    profile: any;
    companyName: string;
    token: string;
    isExpired: boolean;
    sentAt: string | null;
    totalWeeks: number | null;
    refCode: string;
    siteAddress: string;
}

function formatGBP(n: number): string {
    return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(d: Date): string {
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function AcceptanceClient({
    project,
    profile,
    companyName,
    token,
    isExpired,
    sentAt,
    totalWeeks,
    refCode,
    siteAddress,
}: Props) {
    const [accepted, setAccepted] = useState(!!project?.proposal_accepted_at);
    const [accepting, setAccepting] = useState(false);
    const [acceptedAt, setAcceptedAt] = useState<string | null>(project?.proposal_accepted_at || null);

    const handleAccept = async () => {
        setAccepting(true);
        const result = await acceptProposalAction(token, project.client_name || "");
        if (result?.success) {
            setAccepted(true);
            setAcceptedAt(new Date().toISOString());
        }
        setAccepting(false);
    };

    const sentDate = sentAt ? new Date(sentAt) : null;
    const validUntil = sentDate ? new Date(sentDate.getTime() + 30 * 86400000) : null;
    const contractValue = project?.potential_value;
    const paymentSchedule: any[] = project?.payment_schedule || [];
    const ganttPhases: any[] = project?.gantt_phases || [];
    const scopeText: string = project?.scope_text || "";
    const exclusionsText: string = project?.exclusions_text || "";
    const scopePreview = scopeText.length > 300 ? scopeText.substring(0, 300) + "..." : scopeText;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            {/* ── HEADER ── */}
            <header className="bg-slate-900 border-b border-slate-800">
                <div className="max-w-4xl mx-auto px-6 py-6">
                    <div className="flex items-center gap-4">
                        {profile?.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={profile.logo_url} alt={companyName} className="h-10 object-contain" />
                        ) : (
                            <div className="text-xl font-bold text-white tracking-tight">{companyName}</div>
                        )}
                        <div className="h-6 w-px bg-slate-700" />
                        <div className="text-sm text-slate-400 font-medium tracking-widest uppercase">
                            Proposal &amp; Fee Proposal
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

                {/* ── HERO ── */}
                <div className="space-y-4">
                    <h1 className="text-4xl font-bold text-white leading-tight">{project.name}</h1>
                    <p className="text-lg text-slate-400">
                        Prepared exclusively for{" "}
                        <span className="text-white font-semibold">{project.client_name || "You"}</span>
                    </p>
                    <div className="flex flex-wrap gap-3">
                        {sentDate && (
                            <span className="px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-400 font-medium">
                                Issued {formatDate(sentDate)}
                            </span>
                        )}
                        {validUntil && !isExpired && (
                            <span className="px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-400 font-medium">
                                Valid until {formatDate(validUntil)}
                            </span>
                        )}
                        <span className="px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-400 font-medium">
                            Ref: {refCode}
                        </span>
                    </div>
                </div>

                {/* ── KEY NUMBERS BAR ── */}
                <div className="grid sm:grid-cols-3 gap-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Contract Value</p>
                        {contractValue ? (
                            <p className="text-2xl font-bold text-white">{formatGBP(contractValue)}</p>
                        ) : (
                            <p className="text-lg font-semibold text-slate-500">To be confirmed</p>
                        )}
                        <p className="text-xs text-slate-600 mt-1">exc. VAT</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Estimated Start</p>
                        {project.start_date ? (
                            <p className="text-base font-bold text-white">
                                {formatDate(new Date(project.start_date))}
                            </p>
                        ) : (
                            <p className="text-lg font-semibold text-slate-500">To be agreed</p>
                        )}
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Project Duration</p>
                        {totalWeeks ? (
                            <p className="text-2xl font-bold text-white">{totalWeeks} weeks</p>
                        ) : (
                            <p className="text-lg font-semibold text-slate-500">To be agreed</p>
                        )}
                    </div>
                </div>

                {/* ── SCOPE PREVIEW ── */}
                {scopePreview && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">Scope of Works</h2>
                        <p className="text-slate-300 text-sm leading-relaxed">{scopePreview}</p>
                        {scopeText.length > 300 && (
                            <p className="text-xs text-slate-500 mt-3 italic">Full scope included in the proposal document.</p>
                        )}
                    </div>
                )}

                {/* ── PAYMENT SCHEDULE ── */}
                {paymentSchedule.length > 0 && contractValue && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                        <div className="px-6 py-4 bg-slate-800/60 border-b border-slate-700">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Payment Schedule</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-800">
                                        <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Stage</th>
                                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 hidden sm:table-cell">When</th>
                                        <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">%</th>
                                        <th className="text-right px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paymentSchedule.map((row: any, i: number) => {
                                        const amount = contractValue * row.percentage / 100;
                                        return (
                                            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                                                <td className="px-6 py-3.5 font-semibold text-slate-200">{row.stage}</td>
                                                <td className="px-4 py-3.5 text-slate-400 hidden sm:table-cell">{row.description}</td>
                                                <td className="px-4 py-3.5 text-right text-slate-400">{row.percentage}%</td>
                                                <td className="px-6 py-3.5 text-right font-bold text-white tabular-nums">{formatGBP(amount)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── TIMELINE ── */}
                {ganttPhases.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                        <div className="px-6 py-4 bg-slate-800/60 border-b border-slate-700">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Project Timeline</h2>
                        </div>
                        <div className="p-6 space-y-3">
                            {ganttPhases.map((phase: any, i: number) => {
                                const weeks = Math.round((phase.duration_days || 7) / 7);
                                const colorMap: Record<string, string> = {
                                    blue: "bg-blue-500",
                                    green: "bg-green-500",
                                    orange: "bg-orange-500",
                                    purple: "bg-purple-500",
                                    slate: "bg-slate-500",
                                    red: "bg-red-500",
                                };
                                const dotColor = colorMap[phase.color] || "bg-blue-500";
                                return (
                                    <div key={i} className="flex items-center gap-4">
                                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
                                        <span className="text-sm font-semibold text-slate-200 flex-1">{phase.name || `Phase ${i + 1}`}</span>
                                        <span className="text-sm text-slate-400 tabular-nums">{weeks} week{weeks !== 1 ? "s" : ""}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── WHAT'S INCLUDED / EXCLUDED ── */}
                {exclusionsText && (
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">What&apos;s Excluded</h2>
                            <ul className="space-y-2">
                                {exclusionsText.split("\n").filter((s: string) => s.trim()).slice(0, 6).map((item: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                        <span className="text-slate-600 mt-0.5">•</span>
                                        <span>{item.trim()}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {siteAddress && (
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">Works Location</h2>
                                <p className="text-sm text-slate-300 leading-relaxed">{siteAddress}</p>
                                {project.project_type && (
                                    <span className="inline-block mt-3 px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-400 font-medium">
                                        {project.project_type}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── COMPANY CREDENTIALS ── */}
                {(profile?.capability_statement || profile?.accreditations) && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">About {companyName}</h2>
                        <div className="grid sm:grid-cols-2 gap-6">
                            <div>
                                {profile.years_trading && (
                                    <p className="text-sm text-slate-300 mb-2">
                                        <span className="font-semibold text-white">{profile.years_trading} years</span> of trading experience
                                    </p>
                                )}
                                {profile.capability_statement && (
                                    <p className="text-sm text-slate-400 leading-relaxed line-clamp-4">{profile.capability_statement}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                {profile.accreditations && (
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Accreditations</p>
                                        <p className="text-sm text-slate-300">{profile.accreditations}</p>
                                    </div>
                                )}
                                {profile.insurance_details && (
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Insurance</p>
                                        <p className="text-sm text-slate-300">{profile.insurance_details}</p>
                                    </div>
                                )}
                                {profile.phone && (
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Contact</p>
                                        <p className="text-sm text-slate-300">{profile.phone}</p>
                                        {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:text-blue-300">{profile.website}</a>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── ACCEPTANCE SECTION ── */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
                    {accepted || project.proposal_accepted_at ? (
                        <div className="text-center space-y-3">
                            <div className="w-14 h-14 bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                                <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-green-400">Proposal Accepted</h2>
                            {(acceptedAt || project.proposal_accepted_at) && (
                                <p className="text-sm text-slate-400">
                                    Accepted on {formatDate(new Date(acceptedAt || project.proposal_accepted_at))}
                                    {project.proposal_accepted_by && ` by ${project.proposal_accepted_by}`}
                                </p>
                            )}
                            <p className="text-sm text-slate-500 mt-2">{companyName} will be in touch shortly to confirm next steps.</p>
                        </div>
                    ) : isExpired ? (
                        <div className="text-center space-y-3">
                            <div className="w-14 h-14 bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
                                <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-red-400">Proposal Expired</h2>
                            <p className="text-sm text-slate-400">
                                This proposal has passed its 30-day validity period. Please contact {companyName} for an updated proposal.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div className="text-center">
                                <h2 className="text-xl font-bold text-white mb-2">Accept This Proposal</h2>
                                <p className="text-sm text-slate-400 max-w-md mx-auto">
                                    By clicking below, you confirm your acceptance of the Scope of Works, Fee Proposal, and Terms &amp; Conditions as set out in this proposal.
                                </p>
                            </div>
                            <button
                                onClick={handleAccept}
                                disabled={accepting}
                                className="w-full h-14 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-xl font-bold text-base transition-all active:scale-[0.98] shadow-lg shadow-blue-900/30"
                            >
                                {accepting ? "Processing..." : "Accept This Proposal"}
                            </button>
                            <p className="text-xs text-slate-600 text-center">
                                This constitutes a binding agreement. You will receive confirmation shortly.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="text-center pb-8">
                    <p className="text-xs text-slate-700">
                        This proposal was prepared by {companyName} using Constructa · Ref: {refCode}
                    </p>
                </div>
            </div>
        </div>
    );
}
