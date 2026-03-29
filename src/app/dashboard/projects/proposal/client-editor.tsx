"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Save, FileText, AlertCircle, Camera, Scale, CalendarDays, CheckCircle, Circle, Copy, Check, ExternalLink, CreditCard, MessageSquare, Info } from "lucide-react";
import { saveProposalAction, generateAiScopeAction, sendProposalAction } from "./actions";
import ProposalPdfButton from "./proposal-pdf-button";
import Link from "next/link";

// Standard 9 T&C clauses
const STANDARD_CLAUSES = [
    { clause_number: 1, title: "Jurisdiction", body: "The law of Contract is the Law of England and Wales. The Language of this Contract is English." },
    { clause_number: 2, title: "Responsibilities", body: "The Works are detailed within the Scope of Works attached to this Proposal. All Works are to meet Statutory Requirements, including all applicable British and European Standards, and industry best practices." },
    { clause_number: 3, title: "Alternative Dispute Resolution", body: "Should any dispute arise which cannot be resolved by negotiation, escalation shall be via Adjudication. The Adjudicating Nominated Body is the Royal Institute of Chartered Surveyors (RICS), under the RICS Homeowner Adjudication Scheme." },
    { clause_number: 4, title: "Liability", body: "The Defect Liability Period is 12 months from the date of Completion Certificate. Any Defects notified within the Defect Period are to be promptly rectified by the Contractor." },
    { clause_number: 5, title: "Workmanship", body: "All Works are to be performed using reasonable skill and care to that of a competent Contractor with experience on projects of similar size and scope." },
    { clause_number: 6, title: "Insurances", body: "The Contractor shall maintain throughout the Works: Public Liability Insurance; Employers Liability Insurance; Contractors All Risk Insurance. Evidence of current policies available on request." },
    { clause_number: 7, title: "Payments", body: "Payment dates are 21 Calendar days from receipt of Application. Any deductions by the Client must be formally notified as a 'Pay-Less-Notice' no later than 7 days following receipt of Application." },
    { clause_number: 8, title: "Change Management", body: "Any Variations to the Scope must be issued in writing. The Contractor will respond within 7 Calendar days with any Cost and/or Time implications." },
    { clause_number: 9, title: "Health, Safety & CDM", body: "The Client is a Domestic Client under the Construction Design Management (CDM) Regulations 2015. The Contractor shall act as Principal Contractor and comply with all CDM requirements." },
];

const DEFAULT_PHASES = [
    { id: "1", name: "Groundworks", start_date: "", duration_days: 14, color: "blue" },
    { id: "2", name: "Structure", start_date: "", duration_days: 21, color: "green" },
    { id: "3", name: "Roofing", start_date: "", duration_days: 14, color: "orange" },
    { id: "4", name: "First Fix", start_date: "", duration_days: 14, color: "purple" },
    { id: "5", name: "Plastering", start_date: "", duration_days: 7, color: "slate" },
    { id: "6", name: "Second Fix & Finish", start_date: "", duration_days: 14, color: "blue" },
];

const PHASE_COLORS = [
    { value: "blue", label: "Blue", hex: "#3B82F6" },
    { value: "green", label: "Green", hex: "#22C55E" },
    { value: "orange", label: "Orange", hex: "#F97316" },
    { value: "purple", label: "Purple", hex: "#A855F7" },
    { value: "slate", label: "Slate", hex: "#64748B" },
    { value: "red", label: "Red", hex: "#EF4444" },
];

const DEFAULT_PAYMENT_SCHEDULE = [
    { id: "1", stage: "Deposit", description: "On acceptance of proposal", percentage: 20 },
    { id: "2", stage: "Groundworks Complete", description: "On completion of substructure works", percentage: 20 },
    { id: "3", stage: "Structure Complete", description: "On completion of superstructure / roof structure", percentage: 25 },
    { id: "4", stage: "First Fix Complete", description: "On completion of M&E first fix works", percentage: 20 },
    { id: "5", stage: "Completion", description: "On practical completion / handover", percentage: 15 },
];

interface GanttPhase {
    id: string;
    name: string;
    start_date: string;
    duration_days: number;
    color: string;
}

interface SitePhoto {
    url: string;
    caption: string;
}

interface TcOverride {
    clause_number: number;
    title: string;
    body: string;
}

interface PaymentRow {
    id: string;
    stage: string;
    description: string;
    percentage: number;
}

