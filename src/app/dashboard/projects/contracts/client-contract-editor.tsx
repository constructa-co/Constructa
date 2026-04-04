"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, Plus, Trash2, Shield, AlertTriangle, Send, Upload, CheckCircle, Scale, MessageSquare } from "lucide-react";
import {
    saveTcTierAction,
    analyseContractAction,
    dismissContractFlagAction,
    saveRiskRegisterAction,
    generateRiskRegisterAction,
    saveContractExclusionsAction,
    generateContractExclusionsAction,
    contractChatAction,
} from "./actions";

// ── T&C Tier Definitions ─────────────────────────────────
const TC_TIERS = [
    {
        id: "domestic",
        name: "Domestic",
        subtitle: "For homeowner clients",
        description: "Plain English terms for residential projects. RICS Homeowner Adjudication. Simple payment terms.",
        clauses: 12,
    },
    {
        id: "commercial",
        name: "Commercial",
        subtitle: "For business clients",
        description: "JCT Minor Works based. Suitable for commercial and light industrial projects. Full liquidated damages and retention provisions.",
        clauses: 24,
    },
    {
        id: "specialist",
        name: "Specialist",
        subtitle: "For specialist/trade works",
        description: "Trade-specific terms. Suitable for subcontract packages and specialist installations.",
        clauses: 18,
    },
];

const DOMESTIC_CLAUSES = [
    { title: "Jurisdiction", body: "The law of Contract is the Law of England and Wales. The Language of this Contract is English." },
    { title: "Responsibilities", body: "The Works are detailed within the Scope of Works attached to this Proposal. All Works are to meet Statutory Requirements." },
    { title: "Alternative Dispute Resolution", body: "Disputes shall be referred to Adjudication. The Adjudicating Nominated Body is RICS, under the RICS Homeowner Adjudication Scheme." },
    { title: "Liability", body: "The Defect Liability Period is 12 months from the date of Completion Certificate." },
    { title: "Workmanship", body: "All Works are to be performed using reasonable skill and care to that of a competent Contractor." },
    { title: "Insurances", body: "The Contractor shall maintain: Public Liability, Employers Liability, and Contractors All Risk Insurance." },
    { title: "Payments", body: "Payment dates are 21 Calendar days from receipt of Application. Pay-Less-Notice must be issued within 7 days." },
    { title: "Change Management", body: "Any Variations must be issued in writing. The Contractor will respond within 7 Calendar days." },
    { title: "Health, Safety & CDM", body: "The Client is a Domestic Client under CDM 2015. The Contractor shall act as Principal Contractor." },
    { title: "Termination", body: "Either party may terminate with 14 days written notice for material breach unremedied." },
    { title: "Final Account", body: "The Final Account shall be prepared within 3 months of Practical Completion." },
    { title: "Retention", body: "No retention applies under domestic terms unless agreed otherwise in writing." },
];

