"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, Loader2 } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";
import {
    BLANK_PROJECT_CREATE_ERROR,
    EMPTY_BLANK_PROJECT_FORM,
    PROJECT_TYPE_OPTIONS,
    briefPathForProject,
    validateBlankProjectForm,
    type BlankProjectField,
    type BlankProjectForm,
    type CreateBlankProjectResult,
} from "@/lib/blank-project";
import { createBlankProjectAction } from "./actions";
import ManualAddressEntry from "@/components/manual-address-entry";
import NewJobFrame from "@/components/new-job-frame";
import ui from "@/components/new-job.module.css";

type FieldErrors = Partial<Record<BlankProjectField, string>>;

interface Props {
    isFirstProject: boolean;
    /** Defaults to the real server action; replaced only by tests and evidence capture. */
    createProject?: (formData: FormData) => Promise<CreateBlankProjectResult>;
}

export default function NewProjectForm({ isFirstProject, createProject = createBlankProjectAction }: Props) {
    const router = useRouter();
    const { theme } = useTheme();
    const isDark = theme === "dark";

    // One id for the life of this form. Every retry reuses it, so a retry
    // after a lost response returns the project that was already created.
    const [requestId] = useState(() => crypto.randomUUID());
    const [form, setForm] = useState<BlankProjectForm>(EMPTY_BLANK_PROJECT_FORM);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [createError, setCreateError] = useState("");
    const [creating, setCreating] = useState(false);
    const [created, setCreated] = useState(false);
    const [showMore, setShowMore] = useState(false);
    const [structuredAddressDraftPending, setStructuredAddressDraftPending] = useState({ site: false, client: false });
    const inFlightRef = useRef(false);

    const hasStructuredAddressDraft = structuredAddressDraftPending.site || structuredAddressDraftPending.client;

    useUnsavedGuard(!created && (creating || hasStructuredAddressDraft || Object.values(form).some(value => value !== "")),
        "This new job has entries that are not saved yet.\n\nPress Cancel to stay here, or OK to leave without saving them.");

    const set = (field: BlankProjectField, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setFieldErrors((prev) => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
    };

    const showErrors = (errors: FieldErrors) => {
        setFieldErrors(errors);
        const optionalFields: BlankProjectField[] = [
            "clientEmail", "clientPhone", "clientAddress", "siteAddress", "projectType", "startDate", "potentialValue",
        ];
        if (optionalFields.some((field) => errors[field])) setShowMore(true);
    };

    const handleCreate = async () => {
        if (inFlightRef.current) return;

        const checked = validateBlankProjectForm(form, requestId);
        if (!checked.ok) {
            setCreateError("");
            showErrors(checked.fieldErrors);
            return;
        }

        inFlightRef.current = true;
        setCreating(true);
        setCreateError("");
        setFieldErrors({});

        const fd = new FormData();
        (Object.keys(form) as BlankProjectField[]).forEach((field) => fd.set(field, form[field]));
        fd.set("requestId", requestId);

        let result: CreateBlankProjectResult;
        try {
            result = await createProject(fd);
        } catch {
            result = { success: false, error: BLANK_PROJECT_CREATE_ERROR };
        }

        if (result.success) {
            setCreated(true);
            // Stay in the creating state while the Brief loads.
            const briefPath = briefPathForProject(result.projectId);
            router.push(briefPath);
            // Last resort if the soft navigation never settles.
            window.setTimeout(() => {
                if (window.location.pathname.startsWith("/dashboard/projects/new")) {
                    window.location.assign(briefPath);
                }
            }, 5000);
            return;
        }

        if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
            showErrors(result.fieldErrors);
        } else {
            setCreateError(result.error);
        }
        setCreating(false);
        inFlightRef.current = false;
    };

    const muted = isDark ? "text-slate-400" : "text-gray-600";
    const labelCls = `block text-sm font-semibold ${isDark ? "text-slate-200" : "text-gray-800"}`;
    const inputBase = `w-full rounded-lg border px-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        isDark
            ? "bg-[#0d0d0d] border-[#3a3a3a] text-white placeholder:text-slate-500 [color-scheme:dark]"
            : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
    }`;
    const inputCls = `${inputBase} h-12`;
    const textareaCls = `${inputBase} py-2.5 resize-none`;
    const errorCls = "mt-1.5 text-sm text-red-500";

    const field = (name: BlankProjectField) => ({
        id: `new-project-${name}`,
        "aria-invalid": fieldErrors[name] ? true : undefined,
        "aria-describedby": fieldErrors[name] ? `new-project-${name}-error` : undefined,
    });
    const fieldError = (name: BlankProjectField) =>
        fieldErrors[name] ? (
            <p id={`new-project-${name}-error`} className={errorCls}>{fieldErrors[name]}</p>
        ) : null;

    return (
        <NewJobFrame first={isFirstProject} dark={isDark} creating={creating} errorKey={createError || Object.entries(fieldErrors).map(([name, message]) => `${name}:${message}`).join("|")}>
            <form
                noValidate
                onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
                className={ui.form}
            >
                <div>
                    <label htmlFor="new-project-name" className={labelCls}>Job name</label>
                    <input
                        {...field("name")}
                        value={form.name}
                        onChange={(e) => set("name", e.target.value)}
                        placeholder="e.g. 14 Oak Road rear extension"
                        autoComplete="off"
                        maxLength={200}
                        className={`${inputCls} mt-1.5`}
                    />
                    {fieldError("name")}
                </div>

                <div>
                    <label htmlFor="new-project-client" className={labelCls}>Client name</label>
                    <input
                        {...field("client")}
                        value={form.client}
                        onChange={(e) => set("client", e.target.value)}
                        placeholder="e.g. Mr and Mrs Jones"
                        autoComplete="off"
                        maxLength={200}
                        className={`${inputCls} mt-1.5`}
                    />
                    {fieldError("client")}
                </div>

                <div className={ui.optional}>
                    <button
                        type="button"
                        onClick={() => setShowMore((open) => !open)}
                        aria-expanded={showMore}
                        aria-controls="new-project-more"
                        className={`w-full min-h-12 px-4 flex items-center justify-between gap-3 text-left text-sm font-semibold ${
                            isDark ? "text-slate-200" : "text-gray-800"
                        }`}
                    >
                        <span className="py-2">
                            <span className="block">Add more details</span>
                            <span className={`block font-normal ${muted}`}>Optional. You can add these later.</span>
                        </span>
                        <ChevronDown className={`w-5 h-5 flex-shrink-0 transition-transform ${showMore ? "rotate-180" : ""}`} />
                    </button>

                    <div id="new-project-more" hidden={!showMore} className="px-4 pt-2 pb-4 space-y-5">
                            <div className="grid sm:grid-cols-2 gap-5">
                                <div>
                                    <label htmlFor="new-project-clientEmail" className={labelCls}>Client email</label>
                                    <input
                                        {...field("clientEmail")}
                                        type="email"
                                        inputMode="email"
                                        autoComplete="off"
                                        value={form.clientEmail}
                                        onChange={(e) => set("clientEmail", e.target.value)}
                                        className={`${inputCls} mt-1.5`}
                                    />
                                    {fieldError("clientEmail")}
                                </div>
                                <div>
                                    <label htmlFor="new-project-clientPhone" className={labelCls}>Client phone</label>
                                    <input
                                        {...field("clientPhone")}
                                        type="tel"
                                        inputMode="tel"
                                        autoComplete="off"
                                        value={form.clientPhone}
                                        onChange={(e) => set("clientPhone", e.target.value)}
                                        className={`${inputCls} mt-1.5`}
                                    />
                                    {fieldError("clientPhone")}
                                </div>
                            </div>

                            <div>
                                <label htmlFor="new-project-siteAddress" className={labelCls}>Where is the job?</label>
                                <textarea
                                    {...field("siteAddress")}
                                    value={form.siteAddress}
                                    onChange={(e) => set("siteAddress", e.target.value)}
                                    rows={2}
                                    maxLength={500}
                                    placeholder="Site address and postcode"
                                    className={`${textareaCls} mt-1.5`}
                                />
                                {fieldError("siteAddress")}
                                <ManualAddressEntry
                                    idPrefix="new-project-site-manual"
                                    disabled={creating}
                                    onApply={(preview) => set("siteAddress", preview)}
                                    onPendingChange={(pending) => setStructuredAddressDraftPending((prev) => ({ ...prev, site: pending }))}
                                    isDark={isDark}
                                    labelCls={labelCls}
                                    inputCls={inputCls}
                                    muted={muted}
                                />
                            </div>

                            <div>
                                <label htmlFor="new-project-clientAddress" className={labelCls}>Client&apos;s address, if different</label>
                                <textarea
                                    {...field("clientAddress")}
                                    value={form.clientAddress}
                                    onChange={(e) => set("clientAddress", e.target.value)}
                                    rows={2}
                                    maxLength={500}
                                    className={`${textareaCls} mt-1.5`}
                                />
                                {fieldError("clientAddress")}
                                <ManualAddressEntry
                                    idPrefix="new-project-client-manual"
                                    disabled={creating}
                                    onApply={(preview) => set("clientAddress", preview)}
                                    onPendingChange={(pending) => setStructuredAddressDraftPending((prev) => ({ ...prev, client: pending }))}
                                    isDark={isDark}
                                    labelCls={labelCls}
                                    inputCls={inputCls}
                                    muted={muted}
                                />
                            </div>

                            <div>
                                <label htmlFor="new-project-projectType" className={labelCls}>Type of job</label>
                                <input
                                    {...field("projectType")}
                                    type="text"
                                    list="new-project-type-examples"
                                    placeholder="Not sure yet"
                                    value={form.projectType}
                                    onChange={(e) => set("projectType", e.target.value)}
                                    className={`${inputCls} mt-1.5`}
                                />
                                <datalist id="new-project-type-examples">
                                    {PROJECT_TYPE_OPTIONS.map((type) => (
                                        <option key={type} value={type} />
                                    ))}
                                </datalist>
                                <p className={`mt-1.5 text-sm ${muted}`}>Write your own type of job, or choose an example.</p>
                                {fieldError("projectType")}
                            </div>

                            <div className="grid sm:grid-cols-2 gap-5">
                                <div>
                                    <label htmlFor="new-project-startDate" className={labelCls}>Likely start date</label>
                                    <input
                                        {...field("startDate")}
                                        type="date"
                                        value={form.startDate}
                                        onChange={(e) => set("startDate", e.target.value)}
                                        className={`${inputCls} mt-1.5`}
                                    />
                                    {fieldError("startDate")}
                                </div>
                            </div>
                        </div>
                </div>

                {createError && (
                    <div
                        role="alert"
                        tabIndex={-1}
                        data-job-create-error
                        className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
                            isDark ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-red-200 bg-red-50 text-red-800"
                        }`}
                    >
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0 text-sm">
                            <p className="font-semibold">Project creation wasn&apos;t confirmed</p>
                            <p className="mt-0.5">{createError === BLANK_PROJECT_CREATE_ERROR ? "Your entries are still here. A missing reply does not prove whether a project was created." : createError}</p>
                            {createError === BLANK_PROJECT_CREATE_ERROR && (
                                <p className="mt-2" data-job-retry-help>
                                    Try again uses the same request. If the first attempt already created the job, it opens that job; changes you made here afterwards are not applied to it. Check its details before continuing.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {creating && (
                    <p role="status" className={`text-sm ${muted}`} data-job-pending-help>
                        Creating from the details you submitted. Changes typed while this is in progress are not included in that request.
                    </p>
                )}

                <button
                    type="submit"
                    disabled={creating}
                    className="w-full min-h-12 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white text-base font-bold transition-colors flex items-center justify-center gap-2"
                >
                    {creating ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Creating your project…
                        </>
                    ) : createError ? (
                        "Try again"
                    ) : (
                        "Create project and start the brief"
                    )}
                </button>
            </form>
        </NewJobFrame>
    );
}
