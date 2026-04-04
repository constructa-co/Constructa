"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, Plus, Trash2, Shield, AlertTriangle, Send, Upload, CheckCircle, Scale, MessageSquare, ShieldCheck, ShieldAlert, FileEdit } from "lucide-react";
import {
    saveTcTierAction,
    analyseContractAction,
    dismissContractFlagAction,
    saveRiskRegisterAction,
    generateRiskRegisterAction,
    saveContractExclusionsAction,
    generateContractExclusionsAction,
    contractChatAction,
    extractContractTextAction,
    structureClientContractAction,
    saveClientContractClausesAction,
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

// ── Severity badge colours (dark-theme aware) ────────────
function severityColor(severity: string) {
    if (severity === "high") return "bg-red-950/60 text-red-300 border-red-700";
    if (severity === "medium") return "bg-amber-950/60 text-amber-300 border-amber-700";
    return "bg-green-950/60 text-green-300 border-green-700";
}

function likelihoodColor(level: string) {
    if (level === "high") return "bg-red-950/60 text-red-300";
    if (level === "medium") return "bg-amber-950/60 text-amber-300";
    return "bg-green-950/60 text-green-300";
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

interface ClientClause {
    id: string;
    clauseRef: string;
    title: string;
    original: string;
    proposed: string;
    status: "accepted" | "modified" | "rejected";
    reason: string;
    flagged: boolean;
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
    const [extracting, setExtracting] = useState(false);
    const [showPasteMode, setShowPasteMode] = useState(false);
    const [clientClauses, setClientClauses] = useState<ClientClause[]>(
        (project?.client_contract_clauses || []).map((c: any) => ({ ...c }))
    );
    const [parsingClauses, setParsingClauses] = useState(false);

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

    const activeFlags = contractFlags.filter((f: any) => !f.dismissed);
    const highFlags = activeFlags.filter((f: any) => f.severity === "high").length;
    const mediumFlags = activeFlags.filter((f: any) => f.severity === "medium").length;

    const tabCls = (tab: string) =>
        `px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === tab
                ? "bg-slate-700 text-white shadow"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
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
            // Plain text — read client-side instantly
            const reader = new FileReader();
            reader.onload = (ev) => {
                const text = ev.target?.result as string;
                setUploadedText(text);
                toast.success("Contract text loaded — click Analyse to review");
            };
            reader.readAsText(file);
        } else if (ext === "pdf" || ext === "docx" || ext === "doc") {
            // Upload to Supabase storage, then extract server-side
            try {
                const { createClient } = await import("@/lib/supabase/client");
                const supabase = createClient();
                const filePath = `${projectId}/${Date.now()}_${file.name}`;
                const { error: uploadError } = await supabase.storage.from("contracts").upload(filePath, file);
                if (uploadError) {
                    toast.error("Upload failed: " + uploadError.message);
                    return;
                }

                // Extract text server-side via server action
                setExtracting(true);
                toast.info("Extracting text from " + file.name + "…");
                const result = await extractContractTextAction(filePath);
                setExtracting(false);

                if (result.error || !result.text) {
                    toast.error(result.error || "Could not extract text from file.");
                    // Keep a fallback so user knows file is there
                    setUploadedText(`[FILE:${filePath}] ${file.name}`);
                    return;
                }

                setUploadedText(result.text);
                toast.success(`Text extracted (${result.text.length.toLocaleString()} chars) — click Analyse to review`);
            } catch {
                setExtracting(false);
                toast.error("Upload or extraction failed");
            }
        } else {
            toast.error("Unsupported file type. Use PDF, DOCX, or TXT.");
        }
    };

    const handleAnalyse = async () => {
        if (!uploadedText) {
            toast.error("Upload a contract first");
            return;
        }
        if (uploadedText.startsWith("[FILE:")) {
            toast.error("Text extraction failed — try re-uploading or use Paste text instead.");
            return;
        }
        setAnalysing(true);
        try {
            const result = await analyseContractAction(projectId, uploadedText);
            if (!result) {
                toast.error("Analysis returned no response — check your OpenAI API key in Vercel settings.");
            } else if (result.error) {
                toast.error("Analysis error: " + result.error);
            } else {
                const flags = result.flags ?? [];
                setContractFlags(flags);
                const high = flags.filter(f => f.severity === "high").length;
                const med = flags.filter(f => f.severity === "medium").length;
                const low = flags.length - high - med;
                if (flags.length === 0) {
                    toast.warning("No items found — the contract may be very short or the AI returned empty results. Try again.");
                } else {
                    toast.success(`Review complete — ${high} high, ${med} medium, ${low} low risk items`);
                }
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            toast.error("Analysis failed: " + msg);
        }
        setAnalysing(false);
    };

    // ── Import contract flags → Risk Register ────────────
    const handleImportFlagsToRisks = () => {
        const importable = contractFlags.filter((f: any) => !f.dismissed && (f.severity === "high" || f.severity === "medium"));
        if (importable.length === 0) {
            toast.info("No high or medium risk flags to import — run a contract review first.");
            return;
        }
        const newRisks: RiskItem[] = importable.map((flag: any) => ({
            id: crypto.randomUUID(),
            type: "risk" as const,
            description: `[Contract] ${flag.clause} — ${flag.description}`,
            likelihood: flag.severity === "high" ? "high" : "medium",
            impact: flag.severity === "high" ? "high" : "medium",
            mitigation: flag.recommendation || "",
        }));
        setRiskRegister(prev => [...prev, ...newRisks]);
        setActiveTab("risks");
        toast.success(`${newRisks.length} contract risk${newRisks.length !== 1 ? "s" : ""} imported — review mitigations and save`);
    };

    // ── Parse client contract into clauses ───────────────
    const handleParseClientContract = async () => {
        if (!uploadedText || uploadedText.startsWith("[FILE:")) {
            toast.error("Upload or paste the client contract first, then run a review.");
            return;
        }
        setParsingClauses(true);
        try {
            const result = await structureClientContractAction(
                uploadedText,
                contractFlags.filter((f: any) => !f.dismissed)
            );
            if (!result?.clauses?.length) {
                toast.error("Could not parse contract into clauses — try again.");
            } else {
                setClientClauses(result.clauses);
                await saveClientContractClausesAction(projectId, result.clauses);
                setTcTier("client");
                toast.success(`${result.clauses.length} clauses parsed — review and mark your response`);
            }
        } catch {
            toast.error("Parsing failed — try again");
        }
        setParsingClauses(false);
    };

    const handleSaveClientClauses = () => {
        startTransition(async () => {
            await saveClientContractClausesAction(projectId, clientClauses);
            toast.success("Contractor response saved");
        });
    };

    const updateClientClause = (id: string, field: keyof ClientClause, value: string) => {
        setClientClauses(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handleDownloadAmendedContract = async () => {
        const jsPDF = (await import("jspdf")).default;
        const { buildDocHeader, buildDocFooter, checkPageBreak, BRAND } = await import("@/lib/pdf/pdf-utils");

        const doc = new jsPDF();
        let y = buildDocHeader(doc, {
            documentTitle: "Contractor's Proposed Amendments",
            profile,
            rightBlockLines: [
                `Date: ${new Date().toLocaleDateString("en-GB")}`,
                `Project: ${project?.name || "N/A"}`,
            ],
        });

        y += 2;
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 100, 100);
        const note = doc.splitTextToSize("This document sets out the Contractor's proposed amendments to the Client's Contract. Clauses marked ACCEPTED are agreed as presented. Clauses marked MODIFICATION PROPOSED contain the Contractor's alternative wording. Clauses marked REJECTED are not agreed and require negotiation.", BRAND.contentW);
        note.forEach((line: string) => { y = checkPageBreak(doc, y, 6); doc.text(line, BRAND.marginL, y); y += 5; });
        y += 4;

        const accepted = clientClauses.filter(c => c.status === "accepted");
        const modified = clientClauses.filter(c => c.status === "modified");
        const rejected = clientClauses.filter(c => c.status === "rejected");

        // Summary box
        doc.setFillColor(248, 248, 248);
        doc.roundedRect(BRAND.marginL, y, BRAND.contentW, 16, 2, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...BRAND.slate);
        doc.text(`Summary: ${accepted.length} Accepted  |  ${modified.length} Modification Proposed  |  ${rejected.length} Rejected`, BRAND.marginL + 4, y + 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Contractor reserves the right to withdraw acceptance if any rejected/modified clauses are not resolved.", BRAND.marginL + 4, y + 12);
        y += 22;

        const renderClause = (clause: ClientClause) => {
            y = checkPageBreak(doc, y, 30);

            // Status colour
            const colors: Record<string, [number, number, number]> = {
                accepted: [0, 120, 60],
                modified: [180, 100, 0],
                rejected: [180, 0, 0],
            };
            const labels: Record<string, string> = { accepted: "ACCEPTED", modified: "MODIFICATION PROPOSED", rejected: "REJECTED" };
            const [r, g, b] = colors[clause.status] || [80, 80, 80];

            // Clause header
            doc.setFillColor(r, g, b);
            doc.roundedRect(BRAND.marginL, y, BRAND.contentW, 8, 1, 1, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.text(`${clause.clauseRef}  ${clause.title}`, BRAND.marginL + 3, y + 5.5);
            doc.text(labels[clause.status], BRAND.marginL + BRAND.contentW - 3, y + 5.5, { align: "right" });
            y += 10;

            // Original text
            doc.setTextColor(...BRAND.slate);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            const origLines = doc.splitTextToSize(`Client's version: ${clause.original}`, BRAND.contentW);
            origLines.forEach((line: string) => { y = checkPageBreak(doc, y, 6); doc.text(line, BRAND.marginL, y); y += 5; });

            if (clause.status === "modified" && clause.proposed) {
                y += 2;
                doc.setFont("helvetica", "bolditalic");
                doc.setTextColor(r, g, b);
                const propLines = doc.splitTextToSize(`Contractor proposes: ${clause.proposed}`, BRAND.contentW);
                propLines.forEach((line: string) => { y = checkPageBreak(doc, y, 6); doc.text(line, BRAND.marginL, y); y += 5; });
            }
            if (clause.status === "rejected" && clause.reason) {
                y += 2;
                doc.setFont("helvetica", "bolditalic");
                doc.setTextColor(r, g, b);
                const rejLines = doc.splitTextToSize(`Reason for rejection: ${clause.reason}`, BRAND.contentW);
                rejLines.forEach((line: string) => { y = checkPageBreak(doc, y, 6); doc.text(line, BRAND.marginL, y); y += 5; });
            }
            y += 6;
        };

        clientClauses.forEach(renderClause);

        // Exclusions & clarifications
        if (contractExclusions || contractClarifications) {
            y = checkPageBreak(doc, y, 20);
            doc.setFillColor(240, 245, 255);
            doc.roundedRect(BRAND.marginL, y, BRAND.contentW, 8, 1, 1, "F");
            doc.setTextColor(...(BRAND.navy || BRAND.slate));
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.text("Contractor's Exclusions & Clarifications", BRAND.marginL + 3, y + 5.5);
            y += 12;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(...BRAND.slate);
            if (contractExclusions) {
                contractExclusions.split("\n").filter(Boolean).forEach((line: string) => {
                    y = checkPageBreak(doc, y, 6);
                    doc.text(`• ${line.trim()}`, BRAND.marginL + 3, y);
                    y += 5;
                });
            }
            if (contractClarifications) {
                y += 3;
                doc.setFont("helvetica", "bold");
                doc.text("Clarifications:", BRAND.marginL, y); y += 5;
                doc.setFont("helvetica", "normal");
                contractClarifications.split("\n").filter(Boolean).forEach((line: string) => {
                    y = checkPageBreak(doc, y, 6);
                    doc.text(`• ${line.trim()}`, BRAND.marginL + 3, y);
                    y += 5;
                });
            }
        }

        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            buildDocFooter(doc, i, totalPages, "Constructa — Contractor's Proposed Amendments");
        }

        doc.save(`CONTRACT-RESPONSE-${(project?.name || "Project").replace(/\s+/g, "_")}.pdf`);
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
            // Pass active contract flags so AI can generate targeted exclusions
            const activeFlagsForExcl = contractFlags.filter((f: any) => !f.dismissed);
            const result = await generateContractExclusionsAction(
                project?.brief_scope || project?.scope_text || "",
                project?.project_type || "",
                activeFlagsForExcl.length > 0 ? activeFlagsForExcl : undefined
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

    const inputCls = "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500";

    return (
        <div className="space-y-6">

            {/* ═══ CONTRACT SHIELD HERO ═══ */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 p-6">
                <div className="absolute inset-0 opacity-5">
                    <Shield className="w-64 h-64 absolute -right-8 -top-8 text-white" />
                </div>
                <div className="relative flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center shadow-lg">
                            <ShieldCheck className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-0.5">
                                <h2 className="text-xl font-bold text-white">Contract Shield</h2>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-600/30 text-purple-300 border border-purple-600/50">AI-Powered</span>
                            </div>
                            <p className="text-sm text-slate-400">Protect your business with AI contract review, risk management, and UK construction law awareness.</p>
                        </div>
                    </div>
                    {/* Flag summary badges */}
                    {contractFlags.length > 0 && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {highFlags > 0 && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-700 text-red-300 text-xs font-bold">
                                    <ShieldAlert className="w-3.5 h-3.5" />
                                    {highFlags} High
                                </div>
                            )}
                            {mediumFlags > 0 && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-700 text-amber-300 text-xs font-bold">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    {mediumFlags} Amber
                                </div>
                            )}
                            {activeFlags.length === 0 && contractFlags.length > 0 && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-950/60 border border-green-700 text-green-300 text-xs font-bold">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    All Clear
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-xl border border-slate-700">
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
                    <div className={`grid gap-4 ${clientClauses.length > 0 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3"}`}>
                        {TC_TIERS.map(tier => (
                            <button
                                key={tier.id}
                                onClick={() => handleSelectTier(tier.id)}
                                className={`text-left p-5 rounded-xl border-2 transition-all ${
                                    tcTier === tier.id
                                        ? "border-purple-500 bg-purple-950/30 shadow-md shadow-purple-900/20"
                                        : "border-slate-700 bg-slate-800/50 hover:border-slate-500"
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-lg font-bold text-slate-100">{tier.name}</h3>
                                    {tcTier === tier.id && <CheckCircle className="w-5 h-5 text-purple-400" />}
                                </div>
                                <p className="text-xs font-medium text-slate-400 mb-2">{tier.subtitle}</p>
                                <p className="text-sm text-slate-300">{tier.description}</p>
                                <p className="text-xs text-slate-500 mt-3">{tier.clauses} clauses</p>
                            </button>
                        ))}
                        {/* 4th tier: client contract */}
                        {clientClauses.length > 0 && (
                            <button
                                onClick={() => setTcTier("client")}
                                className={`text-left p-5 rounded-xl border-2 transition-all ${
                                    tcTier === "client"
                                        ? "border-purple-500 bg-purple-950/30 shadow-md shadow-purple-900/20"
                                        : "border-slate-700 bg-slate-800/50 hover:border-slate-500"
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-lg font-bold text-slate-100">Client Contract</h3>
                                    {tcTier === "client" && <CheckCircle className="w-5 h-5 text-purple-400" />}
                                </div>
                                <p className="text-xs font-medium text-slate-400 mb-2">Contractor&apos;s amended response</p>
                                <p className="text-sm text-slate-300">Review, modify, or reject client clauses. Download formal contractor response.</p>
                                <div className="flex items-center gap-2 mt-3">
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-950/60 text-green-400">{clientClauses.filter(c => c.status === "accepted").length} accepted</span>
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400">{clientClauses.filter(c => c.status === "modified").length} modified</span>
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-950/60 text-red-400">{clientClauses.filter(c => c.status === "rejected").length} rejected</span>
                                </div>
                            </button>
                        )}
                    </div>

                    {/* Clause list for selected tier */}
                    {tcTier !== "client" && (
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-4">
                                {tcTier.charAt(0).toUpperCase() + tcTier.slice(1)} Terms — {getTierClauses(tcTier).length} Clauses
                            </h3>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {getTierClauses(tcTier).map((clause, i) => (
                                    <div key={i} className="border border-slate-700/60 rounded-lg p-3 bg-slate-900/40">
                                        <h4 className="text-sm font-semibold text-slate-200">{i + 1}. {clause.title}</h4>
                                        <p className="text-xs text-slate-400 mt-1">{clause.body}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Client contract clause editor ── */}
                    {tcTier === "client" && clientClauses.length > 0 && (
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-200">Contractor&apos;s Response — Clause by Clause</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Mark each clause as Accept, Modify, or Reject. Edit proposed wording inline. Download when complete.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleSaveClientClauses}
                                        disabled={isPending}
                                        className="px-3 py-1.5 bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-600 disabled:opacity-50 transition-colors"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={handleDownloadAmendedContract}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors"
                                    >
                                        <FileEdit className="w-3.5 h-3.5" />
                                        Download Response PDF
                                    </button>
                                </div>
                            </div>
                            <div className="divide-y divide-slate-700/50 max-h-[600px] overflow-y-auto">
                                {clientClauses.map((clause) => (
                                    <div key={clause.id} className={`p-5 space-y-3 ${clause.status === "rejected" ? "bg-red-950/20" : clause.status === "modified" ? "bg-amber-950/20" : ""}`}>
                                        <div className="flex items-start gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-bold text-slate-400">{clause.clauseRef}</span>
                                                    <span className="text-sm font-semibold text-slate-200">{clause.title}</span>
                                                    {clause.flagged && (
                                                        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-400 border border-purple-700/40 flex items-center gap-1">
                                                            <ShieldCheck className="w-3 h-3" /> Flagged
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{clause.original}</p>
                                            </div>
                                            {/* Status toggles */}
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                {(["accepted", "modified", "rejected"] as const).map(s => (
                                                    <button
                                                        key={s}
                                                        onClick={() => updateClientClause(clause.id, "status", s)}
                                                        className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                                                            clause.status === s
                                                                ? s === "accepted" ? "bg-green-600 text-white"
                                                                    : s === "modified" ? "bg-amber-600 text-white"
                                                                    : "bg-red-600 text-white"
                                                                : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                                                        }`}
                                                    >
                                                        {s === "accepted" ? "Accept" : s === "modified" ? "Modify" : "Reject"}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        {clause.status === "modified" && (
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-amber-400">Contractor&apos;s Proposed Wording</label>
                                                <textarea
                                                    className="w-full rounded-lg border border-amber-700/50 bg-amber-950/20 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                                                    rows={3}
                                                    value={clause.proposed}
                                                    onChange={e => updateClientClause(clause.id, "proposed", e.target.value)}
                                                    placeholder="Enter your proposed wording for this clause…"
                                                />
                                            </div>
                                        )}
                                        {clause.status === "rejected" && (
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-red-400">Reason for Rejection</label>
                                                <input
                                                    className="w-full rounded-lg border border-red-700/50 bg-red-950/20 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                                                    value={clause.reason}
                                                    onChange={e => updateClientClause(clause.id, "reason", e.target.value)}
                                                    placeholder="State why this clause is not acceptable…"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Upload Client Contract */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Upload Client Contract for Review</h3>
                                <p className="text-xs text-slate-500 mt-1">Upload a contract (TXT, PDF, or DOCX) to have Contract Shield AI flag onerous clauses and unusual terms.</p>
                            </div>
                            <button
                                onClick={() => {
                                    const next = !showPasteMode;
                                    setShowPasteMode(next);
                                    // Clear any failed [FILE:...] placeholder when switching to paste mode
                                    if (next && uploadedText.startsWith("[FILE:")) {
                                        setUploadedText("");
                                        setUploadedFileName("");
                                    }
                                }}
                                className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2 flex-shrink-0 ml-4 transition-colors"
                            >
                                {showPasteMode ? "← Upload file instead" : "Paste text instead"}
                            </button>
                        </div>

                        {showPasteMode ? (
                            /* ── Paste mode ── */
                            <div className="space-y-3">
                                <textarea
                                    className={inputCls}
                                    rows={8}
                                    value={uploadedText.startsWith("[FILE:") ? "" : uploadedText}
                                    onChange={e => {
                                        setUploadedText(e.target.value);
                                        setUploadedFileName("Pasted text");
                                    }}
                                    placeholder="Paste your contract text here…"
                                />
                                {uploadedText && !uploadedText.startsWith("[FILE:") && (
                                    <p className="text-xs text-green-400">{uploadedText.length.toLocaleString()} chars ready ✓</p>
                                )}
                            </div>
                        ) : (
                            /* ── File upload mode ── */
                            <div className="flex items-center gap-3 flex-wrap">
                                <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-slate-200 rounded-lg cursor-pointer hover:bg-slate-600 text-sm font-medium transition-colors">
                                    <Upload className="w-4 h-4" />
                                    {extracting ? "Extracting…" : "Upload Contract"}
                                    <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleFileUpload} disabled={extracting} />
                                </label>
                                {extracting && (
                                    <span className="flex items-center gap-1.5 text-xs text-purple-400 font-medium">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Extracting text from {uploadedFileName}…
                                    </span>
                                )}
                                {!extracting && uploadedText && !uploadedText.startsWith("[FILE:") && (
                                    <span className="text-xs text-green-400 font-medium">
                                        {uploadedFileName || "Contract"} — {uploadedText.length.toLocaleString()} chars extracted ✓
                                    </span>
                                )}
                                {!extracting && uploadedText && uploadedText.startsWith("[FILE:") && (
                                    <span className="text-xs text-amber-400 font-medium">
                                        Storage bucket not set up — use &ldquo;Paste text instead&rdquo; above
                                    </span>
                                )}
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleAnalyse}
                                disabled={!uploadedText || analysing || extracting || uploadedText.startsWith("[FILE:")}
                                className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors"
                            >
                                {analysing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                {analysing ? "Analysing…" : "Analyse with AI"}
                            </button>
                            {!uploadedText && (
                                <span className="text-xs text-slate-500">Upload or paste a contract first</span>
                            )}
                        </div>

                        {/* Flags display */}
                        {contractFlags.length > 0 && (
                            <div className="space-y-3 mt-4">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-300">
                                            Review Flags ({contractFlags.filter((f: any) => !f.dismissed).length} active, {contractFlags.filter((f: any) => f.dismissed).length} resolved)
                                        </h4>
                                        <p className="text-xs text-slate-500 mt-0.5">Results saved to this project — flags, risks and exclusions persist when you return.</p>
                                    </div>
                                    {contractFlags.filter((f: any) => !f.dismissed && (f.severity === "high" || f.severity === "medium")).length > 0 && (
                                        <button
                                            onClick={handleImportFlagsToRisks}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-300 border border-purple-600/50 bg-purple-950/40 rounded-lg hover:bg-purple-900/40 transition-colors"
                                        >
                                            <Shield className="w-3.5 h-3.5" />
                                            Import {contractFlags.filter((f: any) => !f.dismissed && (f.severity === "high" || f.severity === "medium")).length} risks → Risk Register
                                        </button>
                                    )}
                                </div>
                                {contractFlags.map((flag: any, i: number) => (
                                    <div key={i} className={`border rounded-lg p-4 ${flag.dismissed ? "opacity-40 bg-slate-900/40 border-slate-700" : severityColor(flag.severity)}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold uppercase">{flag.severity}</span>
                                            <span className="text-xs font-medium">— {flag.type}</span>
                                            {flag.dismissed && (
                                                <span className="text-xs font-bold uppercase ml-auto px-2 py-0.5 bg-slate-700 text-slate-300 rounded">
                                                    {flag.dismiss_status === "accepted" ? "Accepted" : "Disputed"}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm font-semibold">{flag.clause}</p>
                                        <p className="text-sm mt-1 opacity-90">{flag.description}</p>
                                        {flag.recommendation && (
                                            <p className="text-xs mt-2 font-medium opacity-75">Recommendation: {flag.recommendation}</p>
                                        )}
                                        {!flag.dismissed && (
                                            <div className="flex items-center gap-3 mt-3 pt-2 border-t border-current/20">
                                                <button
                                                    onClick={async () => {
                                                        const updated = await dismissContractFlagAction(projectId, i, "accepted");
                                                        if (updated) setContractFlags(updated);
                                                    }}
                                                    className="text-xs text-slate-400 hover:text-green-400 font-medium transition-colors"
                                                >
                                                    Accept risk
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        const updated = await dismissContractFlagAction(projectId, i, "disputed");
                                                        if (updated) setContractFlags(updated);
                                                    }}
                                                    className="text-xs text-slate-400 hover:text-red-400 font-medium transition-colors"
                                                >
                                                    Dispute
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Build contractor response */}
                        {uploadedText && !uploadedText.startsWith("[FILE:") && (
                            <div className="pt-2 border-t border-slate-700/50">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-200">Contractor Response</p>
                                        <p className="text-xs text-slate-500">Parse the client&apos;s contract into clauses and build a formal amendment response.</p>
                                    </div>
                                    <button
                                        onClick={handleParseClientContract}
                                        disabled={parsingClauses}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-600 disabled:opacity-50 transition-colors flex-shrink-0"
                                    >
                                        {parsingClauses ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileEdit className="w-4 h-4" />}
                                        {parsingClauses ? "Parsing…" : clientClauses.length > 0 ? "Re-parse Contract" : "Build Contractor Response"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ TAB B: Risk & Opportunities ═══ */}
            {activeTab === "risks" && (
                <div className="space-y-6">
                    {/* Contract Shield import prompt */}
                    {contractFlags.filter((f: any) => !f.dismissed && (f.severity === "high" || f.severity === "medium")).length > 0 && (
                        <div className="flex items-center justify-between bg-purple-950/30 border border-purple-700/50 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-purple-400 flex-shrink-0" />
                                <p className="text-sm text-purple-300">
                                    <span className="font-semibold">Contract Shield</span> found {contractFlags.filter((f: any) => !f.dismissed && (f.severity === "high" || f.severity === "medium")).length} high/medium risks — import them with mitigations pre-filled.
                                </p>
                            </div>
                            <button
                                onClick={handleImportFlagsToRisks}
                                className="flex-shrink-0 ml-4 text-xs font-semibold text-purple-300 border border-purple-600/50 bg-purple-900/40 px-3 py-1.5 rounded-lg hover:bg-purple-800/40 transition-colors"
                            >
                                Import now
                            </button>
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-100">Risk & Opportunity Register</h3>
                            <p className="text-xs text-slate-400">Track project risks and opportunities to inform your pricing and programme.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleGenerateRisks}
                                disabled={generatingRisks}
                                className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors"
                            >
                                {generatingRisks ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                AI Generate
                            </button>
                            <button
                                onClick={handleSaveRisks}
                                disabled={isPending}
                                className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-lg text-sm font-semibold hover:bg-slate-600 disabled:opacity-50 transition-colors"
                            >
                                Save Register
                            </button>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-6">
                        {/* Risks column */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-red-400 uppercase tracking-wide">Risks</h4>
                                <button onClick={() => addRiskItem("risk")} className="text-xs flex items-center gap-1 text-red-400 hover:text-red-300 font-medium transition-colors">
                                    <Plus className="w-3 h-3" /> Add Risk
                                </button>
                            </div>
                            {riskRegister.filter(r => r.type === "risk").map(item => (
                                <div key={item.id} className="bg-slate-800/50 border border-red-900/50 rounded-lg p-4 space-y-2">
                                    <textarea
                                        className={inputCls}
                                        rows={2}
                                        value={item.description}
                                        onChange={e => updateRiskItem(item.id, "description", e.target.value)}
                                        placeholder="Describe the risk..."
                                    />
                                    <div className="flex items-center gap-2">
                                        <select className="text-xs border border-slate-700 rounded px-2 py-1 bg-slate-800 text-slate-200" value={item.likelihood} onChange={e => updateRiskItem(item.id, "likelihood", e.target.value)}>
                                            <option value="low">Low likelihood</option>
                                            <option value="medium">Medium likelihood</option>
                                            <option value="high">High likelihood</option>
                                        </select>
                                        <select className="text-xs border border-slate-700 rounded px-2 py-1 bg-slate-800 text-slate-200" value={item.impact} onChange={e => updateRiskItem(item.id, "impact", e.target.value)}>
                                            <option value="low">Low impact</option>
                                            <option value="medium">Medium impact</option>
                                            <option value="high">High impact</option>
                                        </select>
                                        <button onClick={() => deleteRiskItem(item.id)} className="ml-auto text-slate-500 hover:text-red-400 transition-colors">
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
                                <div className="text-center py-8 text-slate-500 text-sm border-2 border-dashed border-slate-700 rounded-lg">
                                    No risks added yet
                                </div>
                            )}
                        </div>

                        {/* Opportunities column */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-green-400 uppercase tracking-wide">Opportunities</h4>
                                <button onClick={() => addRiskItem("opportunity")} className="text-xs flex items-center gap-1 text-green-400 hover:text-green-300 font-medium transition-colors">
                                    <Plus className="w-3 h-3" /> Add Opportunity
                                </button>
                            </div>
                            {riskRegister.filter(r => r.type === "opportunity").map(item => (
                                <div key={item.id} className="bg-slate-800/50 border border-green-900/50 rounded-lg p-4 space-y-2">
                                    <textarea
                                        className={inputCls}
                                        rows={2}
                                        value={item.description}
                                        onChange={e => updateRiskItem(item.id, "description", e.target.value)}
                                        placeholder="Describe the opportunity..."
                                    />
                                    <div className="flex items-center gap-2">
                                        <select className="text-xs border border-slate-700 rounded px-2 py-1 bg-slate-800 text-slate-200" value={item.likelihood} onChange={e => updateRiskItem(item.id, "likelihood", e.target.value)}>
                                            <option value="low">Low likelihood</option>
                                            <option value="medium">Medium likelihood</option>
                                            <option value="high">High likelihood</option>
                                        </select>
                                        <select className="text-xs border border-slate-700 rounded px-2 py-1 bg-slate-800 text-slate-200" value={item.impact} onChange={e => updateRiskItem(item.id, "impact", e.target.value)}>
                                            <option value="low">Low impact</option>
                                            <option value="medium">Medium impact</option>
                                            <option value="high">High impact</option>
                                        </select>
                                        <button onClick={() => deleteRiskItem(item.id)} className="ml-auto text-slate-500 hover:text-red-400 transition-colors">
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
                                <div className="text-center py-8 text-slate-500 text-sm border-2 border-dashed border-slate-700 rounded-lg">
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
                    <div className="bg-blue-950/40 border border-blue-800/50 rounded-lg px-4 py-3 text-sm text-blue-300">
                        These will be included automatically in your Proposal PDF.
                    </div>
                    {contractFlags.filter((f: any) => !f.dismissed).length > 0 && (
                        <div className="flex items-center gap-2 bg-purple-950/30 border border-purple-700/50 rounded-xl px-4 py-3">
                            <ShieldCheck className="w-4 h-4 text-purple-400 flex-shrink-0" />
                            <p className="text-sm text-purple-300">
                                <span className="font-semibold">Contract Shield</span> review found {contractFlags.filter((f: any) => !f.dismissed).length} flags — click <span className="font-semibold">AI Suggest</span> and they will be used to generate targeted exclusions and clarifications.
                            </p>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-100">Exclusions & Clarifications</h3>
                            <p className="text-xs text-slate-400">Define what is excluded from your scope and any assumptions made.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleGenerateExclusions}
                                disabled={generatingExcl}
                                className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors"
                            >
                                {generatingExcl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                AI Suggest
                            </button>
                            <button
                                onClick={handleSaveExclusions}
                                disabled={isPending}
                                className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-lg text-sm font-semibold hover:bg-slate-600 disabled:opacity-50 transition-colors"
                            >
                                Save
                            </button>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-300">Exclusions</label>
                            <textarea
                                className={inputCls}
                                rows={12}
                                value={contractExclusions}
                                onChange={e => setContractExclusions(e.target.value)}
                                placeholder="One exclusion per line, e.g.&#10;Asbestos removal&#10;Party wall surveys&#10;Building control fees..."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-300">Clarifications</label>
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
                <div className="border border-slate-700 rounded-xl bg-slate-900 overflow-hidden flex flex-col" style={{ height: "calc(100vh - 20rem)" }}>
                    <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-purple-400" />
                            <h3 className="text-sm font-bold text-slate-100">Contract Shield AI</h3>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">Ask questions about contract terms, risks, and standard UK construction practice.</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {chatMessages.length === 0 && (
                            <div className="text-center py-10 text-slate-500">
                                <ShieldCheck className="w-8 h-8 mx-auto mb-3 text-slate-600" />
                                <p className="text-sm">Ask me about contract terms, payment conditions, risk allocation, or standard UK practice.</p>
                                <p className="text-xs mt-2 text-slate-600">e.g. &ldquo;What retention percentage is standard for domestic works?&rdquo;</p>
                            </div>
                        )}
                        {chatMessages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                                    msg.role === "user"
                                        ? "bg-purple-600 text-white"
                                        : "bg-slate-800 text-slate-200 border border-slate-700"
                                }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {chatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-slate-700 p-3 flex gap-2 bg-slate-800/50">
                        <input
                            className="flex-1 h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleChat()}
                            placeholder="Ask about contract terms..."
                        />
                        <button
                            onClick={handleChat}
                            disabled={chatLoading || !chatInput.trim()}
                            className="h-10 px-4 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