const COMMERCIAL_CLAUSES = [
    { title: "Jurisdiction & Governing Law", body: "This Contract is governed by the Laws of England and Wales." },
    { title: "Scope of Works", body: "The Contractor shall carry out and complete the Works as defined in the Scope of Works and Bill of Quantities." },
    { title: "Contract Sum", body: "The Contract Sum is as stated in the Fee Proposal, subject to adjustment in accordance with these Conditions." },
    { title: "Commencement & Completion", body: "The Works shall commence on the date stated and shall be completed within the agreed programme duration." },
    { title: "Extensions of Time", body: "The Contractor may request an Extension of Time for delays caused by Relevant Events." },
    { title: "Liquidated Damages", body: "Should the Works not be completed by the Completion Date, the Contractor shall pay Liquidated Damages at the agreed rate." },
    { title: "Payment Terms", body: "Interim Applications are due monthly. Payment is due 14 days from the due date. Final date for payment is 21 days from due date." },
    { title: "Pay-Less Notice", body: "The Client must issue a Pay-Less Notice no later than 5 days before the final date for payment." },
    { title: "Retention", body: "Retention of 5% shall be deducted from each payment. Half released at Practical Completion, half at making good defects." },
    { title: "Variations", body: "The Client may issue instructions requiring a Variation. The Contractor shall price all Variations before execution." },
    { title: "Insurance", body: "The Contractor shall maintain CAR, PL (£5M), EL (£10M), and Professional Indemnity Insurance where applicable." },
    { title: "Indemnity", body: "The Contractor indemnifies the Client against claims arising from the Contractor's negligence." },
    { title: "Defects Liability", body: "The Defects Liability Period is 12 months from Practical Completion." },
    { title: "Termination by Client", body: "The Client may terminate for material breach or insolvency with 14 days notice." },
    { title: "Termination by Contractor", body: "The Contractor may terminate for non-payment or suspension exceeding 2 months." },
    { title: "Suspension", body: "The Contractor may suspend works for non-payment after giving 7 days notice." },
    { title: "Adjudication", body: "Either party may refer a dispute to Adjudication at any time under the Housing Grants Act 1996." },
    { title: "Sub-Contracting", body: "The Contractor shall not sub-contract without written consent, which shall not be unreasonably withheld." },
    { title: "CDM 2015", body: "The Principal Contractor obligations are as defined under CDM 2015." },
    { title: "Assignment", body: "Neither party shall assign the benefit of this Contract without prior written consent." },
    { title: "Notices", body: "All notices shall be in writing and delivered to the addresses stated in the Contract." },
    { title: "Confidentiality", body: "Both parties shall treat the terms of this Contract as confidential." },
    { title: "Final Account", body: "The Final Account shall be agreed within 6 months of Practical Completion." },
    { title: "Entire Agreement", body: "This Contract constitutes the entire agreement between the parties." },
];

const SPECIALIST_CLAUSES = [
    { title: "Jurisdiction", body: "Governed by the Laws of England and Wales." },
    { title: "Scope of Specialist Works", body: "The Sub-Contractor shall carry out the Specialist Works as described in the Sub-Contract Scope." },
    { title: "Programme & Access", body: "The Sub-Contractor shall comply with the Main Contractor's programme and provide required lead times." },
    { title: "Payment", body: "Payment terms are as per the Housing Grants Act 1996. Applications to be submitted monthly." },
    { title: "Retention", body: "Retention of 5% applies unless otherwise agreed." },
    { title: "Design Responsibility", body: "The Sub-Contractor accepts design responsibility for the specialist elements where specified." },
    { title: "Warranties", body: "The Sub-Contractor shall provide manufacturer warranties for all installed products." },
    { title: "Testing & Commissioning", body: "The Sub-Contractor shall carry out all testing and commissioning of installed systems." },
    { title: "Attendances", body: "General attendances by the Main Contractor are included. Special attendances shall be agreed." },
    { title: "Insurance", body: "The Sub-Contractor shall maintain PL, EL, and PI Insurance as applicable." },
    { title: "Defects", body: "The Defects Liability Period is 12 months from completion of the Sub-Contract Works." },
    { title: "Variations", body: "Variations shall be agreed in writing prior to execution." },
    { title: "Dispute Resolution", body: "Disputes to be referred to Adjudication." },
    { title: "Health & Safety", body: "The Sub-Contractor shall comply with the site-specific Health and Safety Plan." },
    { title: "Clean-Up", body: "The Sub-Contractor is responsible for clearing away waste from their works daily." },
    { title: "Coordination", body: "The Sub-Contractor shall coordinate with other trades and attend progress meetings as required." },
    { title: "Final Account", body: "The Sub-Contract Final Account shall be submitted within 3 months of Sub-Contract Completion." },
    { title: "Termination", body: "Either party may terminate with 7 days notice for material breach." },
];

