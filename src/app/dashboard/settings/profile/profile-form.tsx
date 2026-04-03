"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { updateProfileAction, rewriteWithAIAction } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, ChevronDown, ChevronUp, Upload, Loader2, Sparkles } from "lucide-react";

interface CaseStudy {
    id: string;
    projectName: string;
    projectType: string;
    contractValue: string;
    programmeDuration: string;
    client: string;
    location: string;
    whatWeDelivered: string;
    valueAdded: string;
    photos: string[]; // up to 3 URLs
}

interface Profile {
    full_name?: string | null;
    phone?: string | null;
    company_name?: string | null;
    company_number?: string | null;
    vat_number?: string | null;
    address?: string | null;
    website?: string | null;
    years_trading?: number | null;
    specialisms?: string | null;
    insurance_details?: string | null;
    accreditations?: string | null;
    capability_statement?: string | null;
    logo_url?: string | null;
    business_type?: string | null;
    case_studies?: CaseStudy[] | null;
    sales_email?: string | null;
    sales_phone?: string | null;
    accounts_email?: string | null;
    pdf_theme?: string | null;
    preferred_trades?: string[] | null;
    md_name?: string | null;
    md_message?: string | null;
}

const THEMES = [
    {
        id: 'slate',
        name: 'Slate',
        subtitle: 'Modern & Premium',
        primary: '#0D0D0D',
        accent: '#FFFFFF',
    },
    {
        id: 'navy',
        name: 'Navy',
        subtitle: 'Established & Traditional',
        primary: '#0A1628',
        accent: '#C9A84C',
    },
    {
        id: 'forest',
        name: 'Forest',
        subtitle: 'Craft & Heritage',
        primary: '#1A3A2A',
        accent: '#E8E0D0',
    },
];

const BUSINESS_TYPES = [
    "General Builder / Extensions",
    "Electrical",
    "Plumbing & Heating",
    "Roofing",
    "Groundworks & Civils",
    "Painting & Decorating",
    "Joinery & Carpentry",
    "Bathroom & Kitchen Fitting",
    "Landscaping & Fencing",
    "Multi-trade / Other",
];

const ALL_TRADES = [
    'Site Setup & Preliminaries', 'Demolition & Strip Out', 'Asbestos Removal',
    'Temporary Works / Propping / Shoring', 'Groundworks & Civils', 'Drainage',
    'Utilities \u2013 Water', 'Utilities \u2013 Gas', 'Utilities \u2013 Electric / Ducting',
    'Utilities \u2013 Telecoms / Data Ducting', 'Attenuation / SuDS / Stormwater',
    'Piling', 'Underpinning & Structural Stabilisation', 'Concrete / RC Works',
    'Steel Frame / Steel Erection', 'Structural Timber / Framing',
    'Masonry / Brickwork / Blockwork', 'Cladding & Rainscreen', 'Roofing',
    'Waterproofing', 'Insulation', 'Windows, Doors & Glazing',
    'Builders / General Building', 'Landscaping & External Works',
    'Surfacing, Paving & Kerbing', 'Fencing & Gates',
    'Swimming Pools & Water Features', 'Signage', 'Line Marking & Road Furniture',
    'External Lighting', 'Domestic Electrical', 'Commercial Electrical',
    'Industrial Electrical', 'EV Chargers', 'Street Electrical / Feeder Pillars',
    'Substations', 'Domestic Plumbing', 'Commercial Plumbing / Public Health',
    'Mechanical / HVAC', 'Domestic Heating', 'Air Conditioning / Refrigeration',
    'Fire Alarm & Life Safety', 'Security / CCTV / Access Control',
    'Drylining & Partitions', 'Plastering & Rendering', 'Carpentry & Joinery',
    'Kitchen Installation', 'Bathroom Installation', 'Tiling', 'Flooring',
    'Ceilings', 'Painting & Decorating', 'Fire Stopping',
    'Passive Fire Protection / Intumescent', 'Diamond Drilling & Sawing',
    'Builderswork in Connection', 'Specialist Finishes', 'Waste Management / Logistics',
    'Scaffolding & Access',
];

