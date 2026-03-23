"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Sparkles, Save, FileText, AlertCircle, Info,
    CalendarDays, Camera, Scale, MessageSquare, Link2, Copy, Check
} from "lucide-react";
import { saveProposalAction, generateAiScopeAction, sendProposalAction } from "./actions";
import ProposalPdfButton from "./proposal-pdf-button";

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
    { value: "blue", label: "Blue" },
    { value: "green", label: "Green" },
    { value: "orange", label: "Orange" },
    { value: "purple", label: "Purple" },
    { value: "slate", label: "Slate" },
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

interface Props {
    projectId: string;
    initialScope: string;
    initialExclusions: string;
    initialClarifications: string;
    estimates: any[];
    project: any;
    profile: any;
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

    // New fields
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

    // PDF generation controls
    const [pricingMode, setPricingMode] = useState<"full" | "summary">("full");
    const [validityDays, setValidityDays] = useState(30);

    // Send proposal link
    const [linkCopied, setLinkCopied] = useState(false);
    const [sending, setSending] = useState(false);

    // Active editor section
    const [activeSection, setActiveSection] = useState<string>("scope");

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

    const removePhase = (id: string) => {
        setGanttPhases(prev => prev.filter(p => p.id !== id));
    };

    const updatePhase = (id: string, field: keyof GanttPhase, value: string | number) => {
        setGanttPhases(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    // T&C management
    const updateTcClause = (clauseNumber: number, body: string) => {
        setTcOverrides(prev => prev.map(c => c.clause_number === clauseNumber ? { ...c, body } : c));
    };

    const resetTcClause = (clauseNumber: number) => {
        const std = STANDARD_CLAUSES.find(c => c.clause_number === clauseNumber);
        if (std) updateTcClause(clauseNumber, std.body);
    };

    // Photo management
    const updatePhoto = (index: number, field: "url" | "caption", value: string) => {
        setSitePhotos(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
    };

    // Build a live project snapshot that includes the editor state
    const liveProject = {
        ...project,
        scope_text: scope,
        exclusions_text: exclusions,
        clarifications_text: clarifications,
        proposal_introduction: introduction,
        gantt_phases: ganttPhases,
        tc_overrides: useCustomTc ? tcOverrides : null,
        site_photos: sitePhotos.filter(p => p.url),
    };

    const sectionTabs = [
        { id: "scope", label: "Scope", icon: FileText },
        { id: "introduction", label: "Introduction", icon: MessageSquare },
        { id: "timeline", label: "Timeline", icon: CalendarDays },
        { id: "photos", label: "Photos", icon: Camera },
        { id: "terms", label: "T&Cs", icon: Scale },
    ];

    return (
        <form action={async (fd) => { await saveProposalAction(fd); }} className="space-y-8 pb-20">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="proposal_introduction" value={introduction} />
            <input type="hidden" name="gantt_phases" value={JSON.stringify(ganttPhases)} />
            <input type="hidden" name="tc_overrides" value={useCustomTc ? JSON.stringify(tcOverrides) : ""} />
            <input type="hidden" name="site_photos" value={JSON.stringify(sitePhotos.filter(p => p.url))} />

            <div className="grid lg:grid-cols-12 gap-8 items-start">
                {/* LEFT COL: MAIN EDITOR */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    {/* Section Tabs */}
                    <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
                        {sectionTabs.map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveSection(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                                    activeSection === tab.id
                                        ? "bg-slate-700 text-white shadow-md"
                                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                                }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Scope of Works */}
                    {activeSection === "scope" && (
                        <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
                            <CardHeader className="bg-slate-800/50 border-b border-slate-700 flex flex-row justify-between items-center px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-600/20 rounded-lg">
                                        <FileText className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg text-slate-100">Scope of Works</CardTitle>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Primary Project Narrative</p>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleAutoWrite}
                                    disabled={generating}
                                    className="h-9 px-4 border-purple-700 bg-purple-900/30 text-purple-300 hover:bg-purple-800/40 shadow-sm font-bold gap-2 group transition-all"
                                >
                                    <Sparkles className={`w-4 h-4 transition-transform ${generating ? "animate-spin" : "group-hover:scale-110"}`} />
                                    {generating ? "AI is Writing..." : "Draft with AI"}
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0 flex-1 flex flex-col">
                                <Textarea
                                    name="scope"
                                    value={scope}
                                    onChange={(e) => setScope(e.target.value)}
                                    className="flex-1 w-full p-8 border-none focus-visible:ring-0 shadow-none font-serif text-lg leading-relaxed resize-none min-h-[500px] bg-slate-900 text-slate-100 placeholder:text-slate-600 transition-colors"
                                    placeholder="Describe the physical works to be carried out. Use the AI button to generate a first draft based on your bill of quantities..."
                                />
                            </CardContent>
                        </Card>
                    )}

                    {/* Client Introduction */}
                    {activeSection === "introduction" && (
                        <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden min-h-[400px] flex flex-col">
                            <CardHeader className="bg-slate-800/50 border-b border-slate-700 px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-600/20 rounded-lg">
                                        <MessageSquare className="w-5 h-5 text-green-400" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg text-slate-100">Client Introduction</CardTitle>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">The opening paragraph of your proposal</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 flex-1 flex flex-col gap-3">
                                <p className="text-xs text-slate-500">
                                    This appears as the opening paragraph of your proposal, personalised for this client.
                                </p>
                                <Textarea
                                    value={introduction}
                                    onChange={(e) => setIntroduction(e.target.value)}
                                    className="flex-1 w-full border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-blue-600 min-h-[300px] text-base leading-relaxed"
                                    placeholder="e.g. Thank you for inviting us to submit a proposal for the construction of a rear extension at [address]. We have carefully reviewed your requirements..."
                                />
                            </CardContent>
                        </Card>
                    )}

                    {/* Project Timeline / Gantt */}
                    {activeSection === "timeline" && (
                        <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
                            <CardHeader className="bg-slate-800/50 border-b border-slate-700 px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-orange-600/20 rounded-lg">
                                        <CalendarDays className="w-5 h-5 text-orange-400" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg text-slate-100">Project Timeline</CardTitle>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Gantt phases for your proposal PDF</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                {ganttPhases.map((phase) => (
                                    <div key={phase.id} className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-lg p-3">
                                        <input
                                            value={phase.name}
                                            onChange={(e) => updatePhase(phase.id, "name", e.target.value)}
                                            className="flex-1 h-10 rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                            placeholder="Phase name"
                                        />
                                        <input
                                            type="date"
                                            value={phase.start_date}
                                            onChange={(e) => updatePhase(phase.id, "start_date", e.target.value)}
                                            className="w-40 h-10 rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                        />
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                min={1}
                                                value={Math.round(phase.duration_days / 7)}
                                                onChange={(e) => updatePhase(phase.id, "duration_days", (parseInt(e.target.value) || 1) * 7)}
                                                className="w-16 h-10 rounded-lg border border-slate-600 bg-slate-900 px-2 text-sm text-slate-100 text-center focus:outline-none focus:ring-2 focus:ring-blue-600"
                                            />
                                            <span className="text-xs text-slate-500">wks</span>
                                        </div>
                                        <select
                                            value={phase.color}
                                            onChange={(e) => updatePhase(phase.id, "color", e.target.value)}
                                            className="h-10 rounded-lg border border-slate-600 bg-slate-900 px-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                        >
                                            {PHASE_COLORS.map(c => (
                                                <option key={c.value} value={c.value}>{c.label}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => removePhase(phase.id)}
                                            className="h-10 w-10 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-800/40 flex items-center justify-center transition-colors font-bold"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={addPhase}
                                    className="w-full h-11 rounded-lg border border-dashed border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors text-sm font-semibold"
                                >
                                    + Add Phase
                                </button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Site Photos */}
                    {activeSection === "photos" && (
                        <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
                            <CardHeader className="bg-slate-800/50 border-b border-slate-700 px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-cyan-600/20 rounded-lg">
                                        <Camera className="w-5 h-5 text-cyan-400" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg text-slate-100">Site Photos</CardTitle>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Up to 6 photos for your proposal</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                {sitePhotos.map((photo, i) => (
                                    <div key={i} className="grid grid-cols-12 gap-3 items-center bg-slate-800 border border-slate-700 rounded-lg p-3">
                                        <span className="col-span-1 text-sm text-slate-500 font-bold text-center">{i + 1}</span>
                                        <input
                                            value={photo.url}
                                            onChange={(e) => updatePhoto(i, "url", e.target.value)}
                                            className="col-span-6 h-10 rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                            placeholder="Image URL"
                                        />
                                        <input
                                            value={photo.caption}
                                            onChange={(e) => updatePhoto(i, "caption", e.target.value)}
                                            className="col-span-5 h-10 rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                            placeholder="Caption (optional)"
                                        />
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* Terms & Conditions */}
                    {activeSection === "terms" && (
                        <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
                            <CardHeader className="bg-slate-800/50 border-b border-slate-700 px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-amber-600/20 rounded-lg">
                                            <Scale className="w-5 h-5 text-amber-400" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg text-slate-100">Terms & Conditions</CardTitle>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">9 standard clauses</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-slate-500 font-medium">
                                            {useCustomTc ? "Custom" : "Standard"}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setUseCustomTc(!useCustomTc)}
                                            className={`relative w-11 h-6 rounded-full transition-colors ${useCustomTc ? "bg-blue-600" : "bg-slate-700"}`}
                                        >
                                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${useCustomTc ? "translate-x-5" : ""}`} />
                                        </button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                {!useCustomTc && (
                                    <p className="text-sm text-slate-400">
                                        Using standard T&Cs. Toggle to &ldquo;Custom&rdquo; to edit individual clauses.
                                    </p>
                                )}
                                {useCustomTc && tcOverrides.map((clause) => (
                                    <div key={clause.clause_number} className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-200">
                                                {clause.clause_number}. {clause.title}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => resetTcClause(clause.clause_number)}
                                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
                                            >
                                                Reset to Standard
                                            </button>
                                        </div>
                                        <textarea
                                            value={clause.body}
                                            onChange={(e) => updateTcClause(clause.clause_number, e.target.value)}
                                            rows={3}
                                            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                        />
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* RIGHT COL: SIDEBAR */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="bg-slate-900 border-slate-800 shadow-lg">
                        <CardHeader className="py-4 px-6 bg-slate-800/50 border-b border-slate-700">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-orange-400" />
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-400">Exclusions</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Textarea
                                name="exclusions"
                                value={exclusions}
                                onChange={(e) => setExclusions(e.target.value)}
                                className="w-full p-4 text-sm border-none focus-visible:ring-0 shadow-none min-h-[180px] bg-slate-900 text-slate-100 placeholder:text-slate-600"
                                placeholder="List what ISN'T included (e.g. Planning fees, Floor finishes, VAT)..."
                            />
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800 shadow-lg">
                        <CardHeader className="py-4 px-6 bg-slate-800/50 border-b border-slate-700">
                            <div className="flex items-center gap-2">
                                <Info className="w-4 h-4 text-blue-400" />
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-400">Clarifications</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Textarea
                                name="clarifications"
                                value={clarifications}
                                onChange={(e) => setClarifications(e.target.value)}
                                className="w-full p-4 text-sm border-none focus-visible:ring-0 shadow-none min-h-[180px] bg-slate-900 text-slate-100 placeholder:text-slate-600"
                                placeholder="Any assumptions made (e.g. Standard working hours, Water/Power provided by client)..."
                            />
                        </CardContent>
                    </Card>

                    {/* PDF Generation Panel */}
                    <Card className="bg-slate-900 border-slate-800 shadow-lg border-l-4 border-l-blue-600">
                        <CardHeader className="py-4 px-6 bg-slate-800/50 border-b border-slate-700">
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-slate-300" />
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-400">PDF Generation</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-5 space-y-5">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Pricing Detail</Label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPricingMode("full")}
                                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                                            pricingMode === "full"
                                                ? "bg-slate-700 text-white shadow-md"
                                                : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                                        }`}
                                    >
                                        Full Breakdown
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPricingMode("summary")}
                                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                                            pricingMode === "summary"
                                                ? "bg-slate-700 text-white shadow-md"
                                                : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                                        }`}
                                    >
                                        Category Summary
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Quote valid for</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min={7}
                                        max={90}
                                        value={validityDays}
                                        onChange={(e) => setValidityDays(Math.min(90, Math.max(7, Number(e.target.value) || 30)))}
                                        className="w-20 text-center font-bold bg-slate-800 border-slate-700 text-slate-100"
                                    />
                                    <span className="text-sm text-slate-500 font-medium">days</span>
                                </div>
                            </div>

                            <ProposalPdfButton
                                estimates={estimates}
                                project={liveProject}
                                profile={profile}
                                pricingMode={pricingMode}
                                validityDays={validityDays}
                            />
                        </CardContent>
                    </Card>

                    {/* Copy Client Link */}
                    <button
                        type="button"
                        onClick={handleCopyLink}
                        disabled={sending}
                        className="w-full h-12 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {linkCopied ? "Link Copied!" : sending ? "Generating..." : "Copy Client Link"}
                    </button>

                    <Button type="submit" className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg shadow-xl transition-all active:scale-[0.98] gap-3">
                        <Save className="w-6 h-6" />
                        Save Proposal Changes
                    </Button>
                </div>
            </div>
        </form>
    );
}