function getTierClauses(tier: string) {
    if (tier === "commercial") return COMMERCIAL_CLAUSES;
    if (tier === "specialist") return SPECIALIST_CLAUSES;
    return DOMESTIC_CLAUSES;
}

// ── Severity badge colours ───────────────────────────────
function severityColor(severity: string) {
    if (severity === "high") return "bg-red-100 text-red-700 border-red-200";
    if (severity === "medium") return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-green-100 text-green-700 border-green-200";
}

function likelihoodColor(level: string) {
    if (level === "high") return "bg-red-100 text-red-700";
    if (level === "medium") return "bg-amber-100 text-amber-700";
    return "bg-green-100 text-green-700";
}

// ── Interfaces ───────────────────────────────────────────
interface RiskItem {
    id: string;
    type: "risk" | "opportunity";
    description: string;
    likelihood: string;
    impact: string;
    mitigation: string;
}

interface ChatMsg {
    role: "user" | "assistant";
    content: string;
}

interface Props {
    projectId: string;
    project: any;
    profile?: any;
}

// ── Component ────────────────────────────────────────────
export default function ClientContractEditor({ projectId, project, profile }: Props) {
    const [isPending, startTransition] = useTransition();
    const [activeTab, setActiveTab] = useState<"terms" | "risks" | "exclusions" | "chat">("terms");

    // Tab A: T&Cs
    const [tcTier, setTcTier] = useState<string>(project?.tc_tier || "domestic");
    const [contractFlags, setContractFlags] = useState<any[]>(project?.contract_review_flags || []);
    const [analysing, setAnalysing] = useState(false);
    const [uploadedText, setUploadedText] = useState(project?.uploaded_contract_text || "");

    // Tab B: Risks
    const [riskRegister, setRiskRegister] = useState<RiskItem[]>(
        (project?.risk_register || []).map((r: any) => ({ ...r, id: r.id || crypto.randomUUID() }))
    );
    const [generatingRisks, setGeneratingRisks] = useState(false);

    // Tab C: Exclusions
    const [contractExclusions, setContractExclusions] = useState(project?.contract_exclusions || "");
    const [contractClarifications, setContractClarifications] = useState(project?.contract_clarifications || "");
    const [generatingExcl, setGeneratingExcl] = useState(false);

    // Tab D: Chat
    const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);

    const tabCls = (tab: string) =>
        `px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === tab
                ? "bg-gray-900 text-white"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
        }`;

    // ── Tab A handlers ───────────────────────────────────
    const handleSelectTier = (tier: string) => {
        setTcTier(tier);
        startTransition(async () => {
            await saveTcTierAction(projectId, tier);
            toast.success(`${tier.charAt(0).toUpperCase() + tier.slice(1)} terms selected`);
        });
    };

    const [uploadedFileName, setUploadedFileName] = useState("");

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadedFileName(file.name);

        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext === "txt") {
            // Plain text — read client-side
            const reader = new FileReader();
            reader.onload = (ev) => {
                const text = ev.target?.result as string;
                setUploadedText(text);
                toast.success("Contract text loaded — click Analyse to review");
            };
            reader.readAsText(file);
        } else {
            // PDF/DOCX — upload to Supabase storage
            try {
                const { createClient } = await import("@/lib/supabase/client");
                const supabase = createClient();
                const filePath = `${projectId}/${Date.now()}_${file.name}`;
                const { error } = await supabase.storage.from("contracts").upload(filePath, file);
                if (error) {
                    // Bucket may not exist — try creating it first
                    toast.error("Upload failed: " + error.message);
                    return;
                }
                setUploadedText(`[FILE:${filePath}] ${file.name}`);
                toast.success("PDF/DOCX uploaded. AI analysis will extract key clauses.");
            } catch {
                toast.error("Upload failed");
            }
        }
    };

    const handleAnalyse = async () => {
        if (!uploadedText) {
            toast.error("Upload a contract first");
            return;
        }
        setAnalysing(true);
        try {
            const result = await analyseContractAction(projectId, uploadedText);
            setContractFlags(result.flags || []);
            toast.success(`Found ${(result.flags || []).length} items to review`);
        } catch {
            toast.error("Analysis failed");
        }
        setAnalysing(false);
    };

    // ── Tab B handlers ───────────────────────────────────
    const addRiskItem = (type: "risk" | "opportunity") => {
        setRiskRegister(prev => [...prev, {
            id: crypto.randomUUID(),
            type,
            description: "",
            likelihood: "medium",
            impact: "medium",
            mitigation: "",
        }]);
    };

    const updateRiskItem = (id: string, field: string, value: string) => {
        setRiskRegister(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const deleteRiskItem = (id: string) => {
        setRiskRegister(prev => prev.filter(r => r.id !== id));
    };

    const handleSaveRisks = () => {
        startTransition(async () => {
            await saveRiskRegisterAction(projectId, riskRegister);
            toast.success("Risk register saved");
        });
    };

    const handleGenerateRisks = async () => {
        setGeneratingRisks(true);
        try {
            const result = await generateRiskRegisterAction(
                projectId,
                project?.brief_scope || project?.scope_text || "",
                project?.project_type || ""
            );
            const items: RiskItem[] = [
                ...(result.risks || []).map((r: any) => ({ id: crypto.randomUUID(), type: "risk" as const, description: r.description, likelihood: r.likelihood, impact: r.impact, mitigation: r.mitigation })),
                ...(result.opportunities || []).map((o: any) => ({ id: crypto.randomUUID(), type: "opportunity" as const, description: o.description, likelihood: o.likelihood, impact: o.impact, mitigation: o.action })),
            ];
            setRiskRegister(prev => [...prev, ...items]);
            toast.success(`Generated ${items.length} items`);
        } catch {
            toast.error("Generation failed");
        }
        setGeneratingRisks(false);
    };

    // ── Tab C handlers ───────────────────────────────────
    const handleSaveExclusions = () => {
        startTransition(async () => {
            await saveContractExclusionsAction(projectId, contractExclusions, contractClarifications);
            toast.success("Exclusions & clarifications saved");
        });
    };

    const handleGenerateExclusions = async () => {
        setGeneratingExcl(true);
        try {
            const result = await generateContractExclusionsAction(
                project?.brief_scope || project?.scope_text || "",
                project?.project_type || ""
            );
            if (result.exclusions) setContractExclusions((prev: string) => prev ? prev + "\n" + result.exclusions : result.exclusions);
            if (result.clarifications) setContractClarifications((prev: string) => prev ? prev + "\n" + result.clarifications : result.clarifications);
            toast.success("Suggestions added");
        } catch {
            toast.error("Generation failed");
        }
        setGeneratingExcl(false);
    };

    // ── Tab D handlers ───────────────────────────────────
    const handleChat = async () => {
        if (!chatInput.trim()) return;
        const userMsg = chatInput.trim();
        setChatInput("");
        setChatMessages(prev => [...prev, { role: "user", content: userMsg }]);
        setChatLoading(true);
        try {
            const result = await contractChatAction(userMsg, {
                tcTier,
                projectType: project?.project_type || "",
                flags: contractFlags,
            });
            setChatMessages(prev => [...prev, { role: "assistant", content: result.response }]);
        } catch {
            setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't process that request. Please try again." }]);
        }
        setChatLoading(false);
    };

    const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900";

    return (
        <div className="space-y-6">
            {/* Tab bar */}
            <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
                <button onClick={() => setActiveTab("terms")} className={tabCls("terms")}>
                    <Scale className="w-4 h-4 inline mr-1.5" />Terms & Conditions
                </button>
                <button onClick={() => setActiveTab("risks")} className={tabCls("risks")}>
                    <Shield className="w-4 h-4 inline mr-1.5" />Risk & Opportunities
                </button>
                <button onClick={() => setActiveTab("exclusions")} className={tabCls("exclusions")}>
                    <AlertTriangle className="w-4 h-4 inline mr-1.5" />Exclusions & Clarifications
                </button>
                <button onClick={() => setActiveTab("chat")} className={tabCls("chat")}>
                    <MessageSquare className="w-4 h-4 inline mr-1.5" />Contract AI
                </button>
            </div>

            {/* ═══ TAB A: Terms & Conditions ═══ */}
            {activeTab === "terms" && (
                <div className="space-y-6">
                    {/* Tier cards */}
                    <div className="grid grid-cols-3 gap-4">
                        {TC_TIERS.map(tier => (
                            <button
                                key={tier.id}
                                onClick={() => handleSelectTier(tier.id)}
                                className={`text-left p-5 rounded-xl border-2 transition-all ${
                                    tcTier === tier.id
                                        ? "border-gray-900 bg-gray-50 shadow-md"
                                        : "border-gray-200 bg-white hover:border-gray-400"
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-lg font-bold text-gray-900">{tier.name}</h3>
                                    {tcTier === tier.id && <CheckCircle className="w-5 h-5 text-green-600" />}
                                </div>
                                <p className="text-xs font-medium text-gray-500 mb-2">{tier.subtitle}</p>
                                <p className="text-sm text-gray-600">{tier.description}</p>
                                <p className="text-xs text-gray-400 mt-3">{tier.clauses} clauses</p>
                            </button>
                        ))}
                    </div>

                    {/* Clause list for selected tier */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">
                            {tcTier.charAt(0).toUpperCase() + tcTier.slice(1)} Terms — {getTierClauses(tcTier).length} Clauses
                        </h3>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {getTierClauses(tcTier).map((clause, i) => (
                                <div key={i} className="border border-gray-100 rounded-lg p-3">
                                    <h4 className="text-sm font-semibold text-gray-900">{i + 1}. {clause.title}</h4>
                                    <p className="text-xs text-gray-600 mt-1">{clause.body}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Upload Client Contract */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Upload Client Contract for Review</h3>
                        <p className="text-xs text-gray-500">Upload a contract (TXT, PDF, or DOCX) to have AI flag onerous clauses and unusual terms.</p>
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 text-sm font-medium">
                                <Upload className="w-4 h-4" />
                                Upload Contract
                                <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleFileUpload} />
                            </label>
                            <button
                                onClick={handleAnalyse}
                                disabled={!uploadedText || analysing}
                                className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
                            >
                                {analysing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                {analysing ? "Analysing..." : "Analyse with AI"}
                            </button>
                            {uploadedText && (
                                <span className="text-xs text-green-600 font-medium">
                                    {uploadedText.startsWith("[FILE:")
                                        ? `${uploadedFileName || "Contract"} uploaded ✓ — click Analyse to review`
                                        : `Contract loaded (${uploadedText.length} chars)`}
                                </span>
                            )}
                        </div>

                        {/* Flags display */}
                        {contractFlags.length > 0 && (
                            <div className="space-y-3 mt-4">
                                <h4 className="text-sm font-bold text-gray-900">Review Flags ({contractFlags.filter((f: any) => !f.dismissed).length} active, {contractFlags.filter((f: any) => f.dismissed).length} resolved)</h4>
                                {contractFlags.map((flag: any, i: number) => (
                                    <div key={i} className={`border rounded-lg p-4 ${flag.dismissed ? "opacity-50 bg-gray-50 border-gray-200" : severityColor(flag.severity)}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold uppercase">{flag.severity}</span>
                                            <span className="text-xs font-medium">— {flag.type}</span>
                                            {flag.dismissed && (
                                                <span className="text-xs font-bold uppercase ml-auto px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                                                    {flag.dismiss_status === "accepted" ? "Accepted" : "Disputed"}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm font-semibold">{flag.clause}</p>
                                        <p className="text-sm mt-1">{flag.description}</p>
                                        {flag.recommendation && (
                                            <p className="text-xs mt-2 font-medium opacity-80">Recommendation: {flag.recommendation}</p>
                                        )}
                                        {!flag.dismissed && (
                                            <div className="flex items-center gap-3 mt-3 pt-2 border-t border-current/10">
                                                <button
                                                    onClick={async () => {
                                                        const updated = await dismissContractFlagAction(projectId, i, "accepted");
                                                        if (updated) setContractFlags(updated);
                                                    }}
                                                    className="text-xs text-gray-500 hover:text-green-600 font-medium"
                                                >
                                                    Accept risk
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        const updated = await dismissContractFlagAction(projectId, i, "disputed");
                                                        if (updated) setContractFlags(updated);
                                                    }}
                                                    className="text-xs text-gray-500 hover:text-red-600 font-medium"
                                                >
                                                    Dispute
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ TAB B: Risk & Opportunities ═══ */}
            {activeTab === "risks" && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Risk & Opportunity Register</h3>
                            <p className="text-xs text-gray-500">Track project risks and opportunities to inform your pricing and programme.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleGenerateRisks}
                                disabled={generatingRisks}
                                className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
                            >
                                {generatingRisks ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                AI Generate
                            </button>
                            <button
                                onClick={handleSaveRisks}
                                disabled={isPending}
                                className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50"
                            >
                                Save Register
                            </button>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-6">
                        {/* Risks column */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-red-700 uppercase tracking-wide">Risks</h4>
                                <button onClick={() => addRiskItem("risk")} className="text-xs flex items-center gap-1 text-red-600 hover:text-red-800 font-medium">
                                    <Plus className="w-3 h-3" /> Add Risk
                                </button>
                            </div>
                            {riskRegister.filter(r => r.type === "risk").map(item => (
                                <div key={item.id} className="bg-white border border-red-200 rounded-lg p-4 space-y-2">
                                    <textarea
                                        className={inputCls}
                                        rows={2}
                                        value={item.description}
                                        onChange={e => updateRiskItem(item.id, "description", e.target.value)}
                                        placeholder="Describe the risk..."
                                    />
                                    <div className="flex items-center gap-2">
                                        <select className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-900" value={item.likelihood} onChange={e => updateRiskItem(item.id, "likelihood", e.target.value)}>
                                            <option value="low">Low likelihood</option>
                                            <option value="medium">Medium likelihood</option>
                                            <option value="high">High likelihood</option>
                                        </select>
                                        <select className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-900" value={item.impact} onChange={e => updateRiskItem(item.id, "impact", e.target.value)}>
                                            <option value="low">Low impact</option>
                                            <option value="medium">Medium impact</option>
                                            <option value="high">High impact</option>
                                        </select>
                                        <button onClick={() => deleteRiskItem(item.id)} className="ml-auto text-red-400 hover:text-red-600">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <input
                                        className={inputCls}
                                        value={item.mitigation}
                                        onChange={e => updateRiskItem(item.id, "mitigation", e.target.value)}
                                        placeholder="Mitigation strategy..."
                                    />
                                </div>
                            ))}
                            {riskRegister.filter(r => r.type === "risk").length === 0 && (
                                <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                                    No risks added yet
                                </div>
                            )}
                        </div>

                        {/* Opportunities column */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-green-700 uppercase tracking-wide">Opportunities</h4>
                                <button onClick={() => addRiskItem("opportunity")} className="text-xs flex items-center gap-1 text-green-600 hover:text-green-800 font-medium">
                                    <Plus className="w-3 h-3" /> Add Opportunity
                                </button>
                            </div>
                            {riskRegister.filter(r => r.type === "opportunity").map(item => (
                                <div key={item.id} className="bg-white border border-green-200 rounded-lg p-4 space-y-2">
                                    <textarea
                                        className={inputCls}
                                        rows={2}
                                        value={item.description}
                                        onChange={e => updateRiskItem(item.id, "description", e.target.value)}
                                        placeholder="Describe the opportunity..."
                                    />
                                    <div className="flex items-center gap-2">
                                        <select className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-900" value={item.likelihood} onChange={e => updateRiskItem(item.id, "likelihood", e.target.value)}>
                                            <option value="low">Low likelihood</option>
                                            <option value="medium">Medium likelihood</option>
                                            <option value="high">High likelihood</option>
                                        </select>
                                        <select className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-900" value={item.impact} onChange={e => updateRiskItem(item.id, "impact", e.target.value)}>
                                            <option value="low">Low impact</option>
                                            <option value="medium">Medium impact</option>
                                            <option value="high">High impact</option>
                                        </select>
                                        <button onClick={() => deleteRiskItem(item.id)} className="ml-auto text-red-400 hover:text-red-600">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <input
                                        className={inputCls}
                                        value={item.mitigation}
                                        onChange={e => updateRiskItem(item.id, "mitigation", e.target.value)}
                                        placeholder="Action to capture this opportunity..."
                                    />
                                </div>
                            ))}
                            {riskRegister.filter(r => r.type === "opportunity").length === 0 && (
                                <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                                    No opportunities added yet
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ TAB C: Exclusions & Clarifications ═══ */}
            {activeTab === "exclusions" && (
                <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
                        These will be included automatically in your Proposal PDF.
                    </div>

                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900">Exclusions & Clarifications</h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleGenerateExclusions}
                                disabled={generatingExcl}
                                className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
                            >
                                {generatingExcl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                AI Suggest
                            </button>
                            <button
                                onClick={handleSaveExclusions}
                                disabled={isPending}
                                className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50"
                            >
                                Save
                            </button>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Exclusions</label>
                            <textarea
                                className={inputCls}
                                rows={12}
                                value={contractExclusions}
                                onChange={e => setContractExclusions(e.target.value)}
                                placeholder="One exclusion per line, e.g.&#10;Asbestos removal&#10;Party wall surveys&#10;Building control fees..."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Clarifications</label>
                            <textarea
                                className={inputCls}
                                rows={12}
                                value={contractClarifications}
                                onChange={e => setContractClarifications(e.target.value)}
                                placeholder="One clarification per line, e.g.&#10;Working hours Mon-Fri 08:00-17:00&#10;Access to site assumed clear..."
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ TAB D: Contract AI Chat ═══ */}
            {activeTab === "chat" && (
                <div className="border border-gray-200 rounded-xl bg-white overflow-hidden flex flex-col" style={{ height: "calc(100vh - 20rem)" }}>
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-sm font-bold text-gray-900">Contract AI Assistant</h3>
                        <p className="text-xs text-gray-500">Ask questions about contract terms, risks, and standard UK construction practice.</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {chatMessages.length === 0 && (
                            <div className="text-center py-10 text-gray-400">
                                <MessageSquare className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                                <p className="text-sm">Ask me about contract terms, payment conditions, risk allocation, or standard UK practice.</p>
                                <p className="text-xs mt-2 text-gray-300">e.g. &ldquo;What retention percentage is standard for domestic works?&rdquo;</p>
                            </div>
                        )}
                        {chatMessages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                                    msg.role === "user"
                                        ? "bg-gray-900 text-white"
                                        : "bg-gray-100 text-gray-800"
                                }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {chatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-100 rounded-lg px-3 py-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-gray-200 p-3 flex gap-2">
                        <input
                            className="flex-1 h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleChat()}
                            placeholder="Ask about contract terms..."
                        />
                        <button
                            onClick={handleChat}
                            disabled={chatLoading || !chatInput.trim()}
                            className="h-10 px-4 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