function CaseStudyCard({
    cs,
    index,
    onChange,
    onRemove,
}: {
    cs: CaseStudy;
    index: number;
    onChange: (updated: CaseStudy) => void;
    onRemove: () => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const [uploading, setUploading] = useState<number | null>(null);

    const update = (field: keyof CaseStudy, value: string | string[]) =>
        onChange({ ...cs, [field]: value });

    const handlePhotoUpload = async (slot: number, file: File) => {
        setUploading(slot);
        const supabase = createClient();
        const ext = file.name.split(".").pop() || "jpg";
        const path = `case-studies/${cs.id}/${slot}.${ext}`;
        const { error } = await supabase.storage
            .from("proposal-photos")
            .upload(path, file, { upsert: true });
        if (!error) {
            const { data } = supabase.storage.from("proposal-photos").getPublicUrl(path);
            const newPhotos = [...(cs.photos || ["", "", ""])];
            newPhotos[slot] = data.publicUrl;
            update("photos", newPhotos);
        } else {
            toast.error("Upload failed: " + error.message);
        }
        setUploading(null);
    };

    const inputCls = "w-full h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600";
    const labelCls = "text-xs font-medium text-slate-400 block mb-1";

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {/* Card Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-800/60 border-b border-slate-700">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Case Study {index + 1}</span>
                    {cs.projectName && (
                        <span className="text-sm font-semibold text-slate-200">— {cs.projectName}</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setExpanded(e => !e)}
                        className="text-slate-500 hover:text-slate-300 p-1 rounded"
                    >
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                        type="button"
                        onClick={onRemove}
                        className="text-slate-600 hover:text-red-400 p-1 rounded transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="p-5 space-y-4">
                    {/* Row 1: Project Name + Type */}
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Project Name</label>
                            <input value={cs.projectName} onChange={e => update("projectName", e.target.value)} placeholder="Rear Extension, 42 Oak Avenue" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Project Type</label>
                            <input value={cs.projectType} onChange={e => update("projectType", e.target.value)} placeholder="Extension" className={inputCls} />
                        </div>
                    </div>

                    {/* Row 2: Value + Duration + Client + Location */}
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Contract Value (£)</label>
                            <input type="number" value={cs.contractValue} onChange={e => update("contractValue", e.target.value)} placeholder="45000" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Programme Duration</label>
                            <input value={cs.programmeDuration} onChange={e => update("programmeDuration", e.target.value)} placeholder="6 weeks" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Client (optional)</label>
                            <input value={cs.client} onChange={e => update("client", e.target.value)} placeholder="Mr & Mrs Johnson" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Location</label>
                            <input value={cs.location} onChange={e => update("location", e.target.value)} placeholder="Guildford, Surrey" className={inputCls} />
                        </div>
                    </div>

                    {/* What We Delivered */}
                    <div>
                        <label className={labelCls}>What We Delivered</label>
                        <textarea
                            value={cs.whatWeDelivered}
                            onChange={e => update("whatWeDelivered", e.target.value)}
                            rows={3}
                            placeholder="3-4 sentences describing the works..."
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                    </div>

                    {/* Value Added */}
                    <div>
                        <label className={labelCls}>Value Added</label>
                        <textarea
                            value={cs.valueAdded}
                            onChange={e => update("valueAdded", e.target.value)}
                            rows={2}
                            placeholder="What made this project special..."
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                    </div>

                    {/* Photos */}
                    <div>
                        <label className={labelCls}>Photos (up to 3)</label>
                        <div className="grid grid-cols-3 gap-3">
                            {[0, 1, 2].map(slot => {
                                const url = (cs.photos || [])[slot] || "";
                                return (
                                    <div key={slot} className="relative">
                                        {url ? (
                                            <div className="relative group">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={url} alt={`Photo ${slot + 1}`} className="w-full h-24 object-cover rounded-lg border border-slate-700" />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newPhotos = [...(cs.photos || ["", "", ""])];
                                                        newPhotos[slot] = "";
                                                        update("photos", newPhotos);
                                                    }}
                                                    className="absolute top-1 right-1 bg-red-600 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="flex flex-col items-center justify-center w-full h-24 rounded-lg border-2 border-dashed border-slate-700 bg-slate-800/50 cursor-pointer hover:border-blue-600 transition-colors">
                                                {uploading === slot ? (
                                                    <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                                                ) : (
                                                    <>
                                                        <Upload className="w-5 h-5 text-slate-500 mb-1" />
                                                        <span className="text-xs text-slate-500">Photo {slot + 1}</span>
                                                    </>
                                                )}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={e => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handlePhotoUpload(slot, file);
                                                    }}
                                                />
                                            </label>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ProfileForm({ profile, userEmail }: { profile: Profile | null; userEmail: string }) {
    const [saving, setSaving] = useState(false);
    const [caseStudies, setCaseStudies] = useState<CaseStudy[]>(
        (profile?.case_studies as CaseStudy[] | null | undefined) || []
    );
    const [pdfTheme, setPdfTheme] = useState(profile?.pdf_theme || 'slate');
    const [logoUrl, setLogoUrl] = useState(profile?.logo_url || '');
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [capabilityStatement, setCapabilityStatement] = useState(profile?.capability_statement || '');
    const [rewritingCapability, setRewritingCapability] = useState(false);
    const [preferredTrades, setPreferredTrades] = useState<string[]>(profile?.preferred_trades || []);

    const handleRewriteCapability = async () => {
        if (!capabilityStatement.trim()) return;
        setRewritingCapability(true);
        try {
            const result = await rewriteWithAIAction(capabilityStatement, "capability_statement");
            if (result.text) setCapabilityStatement(result.text);
        } catch {
            toast.error("AI rewrite failed");
        }
        setRewritingCapability(false);
    };

    const handleLogoUpload = async (file: File) => {
        setUploadingLogo(true);
        try {
            const supabase = createClient();
            const { data: authData } = await supabase.auth.getUser();
            const userId = authData?.user?.id;
            if (!userId) { toast.error("Not authenticated"); return; }
            const ext = file.name.split(".").pop() || "png";
            const path = `logos/${userId}/${Date.now()}.${ext}`;
            const { error } = await supabase.storage
                .from("proposal-photos")
                .upload(path, file, { upsert: true });
            if (error) { toast.error("Upload failed: " + error.message); return; }
            const { data } = supabase.storage.from("proposal-photos").getPublicUrl(path);
            setLogoUrl(data.publicUrl);
            toast.success("Logo uploaded");
        } finally {
            setUploadingLogo(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        const fd = new FormData(e.currentTarget);
        fd.set("case_studies", JSON.stringify(caseStudies));
        fd.set("pdf_theme", pdfTheme);
        fd.set("preferred_trades", JSON.stringify(preferredTrades));
        const result = await updateProfileAction(fd);
        setSaving(false);
        if (result?.success) {
            toast.success("Profile saved ✓");
        } else {
            toast.error("Save failed: " + (result?.error || "Unknown error"));
        }
    };

    function addCaseStudy() {
        setCaseStudies(prev => [...prev, {
            id: crypto.randomUUID(),
            projectName: "",
            projectType: "",
            contractValue: "",
            programmeDuration: "",
            client: "",
            location: "",
            whatWeDelivered: "",
            valueAdded: "",
            photos: ["", "", ""],
        }]);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section A — Personal Details */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                <h2 className="text-lg font-bold text-slate-100">Personal Details</h2>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Full Name</label>
                        <input
                            name="full_name"
                            defaultValue={profile?.full_name || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="John Smith"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Email</label>
                        <input
                            value={userEmail}
                            readOnly
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-500 cursor-not-allowed"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Phone</label>
                        <input
                            name="phone"
                            defaultValue={profile?.phone || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="07700 900123"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Sales Contact Email</label>
                        <input
                            name="sales_email"
                            type="email"
                            defaultValue={profile?.sales_email || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="sales@example.co.uk"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Sales Contact Phone</label>
                        <input
                            name="sales_phone"
                            defaultValue={profile?.sales_phone || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="07700 900456"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Accounts / Credit Control Email</label>
                        <input
                            name="accounts_email"
                            type="email"
                            defaultValue={profile?.accounts_email || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="accounts@example.co.uk"
                        />
                    </div>
                </div>
            </div>

            {/* Section B — Company Profile */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                <h2 className="text-lg font-bold text-slate-100">Company Profile</h2>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Company Name</label>
                        <input
                            name="company_name"
                            defaultValue={profile?.company_name || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="Apex Construction Ltd"
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Company Registration Number</label>
                        <input
                            name="company_number"
                            defaultValue={profile?.company_number || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="12345678"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">VAT Number</label>
                        <input
                            name="vat_number"
                            defaultValue={profile?.vat_number || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="GB 123 4567 89"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Trading Address</label>
                        <input
                            name="address"
                            defaultValue={profile?.address || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="123 High Street, London, SW1A 1AA"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Website</label>
                        <input
                            name="website"
                            defaultValue={profile?.website || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="https://www.example.co.uk"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Years Trading</label>
                        <input
                            name="years_trading"
                            type="number"
                            min={0}
                            defaultValue={profile?.years_trading || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="15"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400">Primary Trade / Business Type</label>
                    <select
                        name="business_type"
                        defaultValue={profile?.business_type || ""}
                        className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                        <option value="">Select your primary trade...</option>
                        {BUSINESS_TYPES.map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-slate-100 mb-1">Your Trades</label>
                    <p className="text-xs text-slate-500 mb-3">Select the trades your company works in. These appear first in the estimating tool.</p>
                    <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto border border-slate-700 rounded-lg p-3">
                        {ALL_TRADES.map(trade => {
                            const isSelected = preferredTrades.includes(trade);
                            return (
                                <button
                                    key={trade}
                                    type="button"
                                    onClick={() => {
                                        setPreferredTrades(prev =>
                                            isSelected
                                                ? prev.filter(t => t !== trade)
                                                : [...prev, trade]
                                        );
                                    }}
                                    className={`text-xs px-2 py-1.5 rounded-md border text-left transition-colors ${
                                        isSelected
                                            ? 'bg-white text-slate-900 border-white font-medium'
                                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                                    }`}
                                >
                                    {trade}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400">Specialisms</label>
                    <input
                        name="specialisms"
                        defaultValue={profile?.specialisms || ""}
                        className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="Brickwork, Extensions, Groundworks"
                    />
                    <p className="text-xs text-slate-500">Comma-separated list of your key trades/specialisms</p>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400">Insurance Details</label>
                    <textarea
                        name="insurance_details"
                        defaultValue={profile?.insurance_details || ""}
                        rows={2}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="Public Liability: £5M, Employer's Liability: £10M"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400">Accreditations</label>
                    <input
                        name="accreditations"
                        defaultValue={profile?.accreditations || ""}
                        className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="CITB, FMB Member, NHBC Registered"
                    />
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-slate-400">Capability Statement</label>
                        {capabilityStatement.trim().length > 20 && (
                            <button
                                type="button"
                                onClick={handleRewriteCapability}
                                disabled={rewritingCapability}
                                className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-purple-700 bg-purple-900/30 text-purple-300 hover:bg-purple-800/40 text-xs font-bold transition-colors disabled:opacity-60"
                            >
                                {rewritingCapability ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                {rewritingCapability ? "Rewriting..." : "Rewrite with AI"}
                            </button>
                        )}
                    </div>
                    <textarea
                        name="capability_statement"
                        value={capabilityStatement}
                        onChange={(e) => setCapabilityStatement(e.target.value)}
                        rows={5}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="We are a family-run business with over 20 years of experience in residential and commercial construction across the South East..."
                    />
                    <p className="text-xs text-slate-500">
                        This is your &ldquo;About Us&rdquo; paragraph — it appears on every proposal PDF.
                    </p>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400">Managing Director Name</label>
                    <input
                        name="md_name"
                        defaultValue={profile?.md_name || ""}
                        className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="John Smith"
                    />
                    <p className="text-xs text-slate-500">Appears as the signatory on the &ldquo;Why Choose Us&rdquo; page of your proposal PDF.</p>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400">MD Message</label>
                    <textarea
                        name="md_message"
                        defaultValue={profile?.md_message || ""}
                        rows={3}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="A personal message from the MD to appear on the About Us page of your proposals..."
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400">Closing Statement</label>
                    <textarea
                        name="closing_statement"
                        defaultValue={profile?.closing_statement || ""}
                        rows={3}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="A closing paragraph for the 'Why Choose Us' page, e.g. We look forward to working with you on this project..."
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400">Company Logo</label>
                    <input name="logo_url" type="hidden" value={logoUrl} />
                    <div className="flex items-start gap-4">
                        {logoUrl && (
                            <div className="p-2 bg-slate-800 rounded-lg border border-slate-700 flex-shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={logoUrl} alt="Logo preview" className="h-16 w-auto object-contain" />
                            </div>
                        )}
                        <div className="flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={() => logoInputRef.current?.click()}
                                disabled={uploadingLogo}
                                className="flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-700 bg-slate-800 text-sm text-slate-100 hover:bg-slate-700 transition-colors disabled:opacity-60"
                            >
                                {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                {uploadingLogo ? "Uploading..." : "Upload Logo"}
                            </button>
                            <input
                                ref={logoInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleLogoUpload(file);
                                }}
                            />
                            <p className="text-xs text-slate-500">PNG or JPG, max 2MB recommended</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section C — Proposal Theme */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                <div>
                    <h2 className="text-lg font-bold text-slate-100">Proposal Theme</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Choose the colour scheme for your PDF proposals.</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    {THEMES.map(theme => (
                        <button
                            key={theme.id}
                            type="button"
                            onClick={() => setPdfTheme(theme.id)}
                            className={`relative flex items-stretch rounded-xl border transition-all text-left overflow-hidden ${
                                pdfTheme === theme.id
                                    ? 'ring-2 ring-gray-900 border-slate-500'
                                    : 'border-slate-700 hover:border-slate-500'
                            }`}
                        >
                            <div className="w-1 shrink-0" style={{ backgroundColor: theme.primary }} />
                            <div className="flex-1 p-3">
                                <div className="text-sm font-semibold text-slate-100">{theme.name}</div>
                                <div className="text-xs text-slate-400 mt-0.5">{theme.subtitle}</div>
                            </div>
                            <div className="flex items-center pr-3">
                                <div className="w-3 h-3 rounded-full border border-slate-600" style={{ backgroundColor: theme.accent }} />
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Section D — Past Projects & Case Studies */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-100">Past Projects &amp; Case Studies</h2>
                        <p className="text-xs text-slate-500 mt-0.5">These appear in your proposal PDF to showcase your work.</p>
                    </div>
                    <button
                        type="button"
                        onClick={addCaseStudy}
                        className="flex items-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-300 bg-blue-900/20 hover:bg-blue-900/40 border border-blue-700/40 rounded-lg px-3 py-1.5 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Case Study
                    </button>
                </div>

                {caseStudies.length === 0 && (
                    <div className="text-center py-10 border-2 border-dashed border-slate-800 rounded-xl">
                        <p className="text-slate-500 text-sm">No case studies yet. Add your first to showcase past work in proposals.</p>
                        <button
                            type="button"
                            onClick={addCaseStudy}
                            className="mt-3 text-sm font-semibold text-blue-400 hover:text-blue-300"
                        >
                            + Add Case Study
                        </button>
                    </div>
                )}

                <div className="space-y-4">
                    {caseStudies.map((cs, i) => (
                        <CaseStudyCard
                            key={cs.id}
                            cs={cs}
                            index={i}
                            onChange={updated => setCaseStudies(prev => prev.map((c, idx) => idx === i ? updated : c))}
                            onRemove={() => setCaseStudies(prev => prev.filter((_, idx) => idx !== i))}
                        />
                    ))}
                </div>
            </div>

            {/* Section — MD Message (for PDF proposals) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                <h2 className="text-lg font-bold text-slate-100">Managing Director Message</h2>
                <p className="text-sm text-slate-400">This message appears in your PDF proposals as a personal note from the MD.</p>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">MD / Director Name</label>
                        <input
                            name="md_name"
                            defaultValue={profile?.md_name || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="John Smith, Managing Director"
                        />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400">Personal Message</label>
                    <textarea
                        name="md_message"
                        defaultValue={profile?.md_message || ""}
                        rows={4}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="Thank you for considering us for this project. We pride ourselves on delivering quality work on time and within budget..."
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={saving}
                className="w-full h-14 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-bold text-lg transition-all active:scale-[0.98]"
            >
                {saving ? "Saving..." : "Save Company Profile"}
            </button>
        </form>
    );
}
