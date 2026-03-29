"use client";

import { useState } from "react";
import { saveOnboardingAction, generateCapabilityStatementAction } from "./actions";
import PostcodeLookup from "@/components/postcode-lookup";
import { Sparkles } from "lucide-react";

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

const TRADES = [
    { label: "🏗️ General Builder / Extensions", value: "General Builder / Extensions" },
    { label: "⚡ Electrical", value: "Electrical" },
    { label: "🔧 Plumbing & Heating", value: "Plumbing & Heating" },
    { label: "🏠 Roofing", value: "Roofing" },
    { label: "🌱 Groundworks & Civils", value: "Groundworks & Civils" },
    { label: "🎨 Painting & Decorating", value: "Painting & Decorating" },
    { label: "🪵 Joinery & Carpentry", value: "Joinery & Carpentry" },
    { label: "🛁 Bathroom & Kitchen Fitting", value: "Bathroom & Kitchen Fitting" },
    { label: "🌿 Landscaping & Fencing", value: "Landscaping & Fencing" },
    { label: "🏢 Multi-trade / Other", value: "Multi-trade / Other" },
];

const INSURANCE_TYPES = [
    "Public Liability",
    "Employers Liability",
    "Professional Indemnity",
    "Contractors All Risk",
    "Other",
];

interface InsuranceRow {
    id: string;
    type: string;
    details: string;
}

interface TcClause {
    clause_number: number;
    title: string;
    body: string;
}

