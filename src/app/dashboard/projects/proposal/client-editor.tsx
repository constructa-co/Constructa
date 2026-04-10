"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Save, FileText, AlertCircle, Camera, Scale, CalendarDays, CheckCircle, Circle, Copy, Check, ExternalLink, CreditCard, MessageSquare, Info, Plus, Loader2, RefreshCw, FileDown, Send, History } from "lucide-react";
import { saveProposalAction, generateAiScopeAction, sendProposalAction, getProposalLinkAction, rewriteIntroductionAction, updateCaseStudySelectionAction, generateClarificationsAction, generateExclusionsAction, saveWizardResultsAction, updatePaymentScheduleTypeAction, generateClosingStatementAction, saveClosingStatementAction, saveProposalOverridesAction, createProposalVersionAction, type ProposalVersionRow } from "./actions";
import VersionHistoryPanel from "./version-history-panel";
import ProposalPdfButton from "./proposal-pdf-button";
import AiWizard from "./ai-wizard";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

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

// Auto-assigned phase colours cycling by index
const AUTO_COLORS = ["blue", "green", "orange", "purple", "slate", "teal"];

const DEFAULT_PHASES = [
    { id: "1", name: "Groundworks", start_date: "", duration_days: 14, duration_unit: "Weeks" as const, color: "blue" },
    { id: "2", name: "Structure", start_date: "", duration_days: 21, duration_unit: "Weeks" as const, color: "green" },
    { id: "3", name: "Roofing", start_date: "", duration_days: 14, duration_unit: "Weeks" as const, color: "orange" },
    { id: "4", name: "First Fix", start_date: "", duration_days: 14, duration_unit: "Weeks" as const, color: "purple" },
    { id: "5", name: "Plastering", start_date: "", duration_days: 7, duration_unit: "Weeks" as const, color: "slate" },
    { id: "6", name: "Second Fix & Finish", start_date: "", duration_days: 14, duration_unit: "Weeks" as const, color: "teal" },
];

const DEFAULT_PAYMENT_SCHEDULE = [
    { id: "1", stage: "Deposit", description: "On acceptance of proposal", percentage: 20 },
    { id: "2", stage: "Groundworks Complete", description: "On completion of substructure works", percentage: 20 },
    { id: "3", stage: "Structure Complete", description: "On completion of superstructure / roof structure", percentage: 25 },
    { id: "4", stage: "First Fix Complete", description: "On completion of M&E first fix works", percentage: 20 },
    { id: "5", stage: "Completion", description: "On practical completion / handover", percentage: 15 },
];

type DurationUnit = "Hours" | "Days" | "Weeks";

interface GanttPhase {
    id: string;
    name: string;
    start_date: string;
    duration_days: number;
    duration_unit: DurationUnit;
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
    hidden?: boolean;
    custom?: boolean;
}

interface PaymentRow {
    id: string;
    stage: string;
    description: string;
    percentage: number;
    amount?: number;
}

interface Props {
    projectId: string;
    initialScope: string;
    initialExclusions: string;
    initialClarifications: string;
    initialBriefScope?: string;
    initialContractExclusions?: string;
    initialContractClarifications?: string;
    estimates: any[];
    project: any;
    profile: any;
    estimatedTotal?: number;
    proposalVersions?: ProposalVersionRow[];
    currentVersionNumber?: number;
}

const MILESTONE_TRIGGERS = [
    'On acceptance of proposal',
    'On mobilisation / site start',
    'On completion of groundworks',
    'On completion of drainage works',
    'On completion of utilities',
    'On completion of structure',
    'On completion of fit-out',
    'On practical completion',
    'On final account agreement',
    'On handover',
    'Custom...',
];

function computeEstimateContractSum(est: any) {
    const allLines = est.estimate_lines || [];
    const directCost = allLines
        .filter((l: any) => l.trade_section !== "Preliminaries" && (l.line_total || 0) > 0)
        .reduce((sum: number, l: any) => sum + (l.line_total || 0), 0);
    const explicitPrelimsLines = allLines.filter((l: any) => l.trade_section === "Preliminaries");
    const explicitPrelimsTotal = explicitPrelimsLines.reduce((sum: number, l: any) => sum + (l.line_total || 0), 0);
    const prelimsFromPct = directCost * ((est.prelims_pct || 0) / 100);
    const prelimsTotal = explicitPrelimsLines.length > 0 ? explicitPrelimsTotal : prelimsFromPct;
    const totalConstructionCost = directCost + prelimsTotal;
    const overheadAmount = totalConstructionCost * ((est.overhead_pct || 0) / 100);
    const costPlusOverhead = totalConstructionCost + overheadAmount;
    const riskAmount = costPlusOverhead * ((est.risk_pct || 0) / 100);
    const adjustedTotal = costPlusOverhead + riskAmount;
    const profitAmount = adjustedTotal * ((est.profit_pct || 0) / 100);
    const contractSum = adjustedTotal + profitAmount;
    const ohRiskProfitMultiplier = (1 + (est.overhead_pct || 0) / 100) * (1 + (est.risk_pct || 0) / 100) * (1 + (est.profit_pct || 0) / 100);

    // Section totals
    const sectionTotals: Record<string, number> = {};
    allLines.forEach((l: any) => {
        const sec = l.trade_section || "General";
        if (sec === "Preliminaries") return;
        sectionTotals[sec] = (sectionTotals[sec] || 0) + (l.line_total || 0);
    });

    return { directCost, prelimsTotal, contractSum, ohRiskProfitMultiplier, sectionTotals };
}

function formatGBP(n: number): string {
    return "\u00A3" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function unitToDays(value: number, unit: DurationUnit): number {
    if (unit === "Hours") return value / 8; // 8-hour days
    if (unit === "Days") return value;
    return value * 7; // Weeks
}

function daysToUnit(days: number, unit: DurationUnit): number {
    if (unit === "Hours") return Math.round(days * 8);
    if (unit === "Days") return days;
    return Math.round(days / 7);
}

function addDays(dateStr: string, days: number): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    d.setDate(d.getDate() + Math.round(days));
    return d.toISOString().split("T")[0];
}

