"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { updateProfileAction, rewriteWithAIAction, rewriteMdMessageAction } from "./actions";
import { uploadProfileImageAction } from "@/app/storage/actions";
import Link from "next/link";
import { CASE_STUDIES_PATH, SETUP_LIMITS } from "@/lib/first-session";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";
import { attemptProfileSave, profileFormSignature, PROFILE_LEAVE_WARNING, PROFILE_SAVE_UNCONFIRMED } from "./profile-form-state";
import { Upload, Loader2, Sparkles } from "lucide-react";
import ui from "@/components/company-profile.module.css";

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
    sales_email?: string | null;
    sales_phone?: string | null;
    accounts_email?: string | null;
    pdf_theme?: string | null;
    preferred_trades?: string[] | null;
    md_name?: string | null;
    md_message?: string | null;
    financial_year_start_month?: number | null;
    data_consent?: boolean | null;
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

// One section is shown at a time. Every section stays mounted, so each field keeps
// what was typed and is still posted by the whole-profile save.
const PROFILE_SECTIONS = [
    { id: "company-basics", label: "Company basics" },
    { id: "company-work", label: "Your work & story" },
    { id: "company-contacts", label: "Your people" },
    { id: "company-style", label: "Proposal style" },
    { id: "company-director", label: "Director message" },
    { id: "company-consent", label: "Data consent" },
] as const;
const PROFILE_SECTION_GROUPS = [
    { label: "Company profile", sections: PROFILE_SECTIONS.slice(0, 3) },
    { label: "Proposal defaults", sections: PROFILE_SECTIONS.slice(3, 5) },
    { label: "Data choices", sections: PROFILE_SECTIONS.slice(5) },
];
type ProfileSectionId = (typeof PROFILE_SECTIONS)[number]["id"];
const isProfileSection = (id: string): id is ProfileSectionId => PROFILE_SECTIONS.some(section => section.id === id);

function ProfileSuggestion({ id, suggestion, onUse, onDiscard }: {
    id: string;
    suggestion: string | null;
    onUse: () => void;
    onDiscard: () => void;
}) {
    if (!suggestion) return null;
    return (
        <div id={id} role="status" className="rounded-lg border border-dashed border-violet-400/60 bg-violet-500/10 p-3 space-y-2">
            <p className="text-xs font-semibold text-violet-200">Suggested wording. Check it says only what you wrote. Nothing changes unless you use it.</p>
            <p className="text-sm text-slate-100 whitespace-pre-wrap break-words">{suggestion}</p>
            <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onUse} className="min-h-11 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white">Use this wording</button>
                <button type="button" onClick={onDiscard} className="min-h-11 px-3 rounded-lg border border-slate-600 text-sm font-semibold text-slate-200 hover:bg-white/5">Keep my own</button>
            </div>
        </div>
    );
}

