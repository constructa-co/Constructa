"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import {
    Plus, Trash2, Loader2, MessageSquare, HelpCircle,
    AlertTriangle, FolderOpen, Download, CheckCircle2, Clock,
} from "lucide-react";
import {
    createSiteInstructionAction, updateSIStatusAction, deleteSiteInstructionAction,
    createRfiAction, respondToRfiAction, updateRfiStatusAction, deleteRfiAction,
    createEwnAction, updateEwnStatusAction, deleteEwnAction,
    createDocumentAction, deleteDocumentAction,
} from "./actions";

const gbp = (n: number) => `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string | null | undefined) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
const today = () => new Date().toISOString().split("T")[0];
const isPast = (d: string) => new Date(d + "T00:00:00") < new Date();

const SI_TYPES  = ["Site Instruction", "Architect's Instruction", "Instruction to Proceed", "Instruction to Stop", "Instruction to Omit", "Verbal Instruction (Confirmed)"];
const EWN_TYPES = ["Early Warning Notice", "Compensation Event Notice", "Notification of Delay", "Risk Notification"];
const DOC_TYPES = ["Drawing", "Specification", "Certificate", "Letter", "Report", "Programme", "Valuation", "Variation Order", "Contract Document", "Other"];

const TABS = [
    { key: "si",   label: "Site Instructions",      icon: MessageSquare },
    { key: "rfi",  label: "RFIs",                   icon: HelpCircle },
    { key: "ewn",  label: "Early Warning Notices",  icon: AlertTriangle },
    { key: "docs", label: "Document Register",       icon: FolderOpen },
] as const;
type Tab = typeof TABS[number]["key"];

function Badge({ label, colour }: { label: string; colour: string }) {
    return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${colour}`}>{label}</span>;
}

const SI_STATUS_COLOURS: Record<string, string> = {
    Issued:       "border-blue-500/40 bg-blue-500/10 text-blue-400",
    Acknowledged: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    Implemented:  "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
};
const RFI_STATUS_COLOURS: Record<string, string> = {
    Open:       "border-amber-500/40 bg-amber-500/10 text-amber-400",
    Responded:  "border-blue-500/40 bg-blue-500/10 text-blue-400",
    Closed:     "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
};
const EWN_STATUS_COLOURS: Record<string, string> = {
    Issued:       "border-red-500/40 bg-red-500/10 text-red-400",
    Acknowledged: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    "Under Review": "border-purple-500/40 bg-purple-500/10 text-purple-400",
    Closed:       "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
};