function migratePhase(p: any): GanttPhase {
    return {
        id: p.id,
        name: p.name,
        start_date: p.start_date || "",
        duration_days: p.duration_days || 7,
        duration_unit: (p.duration_unit as DurationUnit) || "Weeks",
        color: p.color || "blue",
    };
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
    initialBriefScope = "",
    initialContractExclusions = "",
    initialContractClarifications = "",
    estimates,
    project,
    profile,
    estimatedTotal = 0,
    proposalVersions = [],
    currentVersionNumber = 1,
}: Props) {
    // Pre-fill from Brief/Contracts if proposal fields are empty
    const [introduction, setIntroduction] = useState(
        project?.proposal_introduction || initialBriefScope || ""
    );
    const [scope, setScope] = useState(
        initialScope || ""
    );
    const [exclusions, setExclusions] = useState(
        initialExclusions || initialContractExclusions || ""
    );
    const [clarifications, setClarifications] = useState(
        initialClarifications || initialContractClarifications || ""
    );

    // Track whether fields were pre-filled from other tabs
    const introPreFilled = !project?.proposal_introduction && !!initialBriefScope;
    const scopePreFilled = !initialScope && !!initialBriefScope;
    const exclusionsPreFilled = !initialExclusions && !!initialContractExclusions;
    const clarificationsPreFilled = !initialClarifications && !!initialContractClarifications;

    const [closingStatement, setClosingStatement] = useState(project?.closing_statement ?? '');
    const [isGeneratingClosing, setIsGeneratingClosing] = useState(false);
    const [proposalCapability, setProposalCapability] = useState(project?.proposal_capability || '');
    const [proposalCompanyName, setProposalCompanyName] = useState(project?.proposal_company_name || '');
    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [rewritingIntro, setRewritingIntro] = useState(false);

    const [ganttPhases, setGanttPhases] = useState<GanttPhase[]>(
        project?.gantt_phases?.length
            ? project.gantt_phases.map(migratePhase)
            : DEFAULT_PHASES.map(p => ({
                ...p,
                start_date: project?.start_date || "",
            }))
    );
    const [sequentialMode, setSequentialMode] = useState(false);

    const [useCustomTc, setUseCustomTc] = useState(!!project?.tc_overrides);
    const [tcOverrides, setTcOverrides] = useState<TcOverride[]>(
        project?.tc_overrides || STANDARD_CLAUSES.map(c => ({ ...c }))
    );

    const [sitePhotos, setSitePhotos] = useState<SitePhoto[]>(
        project?.site_photos?.length ? project.site_photos : Array.from({ length: 6 }, () => ({ url: "", caption: "" }))
    );
    const [uploadingPhoto, setUploadingPhoto] = useState<number | null>(null);

    const [paymentSchedule, setPaymentSchedule] = useState<PaymentRow[]>(
        project?.payment_schedule?.length ? project.payment_schedule : DEFAULT_PAYMENT_SCHEDULE
    );
    const [paymentScheduleType, setPaymentScheduleType] = useState<"percentage" | "milestone">(
        project?.payment_schedule_type || "percentage"
    );

    const [pricingMode, setPricingMode] = useState<"full" | "summary">("full");
    const [validityDays, setValidityDays] = useState(30);
    const [linkCopied, setLinkCopied] = useState(false);
    const [sending, setSending] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    // Active estimate computation
    const activeEstimateRaw = estimates.find((e: any) => e.is_active) || estimates[0];
    const activeEstimate = activeEstimateRaw ? {
        ...computeEstimateContractSum(activeEstimateRaw),
        estimate: activeEstimateRaw,
    } : null;

    // Populate payment schedule from estimate sections
    const populateFromEstimate = () => {
        if (!activeEstimate) return;
        const { contractSum, ohRiskProfitMultiplier, sectionTotals } = activeEstimate;
        const depositAmount = contractSum * 0.1;
        const retentionAmount = contractSum * 0.05;
        const stagesFromSections = Object.entries(sectionTotals).map(([section, directTotal]) => ({
            id: crypto.randomUUID(),
            stage: section,
            description: `On completion of ${section.toLowerCase()}`,
            percentage: 0,
            amount: directTotal * ohRiskProfitMultiplier,
        }));
        const newSchedule: PaymentRow[] = [
            { id: crypto.randomUUID(), stage: "Deposit", description: "On acceptance of proposal", percentage: 0, amount: depositAmount },
            ...stagesFromSections,
            { id: crypto.randomUUID(), stage: "Final Retention", description: "On final account agreement", percentage: 0, amount: retentionAmount },
        ];
        setPaymentSchedule(newSchedule);
    };

    // AI Wizard state
    const [showFirstTimeModal, setShowFirstTimeModal] = useState(false);
    const [showWizard, setShowWizard] = useState(false);

    // Case study selection
    const allCaseStudies: { id: string; projectName: string; projectType: string; contractValue: string }[] = profile?.case_studies || [];
    const [selectedCaseStudyIds, setSelectedCaseStudyIds] = useState<(number | string)[]>(
        project?.selected_case_study_ids?.length ? project.selected_case_study_ids : []
    );
    const toggleCaseStudy = async (index: number) => {
        const updated = selectedCaseStudyIds.includes(index)
            ? selectedCaseStudyIds.filter((id) => id !== index)
            : [...selectedCaseStudyIds, index];
        setSelectedCaseStudyIds(updated);
        await updateCaseStudySelectionAction(projectId, updated);
    };
    const isCaseStudyRecommended = (cs: { projectType: string }) => {
        const projectType = (project?.project_type || "").toLowerCase();
        return projectType && cs.projectType?.toLowerCase().includes(projectType.toLowerCase());
    };

    function handleWizardComplete(data: {
        introduction: string;
        scope_narrative: string;
        exclusions: string;
        clarifications: string;
        gantt_phases: any[];
        payment_stages: any[];
    }) {
        const intro = data.introduction || "";
        const scopeNarrative = data.scope_narrative || "";
        const excl = data.exclusions || "";
        const clar = data.clarifications || "";

        setIntroduction(intro);
        setScope(scopeNarrative);
        setExclusions(excl);
        setClarifications(clar);

        const mappedPhases = data.gantt_phases?.length
            ? data.gantt_phases.map((p: any) => ({
                id: p.id || crypto.randomUUID(),
                name: p.name,
                start_date: p.start_date || "",
                duration_days: p.duration_days || 14,
                duration_unit: (p.duration_unit as DurationUnit) || "Weeks",
                color: p.color || "blue",
            }))
            : undefined;

        const mappedPayment = data.payment_stages?.length
            ? data.payment_stages.map((p: any) => ({
                id: p.id || crypto.randomUUID(),
                stage: p.stage,
                description: p.description,
                percentage: p.percentage,
            }))
            : undefined;

        if (mappedPhases) setGanttPhases(mappedPhases);
        if (mappedPayment) setPaymentSchedule(mappedPayment);
        setShowWizard(false);

        // Persist wizard results to DB as a safety net
        saveWizardResultsAction(projectId, {
            proposal_introduction: intro,
            scope_text: scopeNarrative,
            exclusions_text: excl,
            clarifications_text: clar,
            ...(mappedPhases ? { gantt_phases: mappedPhases } : {}),
            ...(mappedPayment ? { payment_schedule: mappedPayment } : {}),
        });
    }

    const activeEst = estimates.find((e: any) => e.is_active) ?? estimates[0];
    const computedContractSum = activeEst ? computeEstimateContractSum(activeEst).contractSum : 0;
    const contractValue = computedContractSum > 0
        ? computedContractSum
        : (project?.potential_value || 0);

    // Sequential mode: compute start dates iteratively
    const computedPhases: GanttPhase[] = [];
    for (let i = 0; i < ganttPhases.length; i++) {
        const phase = ganttPhases[i];
        if (!sequentialMode || i === 0) {
            computedPhases.push(phase);
        } else {
            const prev = computedPhases[i - 1];
            const newStart = addDays(prev.start_date, prev.duration_days);
            computedPhases.push({ ...phase, start_date: newStart });
        }
    }

    const handleGenerateClosing = async () => {
        setIsGeneratingClosing(true);
        try {
            const result = await generateClosingStatementAction(projectId, {
                companyName: proposalCompanyName || profile?.company_name || '',
                capability: proposalCapability || profile?.capability_statement || '',
                projectName: project?.name || '',
                clientName: project?.client_name || '',
                contractValue: contractValue || 0,
                discountPct: project?.discount_pct || 0,
                discountReason: project?.discount_reason || '',
                mdName: profile?.md_name || '',
            });
            setClosingStatement(result.text);
        } catch {
            // silently fail
        } finally {
            setIsGeneratingClosing(false);
        }
    };

    const [aiError, setAiError] = useState("");

    const handleAutoWrite = async () => {
        setGenerating(true);
        setAiError("");
        const result = await generateAiScopeAction(projectId);
        if (typeof result === "object" && result.scope_narrative && !result.scope_narrative.startsWith("Error")) {
            setScope(result.scope_narrative); // Replace, not append
            if (result.suggested_exclusions) {
                setExclusions((prev: string) => prev + (prev ? "\n" : "") + result.suggested_exclusions);
            }
            if (result.suggested_clarifications) {
                setClarifications((prev: string) => prev + (prev ? "\n" : "") + result.suggested_clarifications);
            }
        } else {
            // Show error in UI — never write it to the scope textarea
            const errMsg = typeof result === "object" ? result.scope_narrative : String(result);
            setAiError(errMsg || "AI unavailable — please try again");
        }
        setGenerating(false);
    };

    const handleRewriteIntro = async () => {
        setRewritingIntro(true);
        const result = await rewriteIntroductionAction(projectId, introduction);
        if (result.text) {
            setIntroduction(result.text);
        }
        setRewritingIntro(false);
    };

    const handleSyncFromBriefContracts = () => {
        let synced = 0;
        if (initialBriefScope) {
            setIntroduction((prev: string) => prev || initialBriefScope);
            setScope(prev => prev || initialBriefScope);
            synced++;
        }
        if (initialContractExclusions) {
            setExclusions(initialContractExclusions);
            synced++;
        }
        if (initialContractClarifications) {
            setClarifications(initialContractClarifications);
            synced++;
        }
        if (synced > 0) {
            // Dynamic import toast to avoid issues
            import("sonner").then(({ toast }) => toast.success("Synced from Brief & Contracts"));
        }
    };

    // ── Version state ──────────────────────────────────────────────────────────
    const [localVersions, setLocalVersions] = useState<ProposalVersionRow[]>(proposalVersions);
    const [localCurrentVersion, setLocalCurrentVersion] = useState(currentVersionNumber);
    const [showVersionDialog, setShowVersionDialog] = useState(false);
    const [versionNotes, setVersionNotes] = useState("");
    const [savingVersion, setSavingVersion] = useState(false);

    const handleSaveVersion = async () => {
        setSavingVersion(true);
        try {
            const res = await createProposalVersionAction(projectId, versionNotes);
            if (res.success && res.version_number) {
                // Optimistically add a placeholder version row so UI updates instantly
                const newVersion: ProposalVersionRow = {
                    id: crypto.randomUUID(),
                    project_id: projectId,
                    version_number: res.version_number,
                    notes: versionNotes.trim() || null,
                    snapshot: {},
                    created_at: new Date().toISOString(),
                };
                setLocalVersions(prev => [newVersion, ...prev]);
                setLocalCurrentVersion(res.version_number!);
                setVersionNotes("");
                setShowVersionDialog(false);
                toast.success(`Saved as v${res.version_number}`);
            } else {
                toast.error(res.error || "Failed to save version");
            }
        } finally {
            setSavingVersion(false);
        }
    };

    const [generatingClarifications, setGeneratingClarifications] = useState(false);
    const [generatingExclusions, setGeneratingExclusions] = useState(false);

    const handleSuggestClarifications = async () => {
        setGeneratingClarifications(true);
        try {
            const result = await generateClarificationsAction(
                project?.project_type || "",
                scope,
                clarifications
            );
            if (result.clarifications) {
                setClarifications(result.clarifications.replace(/^- /gm, ''));
            }
        } catch { /* ignore */ }
        setGeneratingClarifications(false);
    };

    const handleSuggestExclusions = async () => {
        setGeneratingExclusions(true);
        try {
            const result = await generateExclusionsAction(
                project?.project_type || "",
                scope
            );
            if (result.exclusions) {
                setExclusions(result.exclusions.replace(/^- /gm, ''));
            }
        } catch { /* ignore */ }
        setGeneratingExclusions(false);
    };

    const handleCopyLink = async () => {
        setSending(true);
        const result = await getProposalLinkAction(projectId);
        if (result?.url) {
            await navigator.clipboard.writeText(result.url);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 3000);
        }
        setSending(false);
    };

    const handleSendEmail = async () => {
        setSending(true);
        const result = await sendProposalAction(projectId);
        setSending(false);
        if (!result?.url) return;

        if (result.hasClientEmail) {
            // Resend handled it server-side — show confirmation
            setEmailSent(true);
            setTimeout(() => setEmailSent(false), 4000);
        } else {
            // No client email on file — fall back to mailto
            const clientName = project?.client_name || "there";
            const projectName = project?.name || "your project";
            const subject = encodeURIComponent(`Your Proposal — ${projectName}`);
            const body = encodeURIComponent(
                `Dear ${clientName},\n\nPlease find your proposal for ${projectName} at the link below:\n\n${result.url}\n\nYou can review the full scope, pricing, and programme, and confirm your acceptance directly through the link.\n\nPlease don't hesitate to get in touch if you have any questions.\n\nKind regards`
            );
            window.location.href = `mailto:?subject=${subject}&body=${body}`;
        }
    };

    const handleSave = async () => {
        setSaving(true);
        const fd = new FormData();
        fd.set("projectId", projectId);
        fd.set("scope", scope);
        fd.set("exclusions", exclusions);
        fd.set("clarifications", clarifications);
        fd.set("proposal_introduction", introduction);
        fd.set("gantt_phases", JSON.stringify(sequentialMode ? computedPhases : ganttPhases));
        fd.set("tc_overrides", useCustomTc ? JSON.stringify(tcOverrides) : "");
        fd.set("site_photos", JSON.stringify(sitePhotos.filter(p => p.url)));
        fd.set("payment_schedule", JSON.stringify(paymentSchedule));
        fd.set("closing_statement", closingStatement);
        await saveProposalAction(fd);
        setSaved(true);
        setSaving(false);
        setTimeout(() => setSaved(false), 3000);
    };

    // Phase management
    const addPhase = () => {
        const colorIndex = ganttPhases.length % AUTO_COLORS.length;
        setGanttPhases(prev => [...prev, {
            id: crypto.randomUUID(),
            name: "",
            start_date: project?.start_date || "",
            duration_days: 7,
            duration_unit: "Weeks",
            color: AUTO_COLORS[colorIndex],
        }]);
    };
    const removePhase = (id: string) => setGanttPhases(prev => prev.filter(p => p.id !== id));
    const updatePhase = (id: string, field: keyof GanttPhase, value: string | number) => {
        setGanttPhases(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    // T&C management
    const updateTcClause = (n: number, field: "body" | "title", value: string) =>
        setTcOverrides(prev => prev.map(c => c.clause_number === n ? { ...c, [field]: value } : c));
    const resetTcClause = (n: number) => {
        const std = STANDARD_CLAUSES.find(c => c.clause_number === n);
        if (std) setTcOverrides(prev => prev.map(c => c.clause_number === n ? { ...c, body: std.body, title: std.title, hidden: false } : c));
    };
    const hideTcClause = (n: number) =>
        setTcOverrides(prev => prev.map(c => c.clause_number === n ? { ...c, hidden: !c.hidden } : c));
    const addCustomClause = () => {
        const maxNum = Math.max(...tcOverrides.map(c => c.clause_number), 0);
        setTcOverrides(prev => [...prev, {
            clause_number: maxNum + 1,
            title: "Custom Clause",
            body: "",
            custom: true,
        }]);
    };
    const removeCustomClause = (n: number) =>
        setTcOverrides(prev => prev.filter(c => c.clause_number !== n));

    // Photo management
    const updatePhoto = (i: number, field: "url" | "caption", value: string) =>
        setSitePhotos(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));

    const handlePhotoUpload = async (i: number, file: File) => {
        setUploadingPhoto(i);
        const supabase = createClient();
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${projectId}/${Date.now()}-${i}.${ext}`;
        const { error } = await supabase.storage
            .from("proposal-photos")
            .upload(path, file, { upsert: true });
        if (!error) {
            const { data } = supabase.storage.from("proposal-photos").getPublicUrl(path);
            updatePhoto(i, "url", data.publicUrl);
        }
        setUploadingPhoto(null);
    };

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
        gantt_phases: sequentialMode ? computedPhases : ganttPhases,
        tc_overrides: useCustomTc ? tcOverrides : null,
        site_photos: sitePhotos.filter(p => p.url),
        payment_schedule: paymentSchedule,
        payment_schedule_type: paymentScheduleType,
        selected_case_study_ids: selectedCaseStudyIds,
        proposal_capability: proposalCapability,
        proposal_company_name: proposalCompanyName,
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
    const profileIncomplete = !profile?.company_name || !profile?.capability_statement || (profile?.capability_statement?.length || 0) < 30;
    const proposalStatus = project?.proposal_accepted_at ? "Accepted" : project?.proposal_sent_at ? "Sent" : "Draft";

    return (
        <div className="grid lg:grid-cols-3 gap-8 items-start pb-20">
            {/* ── AI Wizard Modal ── */}
            {showWizard && (
                <AiWizard
                    projectId={projectId}
                    project={project}
                    onComplete={handleWizardComplete}
                    onClose={() => setShowWizard(false)}
                />
            )}

            {/* ── MAIN CONTENT COL ── */}
            <div className="lg:col-span-2 space-y-6">

                {/* Sync from Brief & Contracts banner */}
                {(initialBriefScope || initialContractExclusions || initialContractClarifications) && (
                    <div className="flex items-center justify-between bg-blue-900/20 border border-blue-800/40 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            <span className="text-sm text-blue-300 font-medium">Data available from Brief & Contracts tabs</span>
                        </div>
                        <button
                            onClick={handleSyncFromBriefContracts}
                            className="text-xs font-bold text-blue-400 hover:text-blue-300 bg-blue-900/40 px-3 py-1.5 rounded-lg border border-blue-700/40 transition-colors"
                        >
                            Sync from Brief & Contracts
                        </button>
                    </div>
                )}

                {/* T&C Tier reference */}
                {project?.tc_tier && (
                    <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-700 text-sm flex items-center gap-2">
                        <Scale className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-300">
                            <span className="font-medium">T&C Tier:</span> {project.tc_tier.charAt(0).toUpperCase() + project.tc_tier.slice(1)}
                        </span>
                        <span className="text-slate-500">—</span>
                        <Link href={`/dashboard/projects/contracts?projectId=${projectId}`} className="text-blue-400 hover:text-blue-300 text-xs">
                            Edit in Contracts tab
                        </Link>
                    </div>
                )}

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
                        <div className="flex items-center gap-3 px-4 py-3 bg-amber-950/40 border border-amber-700 rounded-xl">
                            <AlertCircle className="w-5 h-5 text-amber-300 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-amber-200">Company profile incomplete</p>
                                <p className="text-xs text-amber-300 mt-0.5">Your proposal PDF will show &ldquo;The Contractor&rdquo; instead of your company name.</p>
                            </div>
                            <Link href="/dashboard/settings/profile" className="text-xs font-bold text-amber-300 hover:text-amber-200 whitespace-nowrap flex items-center gap-1">
                                Complete Profile <ExternalLink className="w-3 h-3" />
                            </Link>
                        </div>
                    )}
                </div>

                {/* About Us — This Proposal override */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 bg-slate-800/60 border-b border-slate-700 flex items-center justify-between">
                        <div>
                            <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">About Us — This Proposal</span>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Optionally customise your company description for this specific project. Defaults to your Company Profile if left blank.
                            </p>
                        </div>
                        {proposalCapability && (
                            <button type="button" onClick={() => { setProposalCapability(''); saveProposalOverridesAction(projectId, { proposal_capability: '' }); }}
                                className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                                Reset to profile default
                            </button>
                        )}
                    </div>
                    <div className="p-6 space-y-3">
                        <textarea
                            className="w-full h-24 text-sm border border-slate-700 bg-slate-800 rounded-lg p-3 text-slate-100 placeholder:text-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder={profile?.capability_statement || "Leave blank to use your Company Profile description..."}
                            value={proposalCapability}
                            onChange={e => setProposalCapability(e.target.value)}
                            onBlur={() => saveProposalOverridesAction(projectId, { proposal_capability: proposalCapability })}
                        />
                        <input
                            type="text"
                            className="w-full text-sm border border-slate-700 bg-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="Override company name for this proposal (optional)"
                            value={proposalCompanyName}
                            onChange={e => setProposalCompanyName(e.target.value)}
                            onBlur={() => saveProposalOverridesAction(projectId, { proposal_company_name: proposalCompanyName })}
                        />
                    </div>
                </div>

                {/* SECTION 3: Client Introduction */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 bg-slate-800/60 border-b border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {checks.introduction ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-slate-600" />}
                            <MessageSquare className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">Client Introduction</span>
                        </div>
                        {introduction.trim().length > 20 && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleRewriteIntro}
                                disabled={rewritingIntro}
                                className="h-8 px-3 border-purple-700 bg-purple-900/30 text-purple-300 hover:bg-purple-800/40 text-xs font-bold gap-1.5"
                            >
                                {rewritingIntro ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                {rewritingIntro ? "Rewriting..." : "✨ Rewrite with AI"}
                            </Button>
                        )}
                    </div>
                    <div className="p-6">
                        {!project?.proposal_introduction && initialBriefScope && (
                            <div className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/30 px-3 py-1.5 rounded mb-2">
                                Pre-filled from Brief — edit as needed
                            </div>
                        )}
                        <p className="text-xs text-slate-500 mb-3">Opening paragraph — personalised for this client. Appears first in the proposal PDF.</p>
                        {introPreFilled && (
                            <div className="text-xs text-blue-400 bg-blue-900/20 border border-blue-800/30 px-3 py-1.5 rounded mb-2">
                                Pre-filled from Brief — edit as needed
                            </div>
                        )}
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
                        {scopePreFilled && (
                            <div className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/30 px-3 py-1.5 rounded mb-2">
                                Pre-filled from Brief — edit as needed
                            </div>
                        )}
                        {aiError && (
                            <div className="mb-3 px-3 py-2 bg-red-950/50 border border-red-800 rounded-lg text-xs text-red-400">
                                {aiError.includes("not configured") ? "AI service unavailable — please try again in a moment." : aiError}
                            </div>
                        )}
                        <Textarea
                            value={scope}
                            onChange={(e) => setScope(e.target.value)}
                            className="w-full border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-blue-600 min-h-[200px] text-sm leading-relaxed"
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
                        {(exclusionsPreFilled || clarificationsPreFilled) && (
                            <div className="col-span-full text-xs text-blue-400 bg-blue-500/10 border border-blue-500/30 px-3 py-1.5 rounded">
                                Pre-filled from Contracts tab — edit as needed
                            </div>
                        )}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-slate-400">Exclusions</p>
                                <button
                                    type="button"
                                    onClick={handleSuggestExclusions}
                                    disabled={generatingExclusions}
                                    className="flex items-center gap-1 h-6 px-2 rounded border border-purple-700 bg-purple-900/30 text-purple-300 hover:bg-purple-800/40 text-[10px] font-bold transition-colors disabled:opacity-60"
                                >
                                    {generatingExclusions ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                    {generatingExclusions ? "Generating..." : "Suggest with AI"}
                                </button>
                            </div>
                            <p className="text-xs text-slate-600 mb-2">Items NOT included in this proposal</p>
                            {exclusionsPreFilled && (
                                <div className="text-xs text-blue-400 bg-blue-900/20 border border-blue-800/30 px-3 py-1.5 rounded mb-2">
                                    Pre-filled from Contracts tab
                                </div>
                            )}
                            <Textarea
                                value={exclusions}
                                onChange={(e) => setExclusions(e.target.value)}
                                className="w-full border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-blue-600 min-h-[140px] text-sm"
                                placeholder={"e.g. Planning fees\nFloor finishes\nVAT\nDecorating"}
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-slate-400">Clarifications</p>
                                <button
                                    type="button"
                                    onClick={handleSuggestClarifications}
                                    disabled={generatingClarifications}
                                    className="flex items-center gap-1 h-6 px-2 rounded border border-purple-700 bg-purple-900/30 text-purple-300 hover:bg-purple-800/40 text-[10px] font-bold transition-colors disabled:opacity-60"
                                >
                                    {generatingClarifications ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                    {generatingClarifications ? "Generating..." : "Suggest with AI"}
                                </button>
                            </div>
                            <p className="text-xs text-slate-600 mb-2">Assumptions and qualifications</p>
                            {clarificationsPreFilled && (
                                <div className="text-xs text-blue-400 bg-blue-900/20 border border-blue-800/30 px-3 py-1.5 rounded mb-2">
                                    Pre-filled from Contracts tab
                                </div>
                            )}
                            <Textarea
                                value={clarifications}
                                onChange={(e) => setClarifications(e.target.value)}
                                className="w-full border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-blue-600 min-h-[140px] text-sm"
                                placeholder={"e.g. Works based on drawings ref. A100\nNo asbestos assumed\nExisting drainage is serviceable"}
                            />
                        </div>
                    </div>
                </div>

                {/* Closing Statement */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 bg-slate-800/60 border-b border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CheckCircle className={`w-4 h-4 ${closingStatement ? 'text-green-500' : 'text-slate-600'}`} />
                            <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">Closing Statement</span>
                            <span className="text-xs text-slate-500">(appears before signatures in PDF)</span>
                        </div>
                        <button
                            type="button"
                            onClick={handleGenerateClosing}
                            disabled={isGeneratingClosing}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
                        >
                            <Sparkles className="w-4 h-4" />
                            {isGeneratingClosing ? 'Generating...' : closingStatement ? 'Regenerate with AI' : 'Generate with AI'}
                        </button>
                    </div>
                    <div className="px-6 py-4">
                        {closingStatement ? (
                            <Textarea
                                value={closingStatement}
                                onChange={(e) => setClosingStatement(e.target.value)}
                                onBlur={() => saveClosingStatementAction(projectId, closingStatement)}
                                className="w-full border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-blue-600 min-h-[80px] text-sm"
                                placeholder="We look forward to working with you on this project and delivering exceptional results..."
                            />
                        ) : (
                            <div className="h-20 flex items-center justify-center text-slate-500 text-sm border-2 border-dashed border-slate-700 rounded-lg">
                                Click &ldquo;Generate with AI&rdquo; to create a personalised closing statement
                            </div>
                        )}
                    </div>
                </div>

                {/* Programme summary — read only, managed in Programme tab */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 bg-slate-800/60 border-b border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CheckCircle className={`w-4 h-4 ${project?.programme_phases?.length > 0 ? 'text-green-500' : 'text-slate-600'}`} />
                            <CalendarDays className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">Programme</span>
                        </div>
                        <Link href={`/dashboard/projects/schedule?projectId=${projectId}`}
                            className="text-xs text-blue-400 hover:text-blue-300">
                            Edit in Programme tab &rarr;
                        </Link>
                    </div>
                    <div className="px-6 py-4">
                        {project?.programme_phases?.length > 0 ? (
                            <div className="text-sm text-slate-400">
                                {project.programme_phases.length} phases &middot; {project.programme_phases.reduce((s: number, p: any) => s + (p.manualDays ?? p.calculatedDays ?? p.duration_days ?? 0), 0)} days total
                                &middot; starts {project.start_date ? new Date(project.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBC'}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500">No programme phases yet. <Link href={`/dashboard/projects/schedule?projectId=${projectId}`} className="text-blue-400 hover:text-blue-300">Build your programme &rarr;</Link></p>
                        )}
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
                        {/* Active estimate context banner */}
                        {activeEstimate && (
                            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                                <span className="text-gray-500">Active estimate contract sum: </span>
                                <span className="font-bold text-gray-900">{formatGBP(activeEstimate.contractSum)}</span>
                                <span className="text-gray-500 ml-3">inc. VAT: </span>
                                <span className="font-bold text-gray-900">{formatGBP(activeEstimate.contractSum * 1.2)}</span>
                            </div>
                        )}
                        {/* Payment type toggle */}
                        <div className="flex items-center gap-4 pb-3 border-b border-slate-800">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Type:</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setPaymentScheduleType("percentage");
                                    updatePaymentScheduleTypeAction(projectId, "percentage");
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                    paymentScheduleType === "percentage"
                                        ? "bg-blue-600 text-white"
                                        : "bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-500"
                                }`}
                            >
                                <span className={`w-2.5 h-2.5 rounded-full border-2 ${paymentScheduleType === "percentage" ? "border-white bg-white" : "border-slate-500"}`} />
                                Percentage of contract value
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setPaymentScheduleType("milestone");
                                    updatePaymentScheduleTypeAction(projectId, "milestone");
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                    paymentScheduleType === "milestone"
                                        ? "bg-blue-600 text-white"
                                        : "bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-500"
                                }`}
                            >
                                <span className={`w-2.5 h-2.5 rounded-full border-2 ${paymentScheduleType === "milestone" ? "border-white bg-white" : "border-slate-500"}`} />
                                Milestone-based
                            </button>
                        </div>

                        {paymentScheduleType === "percentage" ? (
                            <>
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
                                <p className="text-xs text-slate-600">£ amounts calculated from contract value</p>
                            </>
                        ) : (
                            <>
                                {/* Milestone mode */}
                                {activeEstimate && (
                                    <button
                                        type="button"
                                        onClick={populateFromEstimate}
                                        className="mb-3 h-9 px-4 rounded-lg border border-blue-600 bg-blue-900/30 text-blue-300 hover:bg-blue-800/40 text-xs font-bold transition-colors flex items-center gap-2"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Populate from estimate sections
                                    </button>
                                )}
                                <div className="grid gap-3 text-xs font-bold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-800" style={{ gridTemplateColumns: "1fr 2fr 100px 40px" }}>
                                    <span>Stage</span>
                                    <span>Trigger</span>
                                    <span className="text-right">£ Amount</span>
                                    <span></span>
                                </div>
                                {paymentSchedule.map((row) => {
                                    const isCustomTrigger = row.description && !MILESTONE_TRIGGERS.slice(0, -1).includes(row.description);
                                    const selectValue = isCustomTrigger ? 'Custom...' : (row.description || '');
                                    return (
                                        <div key={row.id} className="space-y-1">
                                            <div className="grid gap-3 items-center" style={{ gridTemplateColumns: "1fr 2fr 100px 40px" }}>
                                                <input
                                                    value={row.stage}
                                                    onChange={(e) => updatePaymentRow(row.id, "stage", e.target.value)}
                                                    className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                                    placeholder="Stage name"
                                                />
                                                <select
                                                    value={selectValue}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        if (v === 'Custom...') {
                                                            updatePaymentRow(row.id, "description", row.description || "");
                                                        } else {
                                                            updatePaymentRow(row.id, "description", v);
                                                        }
                                                    }}
                                                    className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                                >
                                                    <option value="">Select trigger...</option>
                                                    {MILESTONE_TRIGGERS.map((t) => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs text-slate-500">£</span>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step="0.01"
                                                        value={row.amount || 0}
                                                        onChange={(e) => updatePaymentRow(row.id, "amount" as keyof PaymentRow, parseFloat(e.target.value) || 0)}
                                                        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 text-sm text-slate-100 text-right focus:outline-none focus:ring-2 focus:ring-blue-600"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removePaymentRow(row.id)}
                                                    className="h-9 w-9 rounded-lg bg-red-900/20 text-red-400 hover:bg-red-900/40 flex items-center justify-center transition-colors text-lg font-bold"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                            {selectValue === 'Custom...' && (
                                                <div className="pl-0" style={{ gridColumn: "2" }}>
                                                    <input
                                                        value={row.description}
                                                        onChange={(e) => updatePaymentRow(row.id, "description", e.target.value)}
                                                        className="h-8 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                                        placeholder="Enter custom trigger description..."
                                                    />
                                                </div>
                                            )}
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
                                    <div className="text-sm font-semibold text-slate-400">
                                        Total: £{paymentSchedule.reduce((s, r) => s + (r.amount || 0), 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <p className="text-xs text-slate-600">Fixed amounts per milestone stage</p>
                            </>
                        )}
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
                    <div className="p-6">
                        <div className="grid sm:grid-cols-2 gap-4">
                            {sitePhotos.map((photo, i) => (
                                <div key={i} className="space-y-2">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Photo {i + 1}</p>
                                    {/* Drop zone */}
                                    <label className={`block relative rounded-lg border-2 border-dashed transition-colors cursor-pointer ${photo.url ? "border-slate-700 bg-slate-800" : "border-slate-700 bg-slate-800/50 hover:border-blue-600 hover:bg-slate-800"}`}>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="sr-only"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handlePhotoUpload(i, file);
                                            }}
                                        />
                                        {photo.url ? (
                                            <div className="relative">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={photo.url} alt={`Site photo ${i + 1}`} className="w-full h-36 object-cover rounded-lg" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 rounded-lg flex items-center justify-center transition-opacity">
                                                    <span className="text-white text-xs font-semibold">Click to replace</span>
                                                </div>
                                            </div>
                                        ) : uploadingPhoto === i ? (
                                            <div className="h-36 flex items-center justify-center">
                                                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                                            </div>
                                        ) : (
                                            <div className="h-36 flex flex-col items-center justify-center gap-2 text-slate-500">
                                                <Camera className="w-8 h-8" />
                                                <span className="text-xs font-medium">Drop image here or click to upload</span>
                                            </div>
                                        )}
                                    </label>
                                    <input
                                        value={photo.caption}
                                        onChange={(e) => updatePhoto(i, "caption", e.target.value)}
                                        className="w-full h-8 rounded-lg border border-slate-700 bg-slate-800 px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                        placeholder="Caption (optional)"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* SECTION 8b: Case Studies Selection */}
                {allCaseStudies.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                        <div className="px-6 py-4 bg-slate-800/60 border-b border-slate-700 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">Case Studies for Proposal</span>
                            <span className="text-xs text-slate-600 ml-1">({selectedCaseStudyIds.length || 'All'} selected)</span>
                        </div>
                        <div className="p-6 space-y-3">
                            <p className="text-xs text-slate-500 mb-2">Choose which case studies appear in this proposal. When none are selected, all are included.</p>
                            {allCaseStudies.map((cs, idx) => {
                                const isSelected = selectedCaseStudyIds.includes(idx);
                                const recommended = isCaseStudyRecommended(cs);
                                return (
                                    <label
                                        key={cs.id || idx}
                                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                            isSelected ? "border-blue-600 bg-blue-950/30" : "border-slate-700 bg-slate-800 hover:border-slate-600"
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleCaseStudy(idx)}
                                            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-600"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-slate-100 truncate">{cs.projectName || `Case Study ${idx + 1}`}</span>
                                                {recommended && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-green-900/40 text-green-400 rounded">Recommended</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                                {cs.projectType && <span>{cs.projectType}</span>}
                                                {cs.contractValue && <span>£{Number(cs.contractValue).toLocaleString("en-GB")}</span>}
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* T&C summary — read only, managed in Contracts tab */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 bg-slate-800/60 border-b border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CheckCircle className={`w-4 h-4 ${project?.tc_tier ? 'text-green-500' : 'text-slate-600'}`} />
                            <Scale className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">Terms & Conditions</span>
                        </div>
                        <Link href={`/dashboard/projects/contracts?projectId=${projectId}`}
                            className="text-xs text-blue-400 hover:text-blue-300">
                            Edit in Contracts tab &rarr;
                        </Link>
                    </div>
                    <div className="px-6 py-4">
                        <p className="text-sm text-slate-400">
                            {project?.tc_tier
                                ? `${project.tc_tier.charAt(0).toUpperCase() + project.tc_tier.slice(1)} terms selected`
                                : 'No T&C tier selected yet.'}
                            {!project?.tc_tier && (
                                <Link href={`/dashboard/projects/contracts?projectId=${projectId}`} className="text-blue-400 hover:text-blue-300 ml-1">Select T&Cs &rarr;</Link>
                            )}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── STICKY SIDEBAR ── */}
            <div className="lg:col-span-1">
                <div className="sticky top-6 space-y-4">
                    {/* Status + Version Badge */}
                    <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400">
                                v{localCurrentVersion}
                            </span>
                        </div>
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
                                { key: "timeline", label: "Timeline" },
                                { key: "payment", label: "Payment Schedule" },
                                { key: "photos", label: "Site Photos" },
                                { key: "terms", label: "T&Cs" },
                            ].map(({ key, label }) => (
                                <div key={key} className="flex items-center gap-2">
                                    {checks[key as keyof typeof checks] ? (
                                        <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                    ) : (
                                        <Circle className="w-3.5 h-3.5 text-slate-700 flex-shrink-0" />
                                    )}
                                    <span className={`text-xs ${checks[key as keyof typeof checks] ? "text-slate-300" : "text-slate-600"}`}>
                                        {label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Save Button */}
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                        ) : saved ? (
                            <><Check className="w-4 h-4" /> Saved!</>
                        ) : (
                            <><Save className="w-4 h-4" /> Save Proposal</>
                        )}
                    </button>

                    {/* Save Version Button */}
                    <button
                        type="button"
                        onClick={() => setShowVersionDialog(true)}
                        className="w-full h-10 bg-amber-950/30 hover:bg-amber-950/50 border border-amber-700/40 text-amber-400 hover:text-amber-300 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <History className="w-4 h-4" />
                        Save Version (v{localCurrentVersion + 1})
                    </button>

                    {/* Version dialog */}
                    {showVersionDialog && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                                <h3 className="text-base font-bold text-slate-100 mb-1">Save Version v{localCurrentVersion + 1}</h3>
                                <p className="text-xs text-slate-400 mb-4">
                                    Creates a snapshot of the current proposal so you can restore it later.
                                </p>
                                <textarea
                                    value={versionNotes}
                                    onChange={(e) => setVersionNotes(e.target.value)}
                                    placeholder="Version notes (optional) — e.g. 'Revised pricing after client call'"
                                    rows={3}
                                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none mb-4"
                                />
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => { setShowVersionDialog(false); setVersionNotes(""); }}
                                        className="flex-1 h-10 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveVersion}
                                        disabled={savingVersion}
                                        className="flex-1 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold text-sm transition-colors flex items-center justify-center gap-2"
                                    >
                                        {savingVersion ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Save Version"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Copy Link Button */}
                    <button
                        type="button"
                        onClick={handleCopyLink}
                        disabled={sending}
                        className="w-full h-12 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                    >
                        {sending ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Getting link...</>
                        ) : linkCopied ? (
                            <><Check className="w-4 h-4 text-green-400" /> Link Copied!</>
                        ) : (
                            <><Copy className="w-4 h-4" /> Copy Proposal Link</>
                        )}
                    </button>

                    {/* Send via Email Button */}
                    <button
                        type="button"
                        onClick={handleSendEmail}
                        disabled={sending || emailSent}
                        className="w-full h-12 bg-blue-700/20 hover:bg-blue-700/30 border border-blue-600/40 text-blue-300 hover:text-blue-200 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                    >
                        {sending ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                        ) : emailSent ? (
                            <><Check className="w-4 h-4 text-green-400" /> Email Sent!</>
                        ) : (
                            <><Send className="w-4 h-4" /> Send Proposal via Email</>
                        )}
                    </button>

                    {/* AI Assistant Button */}
                    <button
                        type="button"
                        onClick={() => setShowWizard(true)}
                        className="w-full h-12 bg-slate-800 hover:bg-slate-700 border border-blue-700/50 text-blue-300 hover:text-blue-200 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                    >
                        <Sparkles className="w-4 h-4" />
                        ✨ AI Assistant
                    </button>

                    {/* Profile warning */}
                    {profileIncomplete && (
                        <div className="p-3 bg-amber-950/40 border border-amber-700/50 rounded-lg text-xs text-amber-300 flex items-center justify-between">
                            <span>Your company profile looks incomplete — this may affect the quality of your proposal.</span>
                            <Link href="/dashboard/settings/profile" className="underline font-medium ml-2 whitespace-nowrap">Update profile</Link>
                        </div>
                    )}

                    {/* PDF Button — soft-gated on profile completeness */}
                    {(() => {
                        const profileWarningMessage = !profile?.company_name
                            ? 'Add your company name in Company Profile'
                            : !profile?.capability_statement || (profile?.capability_statement?.length || 0) < 30
                            ? 'Add a capability statement in Company Profile'
                            : null;
                        return profileWarningMessage ? (
                            <div className="space-y-1">
                                <div className="relative group">
                                    <Button
                                        disabled
                                        className="bg-blue-600 text-white font-bold gap-2 shadow-lg h-12 px-6 w-full text-sm opacity-50 cursor-not-allowed"
                                    >
                                        <FileDown className="w-4 h-4" />
                                        Generate PDF
                                    </Button>
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-slate-700">
                                        {profileWarningMessage}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                                    </div>
                                </div>
                                <Link href="/dashboard/settings/profile"
                                    className="text-xs text-blue-400 hover:underline mt-1 block text-center">
                                    Complete your profile to enable PDF generation
                                </Link>
                            </div>
                        ) : (
                            <ProposalPdfButton project={liveProject} profile={profile} estimates={estimates} pricingMode={pricingMode} validityDays={validityDays} />
                        );
                    })()}

                    {/* Validity days */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Proposal Validity</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={1}
                                max={365}
                                value={validityDays}
                                onChange={(e) => setValidityDays(parseInt(e.target.value) || 30)}
                                className="w-20 h-9 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 text-center focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                            <span className="text-sm text-slate-400">days</span>
                        </div>
                    </div>

                    {/* Version History Panel */}
                    {localVersions.length > 0 && (
                        <VersionHistoryPanel
                            projectId={projectId}
                            versions={localVersions}
                            currentVersionNumber={localCurrentVersion}
                            onRestored={() => window.location.reload()}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