export default function ProfileForm({ profile, userEmail, save = updateProfileAction }: {
    profile: Profile | null;
    userEmail: string;
    /** Defaults to the real server action; replaced only by the fixture harness. */
    save?: typeof updateProfileAction;
}) {
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveNotice, setSaveNotice] = useState<string | null>(null);
    const formRef = useRef<HTMLFormElement | null>(null);
    const confirmedSignature = useRef<string | null>(null);
    const savingRef = useRef(false);
    useUnsavedGuard(dirty || saving || saveError !== null, PROFILE_LEAVE_WARNING);
    const [pdfTheme, setPdfTheme] = useState(profile?.pdf_theme || 'slate');
    const [logoUrl, setLogoUrl] = useState(profile?.logo_url || '');
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [capabilityStatement, setCapabilityStatement] = useState(profile?.capability_statement || '');
    const [rewritingCapability, setRewritingCapability] = useState(false);
    const [preferredTrades, setPreferredTrades] = useState<string[]>(profile?.preferred_trades || []);
    const [mdMessage, setMdMessage] = useState(profile?.md_message || '');
    const [rewritingMdMessage, setRewritingMdMessage] = useState(false);

    // A reply is held here as a suggestion. It replaces nothing until the contractor chooses it.
    const [capabilitySuggestion, setCapabilitySuggestion] = useState<string | null>(null);
    const [mdMessageSuggestion, setMdMessageSuggestion] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<ProfileSectionId>("company-basics");
    const [revealNotice, setRevealNotice] = useState<string | null>(null);

    // A link such as /dashboard/settings/profile#company-style opens that section.
    useEffect(() => {
        const openLinkedSection = () => {
            const id = window.location.hash.slice(1);
            if (!isProfileSection(id)) return;
            setActiveSection(id);
        };
        openLinkedSection();
        window.addEventListener("hashchange", openLinkedSection);
        return () => window.removeEventListener("hashchange", openLinkedSection);
    }, []);

    // Wait for the selected panel's hidden attribute to commit before focusing it.
    useEffect(() => {
        if (window.location.hash.slice(1) === activeSection) {
            document.getElementById(activeSection)?.focus();
        }
    }, [activeSection]);

    // On save the browser focuses the first invalid field. A field in a hidden section
    // cannot take focus, so its section is shown first, before the browser reports it.
    useEffect(() => {
        const form = formRef.current;
        if (!form) return;
        let revealing = false;
        const revealInvalid = (event: Event) => {
            if (revealing) return;
            const id = (event.target as Element).closest("section[id]")?.id ?? "";
            if (!isProfileSection(id)) return;
            revealing = true;
            // Later invalid events from the same save attempt keep the first field's section.
            setTimeout(() => { revealing = false; }, 0);
            const label = PROFILE_SECTIONS.find(item => item.id === id)?.label ?? "This section";
            flushSync(() => {
                setActiveSection(id);
                setRevealNotice(`${label} has a field to check before the profile can be saved.`);
            });
        };
        form.addEventListener("invalid", revealInvalid, true);
        return () => form.removeEventListener("invalid", revealInvalid, true);
    }, []);

    // State-only choices are mirrored on the form, so async replies compare the live DOM,
    // not an older render's values. Overrides cover a choice before React commits it.
    const snapshot = (form: HTMLFormElement, overrides: Record<string, string> = {}) => {
        const data = new FormData(form);
        data.set("pdf_theme", form.dataset.pdfTheme ?? "slate");
        data.set("preferred_trades", form.dataset.preferredTrades ?? "[]");
        for (const [name, value] of Object.entries(overrides)) data.set(name, value);
        return profileFormSignature(data);
    };
    const trackChanges = (overrides: Record<string, string> = {}) => {
        if (formRef.current) setDirty(snapshot(formRef.current, overrides) !== confirmedSignature.current);
        setSaveNotice(null);
    };

    const handleRewriteMdMessage = async () => {
        if (!mdMessage.trim()) return;
        setRewritingMdMessage(true);
        setMdMessageSuggestion(null);
        try {
            const result = await rewriteMdMessageAction(mdMessage);
            if (result.ok) setMdMessageSuggestion(result.text);
            else toast.error(result.error);
        } catch {
            toast.error("We couldn't suggest wording just now. Your own text is unchanged.");
        }
        setRewritingMdMessage(false);
    };

    const handleRewriteCapability = async () => {
        if (!capabilityStatement.trim()) return;
        setRewritingCapability(true);
        setCapabilitySuggestion(null);
        try {
            const result = await rewriteWithAIAction(capabilityStatement, "capability_statement");
            if (result.ok) setCapabilitySuggestion(result.text);
            else toast.error(result.error);
        } catch {
            toast.error("We couldn't suggest wording just now. Your own text is unchanged.");
        }
        setRewritingCapability(false);
    };

    const handleLogoUpload = async (file: File) => {
        setUploadingLogo(true);
        try {
            const formData = new FormData();
            formData.set("file", file);
            formData.set("purpose", "branding");
            const result = await uploadProfileImageAction(formData);
            if (!result.url) { toast.error(result.error || "Upload failed"); return; }
            setLogoUrl(result.url);
            trackChanges({ logo_url: result.url });
            toast.success("Logo uploaded");
        } finally {
            setUploadingLogo(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (savingRef.current) return;
        savingRef.current = true;
        setSaving(true);
        setSaveError(null);
        setSaveNotice(null);
        setRevealNotice(null);
        const form = e.currentTarget;
        try {
            const fd = new FormData(form);
            fd.set("pdf_theme", pdfTheme);
            fd.set("preferred_trades", JSON.stringify(preferredTrades));
            const submitted = profileFormSignature(fd);
            const result = await attemptProfileSave(save, fd);
            if (result.success) {
                confirmedSignature.current = submitted;
                const newerEdits = snapshot(form) !== submitted;
                setDirty(newerEdits);
                setSaveNotice(newerEdits ? "Submitted profile saved. Newer edits still need saving." : "Profile saved.");
                toast.success(newerEdits ? "Submitted profile saved. Newer edits still need saving." : "Profile saved ✓");
            } else {
                setSaveError(result.error || PROFILE_SAVE_UNCONFIRMED);
                toast.error("Save failed: " + (result.error || PROFILE_SAVE_UNCONFIRMED));
            }
        } catch {
            setSaveError(PROFILE_SAVE_UNCONFIRMED);
            toast.error(PROFILE_SAVE_UNCONFIRMED);
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    const statusMessage = saving ? "Saving the submitted profile..." : saveNotice || (saveError ? "Profile save not confirmed. Your current edits remain on this page." : dirty ? "Unsaved changes. Save before leaving this profile." : "No unsaved changes on this page.");

    return (
        <form onSubmit={handleSubmit} onChange={() => trackChanges()} className={ui.form} aria-busy={saving}
            data-pdf-theme={pdfTheme} data-preferred-trades={JSON.stringify(preferredTrades)}
            ref={(form) => {
                formRef.current = form;
                if (form && confirmedSignature.current === null) confirmedSignature.current = snapshot(form);
            }}>

            <p id="profile-save-status" role="status" aria-live="polite" className={ui.saveStatus}>
                {statusMessage}
            </p>
            {saveError && <p role="alert" className={ui.saveError}>{saveError}</p>}

            {/* Choosing a section only changes what is shown. It does not save or reset anything. */}
            <div className={ui.sectionLayout} data-profile-journey>
            <nav className={ui.navigation} aria-label="Company profile sections">
                {PROFILE_SECTION_GROUPS.map(group => (
                    <div key={group.label} role="group" aria-label={group.label} className={ui.navigationGroup}>
                    <p className={ui.navigationHeading}>{group.label}</p>
                    {group.sections.map(section => (
                    <button key={section.id} type="button" aria-controls={section.id}
                        aria-current={activeSection === section.id ? "true" : undefined}
                        onClick={() => { setActiveSection(section.id); setRevealNotice(null); }}>
                        {section.label}
                    </button>
                    ))}
                    </div>
                ))}
            </nav>
            <div className={ui.sectionBody} data-profile-panels>
            {revealNotice && <p role="status" className={ui.saveError}>{revealNotice}</p>}

            {/* Section B — Company Profile */}
            <section id="company-basics" tabIndex={-1} className={ui.section} hidden={activeSection !== "company-basics"}>
                <h2 className="text-lg font-bold text-slate-100">Company basics</h2>
                <p>Begin with who you are and the kind of work you do. Keep the other details for when you need them.</p>
                <div className={ui.fields}>
                    <div className="space-y-1.5">
                        <label htmlFor="company-company_name" className="text-sm font-medium text-slate-400">Company Name</label>
                        <input
                            id="company-company_name"
                            name="company_name"
                            defaultValue={profile?.company_name || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="Apex Construction Ltd"
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="profile-business-type" className="text-sm font-medium text-slate-400">What kind of work your business does</label>
                        {/* Free text, as in setup. A fixed list here would blank an answer it did not contain. */}
                        <input
                            id="profile-business-type"
                            name="business_type"
                            defaultValue={profile?.business_type || ""}
                            maxLength={SETUP_LIMITS.businessType}
                            placeholder="e.g. Kitchen and bathroom fitting, tiling and small extensions"
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="company-company_number" className="text-sm font-medium text-slate-400">Company Registration Number</label>
                        <input
                            id="company-company_number"
                            name="company_number"
                            defaultValue={profile?.company_number || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="12345678"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="company-vat_number" className="text-sm font-medium text-slate-400">VAT Number</label>
                        <input
                            id="company-vat_number"
                            name="vat_number"
                            defaultValue={profile?.vat_number || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="GB 123 4567 89"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="company-address" className="text-sm font-medium text-slate-400">Trading Address</label>
                        <input
                            id="company-address"
                            name="address"
                            defaultValue={profile?.address || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="123 High Street, London, SW1A 1AA"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="company-website" className="text-sm font-medium text-slate-400">Website</label>
                        <input
                            id="company-website"
                            name="website"
                            defaultValue={profile?.website || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="https://www.example.co.uk"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="company-years_trading" className="text-sm font-medium text-slate-400">Years Trading</label>
                        <input
                            id="company-years_trading"
                            name="years_trading"
                            type="number"
                            min={0}
                            defaultValue={profile?.years_trading ?? ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="15"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="company-financial_year_start_month" className="text-sm font-medium text-slate-400">Financial Year Start</label>
                        <select
                            id="company-financial_year_start_month"
                            name="financial_year_start_month"
                            defaultValue={profile?.financial_year_start_month ?? 4}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        >
                            {[
                                [1, "January"], [2, "February"], [3, "March"], [4, "April"],
                                [5, "May"], [6, "June"], [7, "July"], [8, "August"],
                                [9, "September"], [10, "October"], [11, "November"], [12, "December"],
                            ].map(([num, name]) => (
                                <option key={num} value={num}>{name} (FY starts {name})</option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-600">Used for financial year period breakdowns in Job P&L reports. UK default: April.</p>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="company-insurance_details" className="text-sm font-medium text-slate-400">Insurance Details</label>
                    <textarea
                        id="company-insurance_details"
                            name="insurance_details"
                        defaultValue={profile?.insurance_details || ""}
                        rows={2}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="Public Liability: £5M, Employer's Liability: £10M"
                    />
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="company-accreditations" className="text-sm font-medium text-slate-400">Accreditations</label>
                    <input
                        id="company-accreditations"
                            name="accreditations"
                        defaultValue={profile?.accreditations || ""}
                        className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="CITB, FMB Member, NHBC Registered"
                    />
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="company-logo-input" className="text-sm font-medium text-slate-400">Company Logo</label>
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
                                id="company-logo-input"
                                ref={logoInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleLogoUpload(file);
                                }}
                            />
                            <p className="text-xs text-slate-500">PNG, JPG or WebP, up to 10 MB</p>
                        </div>
                    </div>
                </div>
            </section>

            <section id="company-work" tabIndex={-1} className={ui.section} hidden={activeSection !== "company-work"}>
                <h2>Your work &amp; story</h2>
                <p>Introduce the experience behind your business. Your own work description stays in Company basics.</p>
                <div>
                    <p className="block text-sm font-semibold text-slate-100 mb-1">Your Trades</p>
                    <p className="text-xs text-slate-500 mb-3">Trade preferences are optional labels for estimating, not another description of your business. Nothing is selected from your description.</p>
                    {preferredTrades.length > 0 && <p className="text-sm text-slate-300">Selected preferences: {preferredTrades.join(", ")}</p>}
                    <details data-profile-trade-preferences>
                        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Optional trade preferences ({preferredTrades.length} selected)</summary>
                        <p className="text-xs text-slate-500 mb-3">Choose only the trades you want shown first in the estimating tool. All other trades remain available.</p>
                        <div className={ui.trades}>
                        {ALL_TRADES.map(trade => {
                            const isSelected = preferredTrades.includes(trade);
                            return (
                                <button
                                    key={trade}
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => {
                                        const next = isSelected ? preferredTrades.filter(t => t !== trade) : [...preferredTrades, trade];
                                        setPreferredTrades(next);
                                        trackChanges({ preferred_trades: JSON.stringify(next) });
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
                    </details>
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="company-specialisms" className="text-sm font-medium text-slate-400">Specialisms</label>
                    <input
                        id="company-specialisms"
                            name="specialisms"
                        defaultValue={profile?.specialisms || ""}
                        className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="Brickwork, Extensions, Groundworks"
                    />
                    <p className="text-xs text-slate-500">Comma-separated list of your key trades/specialisms</p>
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label htmlFor="company-capability_statement" className="text-sm font-medium text-slate-400">Capability Statement</label>
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
                        id="company-capability_statement"
                            name="capability_statement"
                        value={capabilityStatement}
                        onChange={(e) => setCapabilityStatement(e.target.value)}
                        rows={5}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="We are a family-run business with over 20 years of experience in residential and commercial construction across the South East..."
                    />
                    <ProfileSuggestion id="capability-suggestion" suggestion={capabilitySuggestion}
                        onUse={() => { const text = capabilitySuggestion ?? ""; setCapabilityStatement(text); trackChanges({ capability_statement: text }); setCapabilitySuggestion(null); }}
                        onDiscard={() => setCapabilitySuggestion(null)} />
                    <p className="text-xs text-slate-500">
                        This can provide your &ldquo;About Us&rdquo; paragraph in proposals. Review each proposal before sending.
                    </p>
                </div>
            </section>

            {/* Section A — Personal Details */}
            <section id="company-contacts" tabIndex={-1} className={ui.section} hidden={activeSection !== "company-contacts"}>
                <h2 className="text-lg font-bold text-slate-100">Personal Details</h2>
                <p>Your people and the contacts you use for sales and accounts.</p>
                <div className={ui.fields}>
                    <div className="space-y-1.5">
                        <label htmlFor="company-full_name" className="text-sm font-medium text-slate-400">Full Name</label>
                        <input
                            id="company-full_name"
                            name="full_name"
                            defaultValue={profile?.full_name || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="John Smith"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="company-account-email" className="text-sm font-medium text-slate-400">Email</label>
                        <input
                            id="company-account-email"
                            value={userEmail}
                            readOnly
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-500 cursor-not-allowed"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="company-phone" className="text-sm font-medium text-slate-400">Phone</label>
                        <input
                            id="company-phone"
                            name="phone"
                            defaultValue={profile?.phone || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="07700 900123"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="company-sales_email" className="text-sm font-medium text-slate-400">Sales Contact Email</label>
                        <input
                            id="company-sales_email"
                            name="sales_email"
                            type="email"
                            defaultValue={profile?.sales_email || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="sales@example.co.uk"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="company-sales_phone" className="text-sm font-medium text-slate-400">Sales Contact Phone</label>
                        <input
                            id="company-sales_phone"
                            name="sales_phone"
                            defaultValue={profile?.sales_phone || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="07700 900456"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="company-accounts_email" className="text-sm font-medium text-slate-400">Accounts / Credit Control Email</label>
                        <input
                            id="company-accounts_email"
                            name="accounts_email"
                            type="email"
                            defaultValue={profile?.accounts_email || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="accounts@example.co.uk"
                        />
                    </div>
                </div>
            </section>

            {/* Section C — Proposal Theme */}
            <section id="company-style" tabIndex={-1} className={ui.section} hidden={activeSection !== "company-style"}>
                <p>Shared proposal settings stay in this profile. Save still applies to every section.</p>
                <div>
                    <h2 className="text-lg font-bold text-slate-100">Proposal Theme</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Choose the colour scheme for your PDF proposals.</p>
                </div>
                {!THEMES.some(theme => theme.id === pdfTheme) && (
                    <p data-profile-saved-theme>
                        Saved theme: <strong>{pdfTheme}</strong>. This value is not one of the choices below. It is kept when you save unless you choose another theme.
                    </p>
                )}
                <div className={ui.themes}>
                    {THEMES.map(theme => (
                        <button
                            key={theme.id}
                            type="button"
                            aria-pressed={pdfTheme === theme.id}
                            onClick={() => { setPdfTheme(theme.id); trackChanges({ pdf_theme: theme.id }); }}
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
            </section>

            {/* Section — MD Message (for PDF proposals) */}
            <section id="company-director" tabIndex={-1} className={ui.section} hidden={activeSection !== "company-director"}>
                <p>Shared proposal settings stay in this profile. Save still applies to every section.</p>
                <h2 className="text-lg font-bold text-slate-100">Managing Director Message</h2>
                <p className="text-sm text-slate-400">This message appears in your PDF proposals as a personal note from the MD.</p>
                <div className={ui.fields}>
                    <div className="space-y-1.5">
                        <label htmlFor="company-md_name" className="text-sm font-medium text-slate-400">MD / Director Name</label>
                        <input
                            id="company-md_name"
                            name="md_name"
                            defaultValue={profile?.md_name || ""}
                            className="w-full h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="John Smith, Managing Director"
                        />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label htmlFor="company-md_message" className="text-sm font-medium text-slate-400">Personal Message</label>
                        {mdMessage.trim().length > 20 && (
                            <button
                                type="button"
                                onClick={handleRewriteMdMessage}
                                disabled={rewritingMdMessage}
                                className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-purple-700 bg-purple-900/30 text-purple-300 hover:bg-purple-800/40 text-xs font-bold transition-colors disabled:opacity-60"
                            >
                                {rewritingMdMessage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                {rewritingMdMessage ? "Rewriting..." : "Rewrite with AI"}
                            </button>
                        )}
                    </div>
                    <textarea
                        id="company-md_message"
                            name="md_message"
                        value={mdMessage}
                        onChange={(e) => setMdMessage(e.target.value)}
                        rows={4}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="Thank you for considering us for this project. We pride ourselves on delivering quality work on time and within budget..."
                    />
                    <ProfileSuggestion id="md-message-suggestion" suggestion={mdMessageSuggestion}
                        onUse={() => { const text = mdMessageSuggestion ?? ""; setMdMessage(text); trackChanges({ md_message: text }); setMdMessageSuggestion(null); }}
                        onDiscard={() => setMdMessageSuggestion(null)} />
                </div>
            </section>

            {/* ── Data Consent ──────────────────────────────────────────────── */}
            <section id="company-consent" tabIndex={-1} className={ui.section} hidden={activeSection !== "company-consent"}>
                <h2 className="text-base font-semibold text-white">Industry Benchmarking</h2>
                <p className="text-sm text-slate-400">
                    Help improve Constructa&apos;s industry benchmarks by contributing anonymised data from your closed projects.
                    No company names, client names, or contact details are ever shared. Only aggregated figures
                    (margin %, project type, contract value band, programme duration) are used.
                </p>
                <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                        type="checkbox"
                        name="data_consent"
                        value="true"
                        defaultChecked={profile?.data_consent ?? false}
                        className="mt-0.5 w-4 h-4 rounded accent-blue-600"
                    />
                    <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                        I consent to contributing anonymised benchmark data from my archived projects
                    </span>
                </label>
                <p className="text-xs text-slate-500">
                    You can withdraw consent at any time by unchecking this box. Previously contributed data
                    cannot be retroactively removed as it is fully anonymised with no link back to your account.
                </p>
            </section>

            {/* Section D — Past Projects & Case Studies. Edited on their own page; this form does not save them.
                Not one of the switched sections: it stays visible under whichever section is shown. */}
            <section data-profile-case-studies className={ui.section}>
                <h2 className="text-lg font-bold text-slate-100">Past Projects &amp; Case Studies</h2>
                <p className="text-sm text-slate-300">
                    Case studies are added and changed on their own page. Saving this profile does not change them.
                </p>
                <Link
                    href={CASE_STUDIES_PATH}
                    className="inline-flex items-center min-h-11 px-4 rounded-lg border border-blue-400 text-sm font-semibold text-blue-200 hover:bg-blue-900/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                    Go to case studies
                </Link>
            </section>

            </div>
            </div>

            <div className={ui.saveBar}>
                <p>Save applies to all sections of this profile, not just the section you are viewing.</p>
                {saveError ? <p className={ui.saveError}>{saveError}</p> : <p>{statusMessage}</p>}
                <button
                    type="submit"
                    disabled={saving}
                    className="w-full h-14 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-bold text-lg transition-all active:scale-[0.98]"
                >
                    {saving ? "Saving..." : "Save Company Profile"}
                </button>
            </div>
        </form>
    );
}