// ── PDF generators ────────────────────────────────────────────────────────────
function generateSIPdf(si: any, project: any) {
    const doc = new jsPDF() as any;
    const m = 20;
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 38, "F");
    doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    doc.text("SITE INSTRUCTION", m, 16);
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(148, 163, 184);
    doc.text(si.si_number, m, 24);
    doc.text(`Issued: ${fmtDate(si.date_issued)}`, m, 30);
    let y = 50;
    doc.setTextColor(0); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(71, 85, 105);
    doc.text("PROJECT", m, y); doc.text("TYPE", 110, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setTextColor(15, 23, 42); doc.setFontSize(10);
    doc.text(project?.name ?? "—", m, y); doc.text(si.type, 110, y); y += 10;
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(71, 85, 105);
    doc.text("RECIPIENT", m, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setTextColor(15, 23, 42); doc.setFontSize(10);
    doc.text(si.recipient || "—", m, y); y += 12;
    doc.setDrawColor(226, 232, 240); doc.line(m, y, 190, y); y += 8;
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(71, 85, 105);
    doc.text("INSTRUCTION", m, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setTextColor(15, 23, 42); doc.setFontSize(10);
    const lines = doc.splitTextToSize(si.description || "", 170);
    doc.text(lines, m, y); y += lines.length * 6 + 16;
    doc.line(m, 250, m + 60, 250); doc.line(110, 250, 170, 250);
    doc.setFontSize(8); doc.setTextColor(100, 116, 139);
    doc.text("Contractor Signature / Date", m, 256); doc.text("Recipient Acknowledgement / Date", 110, 256);
    doc.setFontSize(7); doc.text(`Generated by Constructa · ${new Date().toLocaleDateString("en-GB")}`, 110, 288, { align: "right" });
    doc.save(`${si.si_number}_${project?.name ?? "Project"}.pdf`);
}

function generateEwnPdf(ewn: any, project: any) {
    const doc = new jsPDF() as any;
    const m = 20;
    doc.setFillColor(127, 29, 29);
    doc.rect(0, 0, 210, 38, "F");
    doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    doc.text(ewn.type?.toUpperCase() ?? "EARLY WARNING NOTICE", m, 16);
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(252, 165, 165);
    doc.text(ewn.ewn_number, m, 24); doc.text(`Issued: ${fmtDate(ewn.date_issued)}`, m, 30);
    let y = 50;
    doc.setTextColor(0); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(71, 85, 105);
    doc.text("PROJECT", m, y); doc.text("CLIENT", 110, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setTextColor(15, 23, 42); doc.setFontSize(10);
    doc.text(project?.name ?? "—", m, y); doc.text(project?.client_name ?? "—", 110, y); y += 12;
    doc.setDrawColor(226, 232, 240); doc.line(m, y, 190, y); y += 8;
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(71, 85, 105);
    doc.text("NOTICE DESCRIPTION", m, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setTextColor(15, 23, 42); doc.setFontSize(10);
    const lines = doc.splitTextToSize(ewn.description || "", 170);
    doc.text(lines, m, y); y += lines.length * 6 + 10;
    doc.setDrawColor(226, 232, 240); doc.line(m, y, 190, y); y += 8;
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(71, 85, 105);
    doc.text("POTENTIAL IMPACT", m, y); y += 6;
    doc.autoTable({
        startY: y, margin: { left: m, right: m },
        head: [["Impact Type", "Estimated Effect"]],
        body: [
            ["Cost Impact", ewn.potential_cost_impact > 0 ? gbp(ewn.potential_cost_impact) : "TBC"],
            ["Time Impact", ewn.potential_time_impact_days > 0 ? `${ewn.potential_time_impact_days} days` : "TBC"],
        ],
        theme: "striped",
        headStyles: { fillColor: [127, 29, 29], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 9 },
    });
    y = doc.lastAutoTable.finalY + 20;
    doc.line(m, y, m + 60, y); doc.line(110, y, 170, y);
    doc.setFontSize(8); doc.setTextColor(100, 116, 139);
    doc.text("Issued By / Date", m, y + 6); doc.text("Received By / Date", 110, y + 6);
    doc.setFontSize(7); doc.text(`Generated by Constructa · ${new Date().toLocaleDateString("en-GB")}`, 110, 288, { align: "right" });
    doc.save(`${ewn.ewn_number}_${project?.name ?? "Project"}.pdf`);
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CommunicationsClient({ projectId, project, initialSiteInstructions, initialRfis, initialEwns, initialDocuments }: {
    projectId: string;
    project: any;
    initialSiteInstructions: any[];
    initialRfis: any[];
    initialEwns: any[];
    initialDocuments: any[];
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [activeTab, setActiveTab] = useState<Tab>("si");

    // SI form
    const [showSI, setShowSI] = useState(false);
    const [siType, setSiType]         = useState("Site Instruction");
    const [siRecipient, setSiRecipient] = useState("");
    const [siDate, setSiDate]         = useState(today());
    const [siDesc, setSiDesc]         = useState("");

    // RFI form
    const [showRFI, setShowRFI] = useState(false);
    const [rfiQuestion, setRfiQuestion] = useState("");
    const [rfiAddressee, setRfiAddressee] = useState("");
    const [rfiSent, setRfiSent]       = useState(today());
    const [rfiDue, setRfiDue]         = useState("");

    // RFI respond
    const [respondRfi, setRespondRfi] = useState<any>(null);
    const [rfiResponse, setRfiResponse] = useState("");
    const [rfiRespondDate, setRfiRespondDate] = useState(today());

    // EWN form
    const [showEWN, setShowEWN] = useState(false);
    const [ewnType, setEwnType]   = useState("Early Warning Notice");
    const [ewnDesc, setEwnDesc]   = useState("");
    const [ewnDate, setEwnDate]   = useState(today());
    const [ewnCost, setEwnCost]   = useState("");
    const [ewnTime, setEwnTime]   = useState("");

    // Doc form
    const [showDoc, setShowDoc] = useState(false);
    const [docType, setDocType]     = useState("Drawing");
    const [docTitle, setDocTitle]   = useState("");
    const [docRev, setDocRev]       = useState("");
    const [docDir, setDocDir]       = useState("received");
    const [docDate, setDocDate]     = useState(today());
    const [docRef, setDocRef]       = useState("");
    const [docNotes, setDocNotes]   = useState("");

    const act = (fn: () => Promise<void>) => {
        startTransition(async () => { try { await fn(); router.refresh(); } catch (e: any) { toast.error(e.message); } });
    };

    const handleCreateSI = (e: React.FormEvent) => {
        e.preventDefault();
        act(async () => {
            await createSiteInstructionAction({ project_id: projectId, type: siType, recipient: siRecipient, date_issued: siDate, description: siDesc });
            toast.success("Site instruction issued");
            setShowSI(false); setSiType("Site Instruction"); setSiRecipient(""); setSiDate(today()); setSiDesc("");
        });
    };

    const handleCreateRFI = (e: React.FormEvent) => {
        e.preventDefault();
        act(async () => {
            await createRfiAction({ project_id: projectId, question: rfiQuestion, addressee: rfiAddressee, date_sent: rfiSent, date_response_due: rfiDue });
            toast.success("RFI raised");
            setShowRFI(false); setRfiQuestion(""); setRfiAddressee(""); setRfiSent(today()); setRfiDue("");
        });
    };

    const handleRespondRFI = (e: React.FormEvent) => {
        e.preventDefault();
        if (!respondRfi) return;
        act(async () => {
            await respondToRfiAction(respondRfi.id, projectId, { response_summary: rfiResponse, date_responded: rfiRespondDate });
            toast.success("RFI response logged");
            setRespondRfi(null); setRfiResponse(""); setRfiRespondDate(today());
        });
    };

    const handleCreateEWN = (e: React.FormEvent) => {
        e.preventDefault();
        act(async () => {
            await createEwnAction({ project_id: projectId, type: ewnType, description: ewnDesc, date_issued: ewnDate, potential_cost_impact: parseFloat(ewnCost) || 0, potential_time_impact_days: parseInt(ewnTime) || 0 });
            toast.success("Early Warning Notice issued");
            setShowEWN(false); setEwnType("Early Warning Notice"); setEwnDesc(""); setEwnDate(today()); setEwnCost(""); setEwnTime("");
        });
    };

    const handleCreateDoc = (e: React.FormEvent) => {
        e.preventDefault();
        act(async () => {
            await createDocumentAction({ project_id: projectId, doc_type: docType, title: docTitle, revision: docRev || undefined, direction: docDir, date_issued: docDate, file_ref: docRef || undefined, notes: docNotes || undefined });
            toast.success("Document registered");
            setShowDoc(false); setDocType("Drawing"); setDocTitle(""); setDocRev(""); setDocDir("received"); setDocDate(today()); setDocRef(""); setDocNotes("");
        });
    };

    // KPIs
    const openRfis = initialRfis.filter(r => r.status === "Open");
    const overdueRfis = openRfis.filter(r => r.date_response_due && isPast(r.date_response_due));
    const openEwns = initialEwns.filter(e => e.status !== "Closed");
    const totalEwnCostImpact = openEwns.reduce((s, e) => s + Number(e.potential_cost_impact || 0), 0);

    return (
        <div className="space-y-5">
            {/* KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Site Instructions</p>
                    <p className="text-2xl font-bold text-slate-100">{initialSiteInstructions.length}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{initialSiteInstructions.filter(s => s.status === "Issued").length} issued</p>
                </div>
                <div className={`rounded-xl p-4 border ${overdueRfis.length > 0 ? "bg-red-500/5 border-red-500/20" : "bg-slate-800/50 border-slate-700/50"}`}>
                    <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${overdueRfis.length > 0 ? "text-red-500/70" : "text-slate-500"}`}>Open RFIs</p>
                    <p className={`text-2xl font-bold ${overdueRfis.length > 0 ? "text-red-400" : "text-amber-400"}`}>{openRfis.length}</p>
                    {overdueRfis.length > 0 && <p className="text-xs text-red-400/70 mt-0.5">{overdueRfis.length} overdue</p>}
                </div>
                <div className={`rounded-xl p-4 border ${openEwns.length > 0 ? "bg-amber-500/5 border-amber-500/20" : "bg-slate-800/50 border-slate-700/50"}`}>
                    <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${openEwns.length > 0 ? "text-amber-500/70" : "text-slate-500"}`}>Open EWNs</p>
                    <p className={`text-2xl font-bold ${openEwns.length > 0 ? "text-amber-400" : "text-slate-400"}`}>{openEwns.length}</p>
                    {totalEwnCostImpact > 0 && <p className="text-xs text-amber-400/70 mt-0.5">{gbp(totalEwnCostImpact)} at risk</p>}
                </div>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Documents</p>
                    <p className="text-2xl font-bold text-slate-100">{initialDocuments.length}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{initialDocuments.filter(d => d.direction === "received").length} received</p>
                </div>
            </div>

            {/* Tab container */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                <div className="flex border-b border-slate-700/50">
                    {TABS.map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => setActiveTab(key)}
                            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors border-b-2 ${activeTab === key ? "border-cyan-500 text-cyan-400 bg-cyan-500/5" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
                            <Icon className="w-4 h-4" />
                            {label}
                        </button>
                    ))}
                </div>

                {/* ── SITE INSTRUCTIONS ── */}
                {activeTab === "si" && (
                    <div>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
                            <div>
                                <h2 className="text-sm font-semibold text-white">Site Instructions</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Formal written instructions issued during construction</p>
                            </div>
                            <button onClick={() => setShowSI(true)} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-semibold hover:bg-cyan-500 transition-colors">
                                <Plus className="w-4 h-4" /> Issue Instruction
                            </button>
                        </div>
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-slate-700/50">
                                {["Ref", "Type", "Recipient", "Date Issued", "Description", "Status", ""].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                                ))}
                            </tr></thead>
                            <tbody>
                                {initialSiteInstructions.map((si, i) => (
                                    <tr key={si.id} className={`group border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${i === initialSiteInstructions.length - 1 ? "border-0" : ""}`}>
                                        <td className="px-4 py-3 text-xs font-mono font-semibold text-cyan-400">{si.si_number}</td>
                                        <td className="px-4 py-3 text-xs text-slate-300">{si.type}</td>
                                        <td className="px-4 py-3 text-xs text-slate-400">{si.recipient || "—"}</td>
                                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDate(si.date_issued)}</td>
                                        <td className="px-4 py-3 text-xs text-slate-300 max-w-xs line-clamp-2">{si.description}</td>
                                        <td className="px-4 py-3">
                                            <Select defaultValue={si.status} onValueChange={v => act(async () => { await updateSIStatusAction(si.id, v, projectId); toast.success(`Marked ${v}`); })}>
                                                <SelectTrigger className={`h-7 w-32 text-xs border rounded-lg ${SI_STATUS_COLOURS[si.status] ?? ""}`}><SelectValue /></SelectTrigger>
                                                <SelectContent className="bg-slate-800 border-slate-700">
                                                    {["Issued", "Acknowledged", "Implemented"].map(s => <SelectItem key={s} value={s} className="text-xs text-slate-200">{s}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => generateSIPdf(si, project)} className="h-7 px-2 flex items-center gap-1 rounded-md text-blue-400 hover:bg-blue-500/10 text-[11px] font-semibold transition-colors">
                                                    <Download className="w-3.5 h-3.5" />PDF
                                                </button>
                                                <button onClick={() => { if (confirm("Delete?")) act(async () => { await deleteSiteInstructionAction(si.id, projectId); toast.success("Deleted"); }); }}
                                                    className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {initialSiteInstructions.length === 0 && <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-slate-500">No site instructions yet</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── RFIs ── */}
                {activeTab === "rfi" && (
                    <div>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
                            <div>
                                <h2 className="text-sm font-semibold text-white">Request for Information</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Track queries raised to the client, architect or engineer</p>
                            </div>
                            <button onClick={() => setShowRFI(true)} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-semibold hover:bg-cyan-500 transition-colors">
                                <Plus className="w-4 h-4" /> Raise RFI
                            </button>
                        </div>
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-slate-700/50">
                                {["Ref", "Question", "Addressee", "Sent", "Due", "Status", ""].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                                ))}
                            </tr></thead>
                            <tbody>
                                {initialRfis.map((rfi, i) => {
                                    const overdue = rfi.status === "Open" && rfi.date_response_due && isPast(rfi.date_response_due);
                                    return (
                                        <tr key={rfi.id} className={`group border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${i === initialRfis.length - 1 ? "border-0" : ""}`}>
                                            <td className="px-4 py-3 text-xs font-mono font-semibold text-cyan-400">{rfi.rfi_number}</td>
                                            <td className="px-4 py-3 max-w-xs">
                                                <p className="text-xs text-slate-300 line-clamp-2">{rfi.question}</p>
                                                {rfi.response_summary && <p className="text-[10px] text-emerald-400 mt-0.5 line-clamp-1">↳ {rfi.response_summary}</p>}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-400">{rfi.addressee || "—"}</td>
                                            <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDate(rfi.date_sent)}</td>
                                            <td className="px-4 py-3 text-xs whitespace-nowrap">
                                                {rfi.date_response_due ? (
                                                    <span className={overdue ? "text-red-400 font-semibold" : "text-slate-400"}>
                                                        {overdue && "⚠ "}{fmtDate(rfi.date_response_due)}
                                                    </span>
                                                ) : "—"}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge label={rfi.status} colour={RFI_STATUS_COLOURS[rfi.status] ?? ""} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {rfi.status === "Open" && (
                                                        <button onClick={() => { setRespondRfi(rfi); setRfiRespondDate(today()); }}
                                                            className="h-7 px-2 flex items-center gap-1 rounded-md text-emerald-400 hover:bg-emerald-500/10 text-[11px] font-semibold transition-colors">
                                                            <CheckCircle2 className="w-3.5 h-3.5" />Respond
                                                        </button>
                                                    )}
                                                    {rfi.status === "Responded" && (
                                                        <button onClick={() => act(async () => { await updateRfiStatusAction(rfi.id, "Closed", projectId); toast.success("RFI closed"); })}
                                                            className="h-7 px-2 flex items-center gap-1 rounded-md text-slate-400 hover:bg-slate-700/50 text-[11px] font-semibold transition-colors">
                                                            Close
                                                        </button>
                                                    )}
                                                    <button onClick={() => { if (confirm("Delete?")) act(async () => { await deleteRfiAction(rfi.id, projectId); toast.success("Deleted"); }); }}
                                                        className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {initialRfis.length === 0 && <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-slate-500">No RFIs raised yet</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── EARLY WARNING NOTICES ── */}
                {activeTab === "ewn" && (
                    <div>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
                            <div>
                                <h2 className="text-sm font-semibold text-white">Early Warning Notices</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Formal notifications of risk events that may affect cost or time</p>
                            </div>
                            <button onClick={() => setShowEWN(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-500 transition-colors">
                                <Plus className="w-4 h-4" /> Issue EWN
                            </button>
                        </div>
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-slate-700/50">
                                {["Ref", "Type", "Description", "Date", "Cost Impact", "Time Impact", "Status", ""].map(h => (
                                    <th key={h} className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${h === "Cost Impact" || h === "Time Impact" ? "text-right" : "text-left"}`}>{h}</th>
                                ))}
                            </tr></thead>
                            <tbody>
                                {initialEwns.map((ewn, i) => (
                                    <tr key={ewn.id} className={`group border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${i === initialEwns.length - 1 ? "border-0" : ""}`}>
                                        <td className="px-4 py-3 text-xs font-mono font-semibold text-amber-400">{ewn.ewn_number}</td>
                                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{ewn.type}</td>
                                        <td className="px-4 py-3 text-xs text-slate-300 max-w-xs line-clamp-2">{ewn.description}</td>
                                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDate(ewn.date_issued)}</td>
                                        <td className="px-4 py-3 text-right text-xs font-mono text-amber-400">{ewn.potential_cost_impact > 0 ? gbp(ewn.potential_cost_impact) : "—"}</td>
                                        <td className="px-4 py-3 text-right text-xs text-slate-400">{ewn.potential_time_impact_days > 0 ? `+${ewn.potential_time_impact_days}d` : "—"}</td>
                                        <td className="px-4 py-3">
                                            <Select defaultValue={ewn.status} onValueChange={v => act(async () => { await updateEwnStatusAction(ewn.id, v, projectId); toast.success(`Status updated`); })}>
                                                <SelectTrigger className={`h-7 w-32 text-xs border rounded-lg ${EWN_STATUS_COLOURS[ewn.status] ?? ""}`}><SelectValue /></SelectTrigger>
                                                <SelectContent className="bg-slate-800 border-slate-700">
                                                    {["Issued", "Acknowledged", "Under Review", "Closed"].map(s => <SelectItem key={s} value={s} className="text-xs text-slate-200">{s}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => generateEwnPdf(ewn, project)} className="h-7 px-2 flex items-center gap-1 rounded-md text-blue-400 hover:bg-blue-500/10 text-[11px] font-semibold transition-colors">
                                                    <Download className="w-3.5 h-3.5" />PDF
                                                </button>
                                                <button onClick={() => { if (confirm("Delete?")) act(async () => { await deleteEwnAction(ewn.id, projectId); toast.success("Deleted"); }); }}
                                                    className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {initialEwns.length === 0 && <tr><td colSpan={8} className="px-5 py-14 text-center text-sm text-slate-500">No early warning notices issued</td></tr>}
                            </tbody>
                        </table>
                        {openEwns.length > 0 && (
                            <div className="border-t border-slate-700/50 px-5 py-3 bg-slate-900/30 flex justify-end">
                                <p className="text-sm text-amber-400 font-semibold">
                                    Open EWN exposure: {gbp(totalEwnCostImpact)} · {openEwns.reduce((s, e) => s + (e.potential_time_impact_days || 0), 0)} days
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── DOCUMENT REGISTER ── */}
                {activeTab === "docs" && (
                    <div>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
                            <div>
                                <h2 className="text-sm font-semibold text-white">Document Register</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Timestamped record of all documents issued and received</p>
                            </div>
                            <button onClick={() => setShowDoc(true)} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-semibold hover:bg-cyan-500 transition-colors">
                                <Plus className="w-4 h-4" /> Register Document
                            </button>
                        </div>
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-slate-700/50">
                                {["Ref", "Type", "Title", "Rev", "Direction", "Date", "File Ref", ""].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                                ))}
                            </tr></thead>
                            <tbody>
                                {initialDocuments.map((doc, i) => (
                                    <tr key={doc.id} className={`group border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${i === initialDocuments.length - 1 ? "border-0" : ""}`}>
                                        <td className="px-4 py-3 text-xs font-mono text-slate-400">{doc.doc_number}</td>
                                        <td className="px-4 py-3">
                                            <span className="text-[11px] bg-slate-700/50 border border-slate-600/50 text-slate-300 rounded px-1.5 py-0.5">{doc.doc_type}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-100 font-semibold max-w-[180px]">
                                            <p className="truncate">{doc.title}</p>
                                            {doc.notes && <p className="text-slate-500 text-[10px] mt-0.5 truncate">{doc.notes}</p>}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-400">{doc.revision || "—"}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${doc.direction === "sent" ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"}`}>
                                                {doc.direction === "sent" ? "↑ Sent" : "↓ Received"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDate(doc.date_issued)}</td>
                                        <td className="px-4 py-3 text-xs text-slate-500">{doc.file_ref || "—"}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => { if (confirm("Delete this document record?")) act(async () => { await deleteDocumentAction(doc.id, projectId); toast.success("Removed from register"); }); }}
                                                className="h-7 w-7 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {initialDocuments.length === 0 && <tr><td colSpan={8} className="px-5 py-14 text-center text-sm text-slate-500">No documents registered yet</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── DIALOGS ── */}

            {/* Site Instruction */}
            <Dialog open={showSI} onOpenChange={setShowSI}>
                <DialogContent className="sm:max-w-[460px] bg-slate-900 border-slate-700 text-white">
                    <DialogHeader><DialogTitle>Issue Site Instruction</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateSI} className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Instruction Type</Label>
                                <Select value={siType} onValueChange={setSiType}>
                                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-700">{SI_TYPES.map(t => <SelectItem key={t} value={t} className="text-slate-200 text-xs">{t}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Date Issued</Label>
                                <Input type="date" value={siDate} onChange={e => setSiDate(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-slate-400">Recipient</Label>
                            <Input value={siRecipient} onChange={e => setSiRecipient(e.target.value)} placeholder="e.g. ABC Electrical Ltd" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-slate-400">Instruction Detail</Label>
                            <Textarea value={siDesc} onChange={e => setSiDesc(e.target.value)} required rows={4} placeholder="Describe the instruction in full..." className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
                        </div>
                        <DialogFooter>
                            <button type="submit" disabled={isPending} className="w-full h-11 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Issue Instruction"}
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* RFI */}
            <Dialog open={showRFI} onOpenChange={setShowRFI}>
                <DialogContent className="sm:max-w-[460px] bg-slate-900 border-slate-700 text-white">
                    <DialogHeader><DialogTitle>Raise Request for Information</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateRFI} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-slate-400">Question</Label>
                            <Textarea value={rfiQuestion} onChange={e => setRfiQuestion(e.target.value)} required rows={3} placeholder="State the information required..." className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Addressee</Label>
                                <Input value={rfiAddressee} onChange={e => setRfiAddressee(e.target.value)} placeholder="e.g. Client Architect" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Date Sent</Label>
                                <Input type="date" value={rfiSent} onChange={e => setRfiSent(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-slate-400">Response Required By</Label>
                            <Input type="date" value={rfiDue} onChange={e => setRfiDue(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
                        </div>
                        <DialogFooter>
                            <button type="submit" disabled={isPending} className="w-full h-11 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Raise RFI"}
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* RFI Respond */}
            <Dialog open={!!respondRfi} onOpenChange={open => { if (!open) setRespondRfi(null); }}>
                <DialogContent className="sm:max-w-[420px] bg-slate-900 border-slate-700 text-white">
                    <DialogHeader><DialogTitle>Log RFI Response</DialogTitle></DialogHeader>
                    {respondRfi && (
                        <form onSubmit={handleRespondRFI} className="space-y-4 py-2">
                            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-xs text-slate-400">
                                <p className="font-semibold text-slate-200">{respondRfi.rfi_number}</p>
                                <p className="mt-1">{respondRfi.question}</p>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Response Summary</Label>
                                <Textarea value={rfiResponse} onChange={e => setRfiResponse(e.target.value)} required rows={3} placeholder="Summarise the response received..." className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Date Response Received</Label>
                                <Input type="date" value={rfiRespondDate} onChange={e => setRfiRespondDate(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
                            </div>
                            <DialogFooter>
                                <button type="submit" disabled={isPending} className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log Response"}
                                </button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* EWN */}
            <Dialog open={showEWN} onOpenChange={setShowEWN}>
                <DialogContent className="sm:max-w-[480px] bg-slate-900 border-slate-700 text-white">
                    <DialogHeader><DialogTitle>Issue Early Warning Notice</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateEWN} className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Notice Type</Label>
                                <Select value={ewnType} onValueChange={setEwnType}>
                                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-700">{EWN_TYPES.map(t => <SelectItem key={t} value={t} className="text-slate-200 text-xs">{t}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Date Issued</Label>
                                <Input type="date" value={ewnDate} onChange={e => setEwnDate(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-slate-400">Description of Risk / Event</Label>
                            <Textarea value={ewnDesc} onChange={e => setEwnDesc(e.target.value)} required rows={4} placeholder="Describe the risk or event giving rise to this notice..." className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Potential Cost Impact (£)</Label>
                                <Input type="number" step="0.01" value={ewnCost} onChange={e => setEwnCost(e.target.value)} placeholder="0.00" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 font-mono" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Potential Time Impact (days)</Label>
                                <Input type="number" step="1" value={ewnTime} onChange={e => setEwnTime(e.target.value)} placeholder="0" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 font-mono" />
                            </div>
                        </div>
                        <DialogFooter>
                            <button type="submit" disabled={isPending} className="w-full h-11 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Issue Early Warning Notice"}
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Document Register */}
            <Dialog open={showDoc} onOpenChange={setShowDoc}>
                <DialogContent className="sm:max-w-[460px] bg-slate-900 border-slate-700 text-white">
                    <DialogHeader><DialogTitle>Register Document</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateDoc} className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Document Type</Label>
                                <Select value={docType} onValueChange={setDocType}>
                                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-700">{DOC_TYPES.map(t => <SelectItem key={t} value={t} className="text-slate-200 text-xs">{t}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Direction</Label>
                                <Select value={docDir} onValueChange={setDocDir}>
                                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-700">
                                        <SelectItem value="received" className="text-slate-200 text-xs">↓ Received</SelectItem>
                                        <SelectItem value="sent"     className="text-slate-200 text-xs">↑ Sent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-slate-400">Document Title</Label>
                            <Input value={docTitle} onChange={e => setDocTitle(e.target.value)} required placeholder="e.g. Ground Floor GA Plan" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Revision</Label>
                                <Input value={docRev} onChange={e => setDocRev(e.target.value)} placeholder="e.g. A" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
                            </div>
                            <div className="col-span-2 space-y-1.5">
                                <Label className="text-xs text-slate-400">Date</Label>
                                <Input type="date" value={docDate} onChange={e => setDocDate(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-slate-400">File Reference / Drawing Number</Label>
                            <Input value={docRef} onChange={e => setDocRef(e.target.value)} placeholder="e.g. DWG-001-GA-P01" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-slate-400">Notes</Label>
                            <Input value={docNotes} onChange={e => setDocNotes(e.target.value)} placeholder="Optional notes..." className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
                        </div>
                        <DialogFooter>
                            <button type="submit" disabled={isPending} className="w-full h-11 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Register Document"}
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