interface Props {
    projectId: string;
    initialScope: string;
    initialExclusions: string;
    initialClarifications: string;
    estimates: any[];
    project: any;
    profile: any;
}

function SectionHeading({ icon: Icon, label, completed, id }: { icon: any; label: string; completed: boolean; id: string }) {
    return (
        <div className="flex items-center gap-3 mb-4" id={id}>
            <div className="flex items-center gap-2">
                {completed ? (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                    <Circle className="w-5 h-5 text-slate-600 flex-shrink-0" />
                )}
                <div className="p-1.5 bg-slate-800 rounded-lg">
                    <Icon className="w-4 h-4 text-slate-300" />
                </div>
            </div>
            <h2 className="text-lg font-bold text-slate-100">{label}</h2>
        </div>
    );
}

export default function ClientEditor({
    projectId,
    initialScope,
    initialExclusions,
    initialClarifications,
    estimates,
    project,
    profile,
}: Props) {
    const [scope, setScope] = useState(initialScope);
    const [exclusions, setExclusions] = useState(initialExclusions);
    const [clarifications, setClarifications] = useState(initialClarifications);
    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const [introduction, setIntroduction] = useState(project?.proposal_introduction || "");
    const [ganttPhases, setGanttPhases] = useState<GanttPhase[]>(
        project?.gantt_phases?.length ? project.gantt_phases : DEFAULT_PHASES.map(p => ({
            ...p,
            start_date: project?.start_date || "",
        }))
    );
    const [useCustomTc, setUseCustomTc] = useState(!!project?.tc_overrides);
    const [tcOverrides, setTcOverrides] = useState<TcOverride[]>(
        project?.tc_overrides || STANDARD_CLAUSES.map(c => ({ ...c }))
    );
    const [sitePhotos, setSitePhotos] = useState<SitePhoto[]>(
        project?.site_photos?.length ? project.site_photos : Array.from({ length: 6 }, () => ({ url: "", caption: "" }))
    );
    const [paymentSchedule, setPaymentSchedule] = useState<PaymentRow[]>(
        project?.payment_schedule?.length ? project.payment_schedule : DEFAULT_PAYMENT_SCHEDULE
    );

    const [pricingMode, setPricingMode] = useState<"full" | "summary">("full");
    const [validityDays, setValidityDays] = useState(30);
    const [linkCopied, setLinkCopied] = useState(false);
    const [sending, setSending] = useState(false);

    const contractValue = project?.potential_value || 0;

    const handleAutoWrite = async () => {
        setGenerating(true);
        const result = await generateAiScopeAction(projectId);
        if (typeof result === "object" && result.scope_narrative) {
            setScope((prev: string) => prev + (prev ? "\n\n" : "") + result.scope_narrative);
            if (result.suggested_exclusions) {
                setExclusions((prev: string) => prev + (prev ? "\n" : "") + result.suggested_exclusions);
            }
            if (result.suggested_clarifications) {
                setClarifications((prev: string) => prev + (prev ? "\n" : "") + result.suggested_clarifications);
            }
        } else {
            setScope((prev: string) => prev + (prev ? "\n\n" : "") + String(result));
        }
        setGenerating(false);
    };

    const handleCopyLink = async () => {
        setSending(true);
        const result = await sendProposalAction(projectId);
        if (result?.url) {
            await navigator.clipboard.writeText(result.url);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 3000);
        }
        setSending(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const fd = new FormData();
        fd.set("projectId", projectId);
        fd.set("scope", scope);
        fd.set("exclusions", exclusions);
        fd.set("clarifications", clarifications);
        fd.set("proposal_introduction", introduction);
        fd.set("gantt_phases", JSON.stringify(ganttPhases));
        fd.set("tc_overrides", useCustomTc ? JSON.stringify(tcOverrides) : "");
        fd.set("site_photos", JSON.stringify(sitePhotos.filter(p => p.url)));
        fd.set("payment_schedule", JSON.stringify(paymentSchedule));
        await saveProposalAction(fd);
        setSaved(true);
        setSaving(false);
        setTimeout(() => setSaved(false), 3000);
    };

    // Phase management
    const addPhase = () => {
        setGanttPhases(prev => [...prev, {
            id: crypto.randomUUID(),
            name: "",
            start_date: project?.start_date || "",
            duration_days: 7,
            color: "blue",
        }]);
    };
    const removePhase = (id: string) => setGanttPhases(prev => prev.filter(p => p.id !== id));
    const updatePhase = (id: string, field: keyof GanttPhase, value: string | number) => {
        setGanttPhases(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    // T&C management
    const updateTcClause = (n: number, body: string) =>
        setTcOverrides(prev => prev.map(c => c.clause_number === n ? { ...c, body } : c));
    const resetTcClause = (n: number) => {
        const std = STANDARD_CLAUSES.find(c => c.clause_number === n);
        if (std) updateTcClause(n, std.body);
    };

    // Photo management
    const updatePhoto = (i: number, field: "url" | "caption", value: string) =>
        setSitePhotos(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));

    // Payment schedule management
    const addPaymentRow = () => {
        setPaymentSchedule(prev => [...prev, {
            id: crypto.randomUUID(),
            stage: "",
            description: "",
            percentage: 0,
        }]);
    };
    const removePaymentRow = (id: string) => setPaymentSchedule(prev => prev.filter(r => r.id !== id));
    const updatePaymentRow = (id: string, field: keyof PaymentRow, value: string | number) => {
        setPaymentSchedule(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    };
    const totalPct = paymentSchedule.reduce((s, r) => s + (r.percentage || 0), 0);

    // Live project snapshot for PDF
    const liveProject = {
        ...project,
        scope_text: scope,
        exclusions_text: exclusions,
        clarifications_text: clarifications,
        proposal_introduction: introduction,
        gantt_phases: ganttPhases,
        tc_overrides: useCustomTc ? tcOverrides : null,
        site_photos: sitePhotos.filter(p => p.url),
        payment_schedule: paymentSchedule,
    };

    // Completion checks
    const checks = {
        introduction: introduction.trim().length > 20,
        scope: scope.trim().length > 50,
        exclusions: exclusions.trim().length > 5,
        timeline: ganttPhases.some(p => p.name.trim()),
        payment: paymentSchedule.length > 0,
        photos: sitePhotos.some(p => p.url),
        terms: true,
    };
    const completedCount = Object.values(checks).filter(Boolean).length;

    const profileComplete = !!(profile?.company_name);
    const proposalStatus = project?.proposal_accepted_at ? "Accepted" : project?.proposal_sent_at ? "Sent" : "Draft";

    return (
        <div className="grid lg:grid-cols-3 gap-8 items-start pb-20">
            {/* ── MAIN CONTENT COL ── */}
            <div className="lg:col-span-2 space-y-6">

                {/* SECTION 1: Project Summary */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 bg-slate-800/60 border-b border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">Project Summary</span>
                        </div>
                        <Link href={`/dashboard/projects/settings?projectId=${projectId}`} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                            Edit Details <ExternalLink className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="p-6 grid sm:grid-cols-2 gap-4">
                        {[
                            { label: "Client", value: project?.client_name },
                            { label: "Site Address", value: project?.site_address || project?.client_address },
                            { label: "Project Type", value: project?.project_type },
                            { label: "Contract Value", value: contractValue ? `£${Number(contractValue).toLocaleString("en-GB")}` : null },
                            { label: "Target Start", value: project?.start_date ? new Date(project.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null },
                        ].map(({ label, value }) => value ? (
                            <div key={label}>
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">{label}</p>
                                <p className="text-sm font-semibold text-slate-100">{value}</p>
                            </div>
                        ) : null)}
                    </div>
                </div>

                {/* SECTION 2: Company Profile Check */}
                <div>
                    {profileComplete ? (
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-green-900/20 border border-green-800/40 rounded-xl">
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                            <span className="text-sm text-green-400 font-medium">Company profile complete — {profile.company_name}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 px-4 py-3 bg-amber-900/20 border border-amber-700/50 rounded-xl">
                            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-amber-300">Company profile incomplete</p>
                                <p className="text-xs text-amber-400/80 mt-0.5">Your proposal PDF will show &ldquo;The Contractor&rdquo; instead of your company name.</p>
                            </div>
                            <Link href="/dashboard/settings/profile" className="text-xs font-bold text-amber-300 hover:text-amber-200 whitespace-nowrap flex items-center gap-1">
                                Complete Profile <ExternalLink className="w-3 h-3" />
                            </Link>
                        </div>
                    )}
                </div>

                {/* SECTION 3: Client Introduction */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 bg-slate-800/60 border-b border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {checks.introduction ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-slate-600" />}
                            <MessageSquare className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">Client Introduction</span>
                        </div>
                    </div>
                    <div className="p-6">
                        <p className="text-xs text-slate-500 mb-3">Opening paragraph — personalised for this client. Appears first in the proposal PDF.</p>
                        <Textarea
                            value={introduction}
                            onChange={(e) => setIntroduction(e.target.value)}
                            className="w-full border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-blue-600 min-h-[120px] text-sm leading-relaxed"
                            placeholder="e.g. Thank you for the opportunity to submit our proposal for the works at [address]. We have carefully reviewed your requirements and are delighted to present our comprehensive fee proposal..."
                        />
                    </div>
                </div>

                {/* SECTION 4: Scope of Works */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 bg-slate-800/60 border-b border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {checks.scope ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-slate-600" />}
                            <FileText className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">Scope of Works</span>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleAutoWrite}
                            disabled={generating}
                            className="h-8 px-3 border-purple-700 bg-purple-900/30 text-purple-300 hover:bg-purple-800/40 text-xs font-bold gap-1.5"
                        >
                            <Sparkles className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
                            {generating ? "Writing..." : "✨ Draft with AI"}
                        </Button>
                    </div>
                    <div className="p-6">
                        <p className="text-xs text-slate-500 mb-3">Full scope narrative describing all works to be carried out.</p>
                        <Textarea
                            value={scope}
                            onChange={(e) => setScope(e.target.value)}
                            className="w-full border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-blue-600 min-h-[200px] text-sm leading-relaxed font-mono"
                            placeholder="Describe the physical works to be carried out. Use AI to draft from your bill of quantities..."
                        />
                    </div>
                </div>

                {/* SECTION 5: Exclusions & Clarifications */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 bg-slate-800/60 border-b border-slate-700 flex items-center gap-2">
                        {checks.exclusions ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-slate-600" />}
                        <AlertCircle className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">Exclusions & Clarifications</span>
                    </div>
                    <div className="p-6 grid sm:grid-cols-2 gap-5">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 mb-2">Exclusions</p>
                            <p className="text-xs text-slate-600 mb-2">Items NOT included in this proposal</p>
                            <Textarea
                                value={exclusions}
                                onChange={(e) => setExclusions(e.target.value)}
                                className="w-full border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-blue-600 min-h-[140px] text-sm"
                                placeholder={"e.g. Planning fees\nFloor finishes\nVAT\nDecorating"}
                            />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-400 mb-2">Clarifications</p>
                            <p className="text-xs text-slate-600 mb-2">Assumptions and qualifications</p>
                            <Textarea
                                value={clarifications}
                                onChange={(e) => setClarifications(e.target.value)}
                                className="w-full border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-blue-600 min-h-[140px] text-sm"
                                placeholder={"e.g. Works based on drawings ref. A100\nNo asbestos assumed\nExisting drainage is serviceable"}
                            />
                        </div>
                    </div>
                </div>

                {/* SECTION 6: Project Timeline */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 bg-slate-800/60 border-b border-slate-700 flex items-center gap-2">
                        {checks.timeline ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-slate-600" />}
                        <CalendarDays className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">Project Timeline</span>
                    </div>
                    <div className="p-6 space-y-3">
                        {/* Column headers */}
                        <div className="grid gap-3 text-xs font-bold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-800" style={{ gridTemplateColumns: "1fr 140px 80px 90px 40px" }}>
                            <span>Phase Name</span>
                            <span>Start Date</span>
                            <span>Weeks</span>
                            <span>Colour</span>
                            <span></span>
                        </div>
                        {ganttPhases.map((phase) => (
                            <div key={phase.id} className="grid gap-3 items-center" style={{ gridTemplateColumns: "1fr 140px 80px 90px 40px" }}>
                                <input
                                    value={phase.name}
                                    onChange={(e) => updatePhase(phase.id, "name", e.target.value)}
                                    className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    placeholder="Phase name"
                                />
                                <input
                                    type="date"
                                    value={phase.start_date}
                                    onChange={(e) => updatePhase(phase.id, "start_date", e.target.value)}
                                    className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                />
                                <input
                                    type="number"
                                    min={1}
                                    value={Math.round(phase.duration_days / 7)}
                                    onChange={(e) => updatePhase(phase.id, "duration_days", (parseInt(e.target.value) || 1) * 7)}
                                    className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-2 text-sm text-slate-100 text-center focus:outline-none focus:ring-2 focus:ring-blue-600"
                                />
                                <select
                                    value={phase.color}
                                    onChange={(e) => updatePhase(phase.id, "color", e.target.value)}
                                    className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                >
                                    {PHASE_COLORS.map(c => (
                                        <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => removePhase(phase.id)}
                                    className="h-9 w-9 rounded-lg bg-red-900/20 text-red-400 hover:bg-red-900/40 flex items-center justify-center transition-colors text-lg font-bold"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={addPhase}
                            className="w-full h-10 rounded-lg border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors text-sm font-semibold"
                        >
                            + Add Phase
                        </button>
                    </div>
                </div>

                {/* SECTION 7: Payment Schedule */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 bg-slate-800/60 border-b border-slate-700 flex items-center gap-2">
                        {checks.payment ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-slate-600" />}
                        <CreditCard className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">Payment Schedule</span>
                        {contractValue > 0 && (
                            <span className="ml-auto text-xs text-slate-500">
                                Based on £{Number(contractValue).toLocaleString("en-GB")} contract value
                            </span>
                        )}
                    </div>
                    <div className="p-6 space-y-3">
                        {/* Column headers */}
                        <div className="grid gap-3 text-xs font-bold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-800" style={{ gridTemplateColumns: "1fr 2fr 80px 100px 40px" }}>
                            <span>Stage</span>
                            <span>Description</span>
                            <span className="text-right">%</span>
                            <span className="text-right">£ Amount</span>
                            <span></span>
                        </div>
                        {paymentSchedule.map((row) => {
                            const amount = contractValue ? (contractValue * row.percentage) / 100 : null;
                            return (
                                <div key={row.id} className="grid gap-3 items-center" style={{ gridTemplateColumns: "1fr 2fr 80px 100px 40px" }}>
                                    <input
                                        value={row.stage}
                                        onChange={(e) => updatePaymentRow(row.id, "stage", e.target.value)}
                                        className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                        placeholder="Stage name"
                                    />
                                    <input
                                        value={row.description}
                                        onChange={(e) => updatePaymentRow(row.id, "description", e.target.value)}
                                        className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                        placeholder="When this stage is due..."
                                    />
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={row.percentage}
                                            onChange={(e) => updatePaymentRow(row.id, "percentage", parseFloat(e.target.value) || 0)}
                                            className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 text-sm text-slate-100 text-right focus:outline-none focus:ring-2 focus:ring-blue-600"
                                        />
                                        <span className="text-xs text-slate-500">%</span>
                                    </div>
                                    <div className="text-right text-sm font-semibold text-slate-300 tabular-nums">
                                        {amount !== null
                                            ? `£${amount.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                            : <span className="text-slate-600">—</span>
                                        }
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removePaymentRow(row.id)}
                                        className="h-9 w-9 rounded-lg bg-red-900/20 text-red-400 hover:bg-red-900/40 flex items-center justify-center transition-colors text-lg font-bold"
                                    >
                                        ×
                                    </button>
                                </div>
                            );
                        })}
                        <div className="flex items-center justify-between pt-2">
                            <button
                                type="button"
                                onClick={addPaymentRow}
                                className="h-9 px-4 rounded-lg border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors text-sm font-semibold"
                            >
                                + Add Stage
                            </button>
                            <div className={`text-sm font-bold ${totalPct === 100 ? "text-green-400" : totalPct > 100 ? "text-red-400" : "text-amber-400"}`}>
                                Total: {totalPct}% {totalPct !== 100 && <span className="font-normal text-xs">(should equal 100%)</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* SECTION 8: Site Photos */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 bg-slate-800/60 border-b border-slate-700 flex items-center gap-2">
                        {checks.photos ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-slate-600" />}
                        <Camera className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">Site Photos</span>
                        <span className="text-xs text-slate-600 ml-1">(optional — max 6)</span>
                    </div>
                    <div className="p-6 space-y-3">
                        {sitePhotos.map((photo, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className="text-xs text-slate-600 font-bold w-5 text-center">{i + 1}</span>
                                <input
                                    value={photo.url}
                                    onChange={(e) => updatePhoto(i, "url", e.target.value)}
                                    className="flex-1 h-9 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    placeholder="Image URL (https://...)"
                                />
                                <input
                                    value={photo.caption}
                                    onChange={(e) => updatePhoto(i, "caption", e.target.value)}
                                    className="w-48 h-9 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    placeholder="Caption (optional)"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* SECTION 9: Terms & Conditions */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 bg-slate-800/60 border-b border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <Scale className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">Terms & Conditions</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500">{useCustomTc ? "Custom" : "Standard"}</span>
                            <button
                                type="button"
                                onClick={() => setUseCustomTc(!useCustomTc)}
                                className={`relative w-10 h-5 rounded-full transition-colors ${useCustomTc ? "bg-blue-600" : "bg-slate-700"}`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${useCustomTc ? "translate-x-5" : ""}`} />
                            </button>
                        </div>
                    </div>
                    <div className="p-6">
                        {!useCustomTc ? (
                            <p className="text-sm text-slate-400">Using standard 9-clause T&Cs. Toggle &ldquo;Custom&rdquo; to edit individual clauses.</p>
                        ) : (
                            <div className="space-y-3">
                                {tcOverrides.map((clause) => (
                                    <div key={clause.clause_number} className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-200">{clause.clause_number}. {clause.title}</span>
                                            <button
                                                type="button"
                                                onClick={() => resetTcClause(clause.clause_number)}
                                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                            >
                                                Reset to Standard
                                            </button>
                                        </div>
                                        <textarea
                                            value={clause.body}
                                            onChange={(e) => updateTcClause(clause.clause_number, e.target.value)}
                                            rows={3}
                                            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── STICKY SIDEBAR ── */}
            <div className="lg:col-span-1">
                <div className="sticky top-6 space-y-4">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            proposalStatus === "Accepted" ? "bg-green-900/40 text-green-400" :
                            proposalStatus === "Sent" ? "bg-blue-900/40 text-blue-400" :
                            "bg-slate-800 text-slate-400"
                        }`}>
                            {proposalStatus}
                        </span>
                    </div>

                    {/* Completion Checklist */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completion</span>
                            <span className="text-xs text-slate-500">{completedCount}/{Object.keys(checks).length}</span>
                        </div>
                        <div className="space-y-2">
                            {[
                                { key: "introduction", label: "Client Introduction" },
                                { key: "scope", label: "Scope of Works" },
                                { key: "exclusions", label: "Exclusions" },
                                { key: "timeline", label: "Timeline Phases" },
                                { key: "payment", label: "Payment Schedule" },
                                { key: "photos", label: "Site Photos" },
                                { key: "terms", label: "T&Cs" },
                            ].map(({ key, label }) => (
                                <div key={key} className="flex items-center gap-2">
                                    {checks[key as keyof typeof checks] ? (
                                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                    ) : (
                                        <Circle className="w-4 h-4 text-slate-700 flex-shrink-0" />
                                    )}
                                    <span className={`text-xs ${checks[key as keyof typeof checks] ? "text-slate-300" : "text-slate-600"}`}>{label}</span>
                                </div>
                            ))}
                        </div>
                        {/* Progress bar */}
                        <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-green-500 rounded-full transition-all"
                                style={{ width: `${(completedCount / Object.keys(checks).length) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* PDF Controls */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">PDF Options</p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setPricingMode("summary")}
                                className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-all ${pricingMode === "summary" ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
                            >
                                Summary
                            </button>
                            <button
                                type="button"
                                onClick={() => setPricingMode("full")}
                                className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-all ${pricingMode === "full" ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
                            >
                                Full Detail
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 flex-shrink-0">Valid for</span>
                            <input
                                type="number"
                                value={validityDays}
                                onChange={(e) => setValidityDays(Number(e.target.value) || 30)}
                                className="w-16 h-8 rounded-lg border border-slate-700 bg-slate-800 px-2 text-sm text-slate-100 text-center focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                            <span className="text-xs text-slate-500">days</span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2">
                        <ProposalPdfButton
                            estimates={estimates}
                            project={liveProject}
                            profile={profile}
                            pricingMode={pricingMode}
                            validityDays={validityDays}
                        />

                        <button
                            type="button"
                            onClick={handleCopyLink}
                            disabled={sending}
                            className="w-full h-11 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                        >
                            {linkCopied ? (
                                <><Check className="w-4 h-4 text-green-400" /> Link Copied!</>
                            ) : sending ? (
                                "Generating link..."
                            ) : (
                                <><Copy className="w-4 h-4" /> Copy Client Link</>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full h-11 rounded-lg border border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700 text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                        >
                            {saved ? (
                                <><Check className="w-4 h-4 text-green-400" /> Saved!</>
                            ) : saving ? (
                                "Saving..."
                            ) : (
                                <><Save className="w-4 h-4" /> Save All</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