function StepIndicator({ current, total }: { current: number; total: number }) {
    const labels = ["Your Business", "Your Trade", "Capabilities", "Terms & Conditions"];
    return (
        <div className="flex items-center justify-center gap-2 mb-10">
            {Array.from({ length: total }, (_, i) => {
                const step = i + 1;
                const isActive = step === current;
                const isDone = step < current;
                return (
                    <div key={step} className="flex items-center gap-2">
                        <div className="flex flex-col items-center gap-1">
                            <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                                    isActive
                                        ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                                        : isDone
                                        ? "bg-green-500 text-white"
                                        : "bg-slate-100 text-slate-400 border border-slate-200"
                                }`}
                            >
                                {isDone ? (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    step
                                )}
                            </div>
                            <span className={`text-[11px] font-semibold hidden sm:block ${isActive ? "text-blue-600" : isDone ? "text-green-600" : "text-slate-400"}`}>
                                {labels[i]}
                            </span>
                        </div>
                        {step < total && (
                            <div className={`w-10 h-0.5 mb-4 ${isDone ? "bg-green-500" : "bg-slate-200"}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

const inputClass = "w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600";
const textareaClass = "w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none";

export default function OnboardingClient({ initialFullName }: { initialFullName: string }) {
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);

    // Step 1 fields
    const [companyName, setCompanyName] = useState("");
    const [fullName, setFullName] = useState(initialFullName);
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [website, setWebsite] = useState("");
    const [yearsTrading, setYearsTrading] = useState("");

    // Step 2
    const [businessType, setBusinessType] = useState("");

    // Step 3
    const [specialisms, setSpecialisms] = useState("");
    const [capabilityStatement, setCapabilityStatement] = useState("");
    const [generatingCapability, setGeneratingCapability] = useState(false);
    const [accreditations, setAccreditations] = useState("");
    const [insuranceRows, setInsuranceRows] = useState<InsuranceRow[]>([]);

    // Step 4
    const [useCustomTc, setUseCustomTc] = useState(false);
    const [tcClauses, setTcClauses] = useState<TcClause[]>(STANDARD_CLAUSES.map(c => ({ ...c })));

    const handleGenerateCapability = async () => {
        setGeneratingCapability(true);
        const result = await generateCapabilityStatementAction(businessType, specialisms);
        setCapabilityStatement(result);
        setGeneratingCapability(false);
    };

    const addInsuranceRow = () => {
        setInsuranceRows(prev => [...prev, { id: crypto.randomUUID(), type: "Public Liability", details: "" }]);
    };

    const removeInsuranceRow = (id: string) => {
        setInsuranceRows(prev => prev.filter(r => r.id !== id));
    };

    const updateInsuranceRow = (id: string, field: keyof InsuranceRow, value: string) => {
        setInsuranceRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const updateTcClause = (n: number, body: string) => {
        setTcClauses(prev => prev.map(c => c.clause_number === n ? { ...c, body } : c));
    };

    const handleFinish = async () => {
        setSaving(true);
        const fd = new FormData();
        fd.set("company_name", companyName);
        fd.set("full_name", fullName);
        fd.set("phone", phone);
        fd.set("address", address);
        fd.set("website", website);
        fd.set("years_trading", yearsTrading);
        fd.set("business_type", businessType);
        fd.set("specialisms", specialisms);
        fd.set("capability_statement", capabilityStatement);
        fd.set("accreditations", accreditations);
        fd.set("insurance_schedule", JSON.stringify(insuranceRows.filter(r => r.details)));
        fd.set("default_tc_overrides", useCustomTc ? JSON.stringify(tcClauses) : "");
        await saveOnboardingAction(fd);
        // redirect happens in server action
    };

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-2xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4">
                        <span className="text-white font-bold text-2xl">C</span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900">Welcome to Constructa</h1>
                    <p className="text-slate-500 mt-2">Let&apos;s set up your account in a few quick steps.</p>
                </div>

                <StepIndicator current={step} total={4} />

                {/* ── STEP 1: Your Business ── */}
                {step === 1 && (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 space-y-5">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Your Business</h2>
                            <p className="text-sm text-slate-500 mt-1">Tell us about your company — this appears on all your proposals.</p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Company / Trading Name <span className="text-red-500">*</span></label>
                            <input
                                value={companyName}
                                onChange={e => setCompanyName(e.target.value)}
                                placeholder="Apex Construction Ltd"
                                className={inputClass}
                                required
                            />
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Your Full Name</label>
                                <input
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    placeholder="John Smith"
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Phone Number</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    placeholder="07700 900123"
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Company Address</label>
                            <PostcodeLookup onAddressFound={addr => setAddress(prev => prev ? prev : addr)} theme="light" />
                            <textarea
                                value={address}
                                onChange={e => setAddress(e.target.value)}
                                placeholder="123 High Street&#10;London&#10;SW1A 1AA"
                                rows={3}
                                className={textareaClass + " mt-2"}
                            />
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Website <span className="text-slate-400 font-normal">(optional)</span></label>
                                <input
                                    type="url"
                                    value={website}
                                    onChange={e => setWebsite(e.target.value)}
                                    placeholder="https://www.example.co.uk"
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Years Trading</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={yearsTrading}
                                    onChange={e => setYearsTrading(e.target.value)}
                                    placeholder="e.g. 12"
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                disabled={!companyName.trim()}
                                onClick={() => setStep(2)}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-all"
                            >
                                Next: Your Trade →
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP 2: Your Trade ── */}
                {step === 2 && (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 space-y-6">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">What type of work do you specialise in?</h2>
                            <p className="text-sm text-slate-500 mt-1">Select your primary trade — this customises Constructa for your work.</p>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                            {TRADES.map(trade => (
                                <label key={trade.value} className="cursor-pointer block">
                                    <input
                                        type="radio"
                                        name="trade"
                                        value={trade.value}
                                        checked={businessType === trade.value}
                                        onChange={() => setBusinessType(trade.value)}
                                        className="sr-only peer"
                                    />
                                    <div className="border-2 border-slate-200 peer-checked:border-blue-600 peer-checked:bg-blue-50 hover:border-slate-300 rounded-xl p-4 transition-all cursor-pointer">
                                        <p className="text-sm font-semibold text-slate-800">{trade.label}</p>
                                    </div>
                                </label>
                            ))}
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="px-5 py-2.5 text-slate-600 text-sm font-semibold hover:text-slate-900 transition-colors"
                            >
                                ← Back
                            </button>
                            <button
                                type="button"
                                disabled={!businessType}
                                onClick={() => setStep(3)}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-all"
                            >
                                Next: Capabilities →
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP 3: Capabilities ── */}
                {step === 3 && (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 space-y-6">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Your Capabilities</h2>
                            <p className="text-sm text-slate-500 mt-1">This information will appear on your proposals to reassure clients.</p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Specialisms</label>
                            <input
                                value={specialisms}
                                onChange={e => setSpecialisms(e.target.value)}
                                placeholder="e.g. Victorian terrace extensions, loft conversions, conservation area work"
                                className={inputClass}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-slate-700">Capability Statement</label>
                                <button
                                    type="button"
                                    onClick={handleGenerateCapability}
                                    disabled={generatingCapability || (!businessType && !specialisms)}
                                    className="h-8 px-3 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold flex items-center gap-1.5 transition-colors"
                                >
                                    <Sparkles className={`w-3.5 h-3.5 ${generatingCapability ? "animate-spin" : ""}`} />
                                    {generatingCapability ? "Drafting..." : "✨ Draft with AI"}
                                </button>
                            </div>
                            <textarea
                                value={capabilityStatement}
                                onChange={e => setCapabilityStatement(e.target.value)}
                                placeholder="Describe your company, experience, and what makes you stand out..."
                                rows={5}
                                className={textareaClass}
                                style={{ minHeight: 150 }}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Accreditations</label>
                            <input
                                value={accreditations}
                                onChange={e => setAccreditations(e.target.value)}
                                placeholder="e.g. FMB Member, NHBC Registered, Gas Safe No. 12345"
                                className={inputClass}
                            />
                        </div>

                        {/* Insurance table */}
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-slate-700">Insurance</label>
                            {insuranceRows.length > 0 && (
                                <div className="space-y-2">
                                    {insuranceRows.map(row => (
                                        <div key={row.id} className="flex items-center gap-2">
                                            <select
                                                value={row.type}
                                                onChange={e => updateInsuranceRow(row.id, "type", e.target.value)}
                                                className="h-10 rounded-lg border border-slate-200 text-sm text-slate-900 px-2 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                                            >
                                                {INSURANCE_TYPES.map(t => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                            <input
                                                value={row.details}
                                                onChange={e => updateInsuranceRow(row.id, "details", e.target.value)}
                                                placeholder="e.g. £5M policy, expires Dec 2025"
                                                className={inputClass}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeInsuranceRow(row.id)}
                                                className="w-10 h-10 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center font-bold flex-shrink-0 transition-colors"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={addInsuranceRow}
                                className="h-9 px-4 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400 transition-colors text-sm font-semibold"
                            >
                                + Add Insurance
                            </button>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <button
                                type="button"
                                onClick={() => setStep(2)}
                                className="px-5 py-2.5 text-slate-600 text-sm font-semibold hover:text-slate-900 transition-colors"
                            >
                                ← Back
                            </button>
                            <button
                                type="button"
                                onClick={() => setStep(4)}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-all"
                            >
                                Next: Terms & Conditions →
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP 4: Standard T&Cs ── */}
                {step === 4 && (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 space-y-6">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Set your default Terms & Conditions</h2>
                            <p className="text-sm text-slate-500 mt-1">These will be included in all new proposals by default.</p>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <span className="text-sm font-semibold text-slate-700">Use standard T&Cs</span>
                            <button
                                type="button"
                                onClick={() => setUseCustomTc(!useCustomTc)}
                                className={`relative w-10 h-5 rounded-full transition-colors ml-auto ${useCustomTc ? "bg-blue-600" : "bg-slate-300"}`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow ${useCustomTc ? "translate-x-5" : ""}`} />
                            </button>
                            <span className="text-sm text-slate-500">{useCustomTc ? "Customise" : "Standard"}</span>
                        </div>

                        <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                            {tcClauses.map(clause => (
                                <div key={clause.clause_number} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                                    <p className="text-sm font-bold text-slate-800">{clause.clause_number}. {clause.title}</p>
                                    {useCustomTc ? (
                                        <textarea
                                            value={clause.body}
                                            onChange={e => updateTcClause(clause.clause_number, e.target.value)}
                                            rows={3}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none bg-white"
                                        />
                                    ) : (
                                        <p className="text-sm text-slate-600 leading-relaxed">{clause.body}</p>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <button
                                type="button"
                                onClick={() => setStep(3)}
                                className="px-5 py-2.5 text-slate-600 text-sm font-semibold hover:text-slate-900 transition-colors"
                            >
                                ← Back
                            </button>
                            <button
                                type="button"
                                onClick={handleFinish}
                                disabled={saving}
                                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-lg transition-all text-sm"
                            >
                                {saving ? "Setting up..." : "Finish Setup →"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
