"use client";

/**
 * P2-6 — extracted from contract-admin-client.tsx (was lines 1471–1598).
 *
 * Self-contained card: generates a token-based portal link for a
 * supervisor/sub-contractor and optionally sends the invite email.
 * Uses its own state entirely — no coupling to the rest of the
 * contract-admin dashboard — so extracting it is a pure move with
 * no behavioural change.
 */

import { useState } from "react";
import { Copy, Link2, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createSupervisorTokenAction } from "../actions";

export function SupervisorInvite({ projectId }: { projectId: string }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [saving, setSaving] = useState(false);
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);

    const handleCreate = async () => {
        if (!name.trim()) { toast.error("Enter supervisor name"); return; }
        setSaving(true);
        try {
            const result = await createSupervisorTokenAction({
                projectId,
                name: name.trim(),
                email: email.trim() || undefined,
            });
            if (result.success && result.token) {
                const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
                const link = `${baseUrl}/supervisor/${result.token}`;
                setGeneratedLink(link);
                toast.success(email.trim() ? "Invite sent and link generated" : "Portal link generated");
            } else {
                toast.error(result.error ?? "Failed to create invite");
            }
        } catch {
            toast.error("Failed to create invite");
        } finally {
            setSaving(false);
        }
    };

    const copyLink = () => {
        if (generatedLink) {
            navigator.clipboard.writeText(generatedLink);
            toast.success("Link copied to clipboard");
        }
    };

    return (
        <div className="bg-white/3 border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-blue-400" />
                    Supervisor Portal
                </h3>
                {!open && (
                    <button
                        onClick={() => setOpen(true)}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                    >
                        Invite Supervisor
                    </button>
                )}
            </div>
            <p className="text-xs text-slate-500 mb-3">
                Generate a read-only portal link for supervisors or sub-contractors to view and acknowledge their obligations.
            </p>

            {open && !generatedLink && (
                <div className="space-y-3 mt-3 pt-3 border-t border-white/10">
                    <div>
                        <label className="text-[11px] text-slate-500 font-medium mb-1 block">Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. John Smith"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                    </div>
                    <div>
                        <label className="text-[11px] text-slate-500 font-medium mb-1 block">Email (optional — sends invite)</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="supervisor@example.com"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleCreate}
                            disabled={saving}
                            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                            Generate Link
                        </button>
                        <button
                            onClick={() => { setOpen(false); setName(""); setEmail(""); }}
                            className="text-xs text-slate-500 hover:text-slate-300 px-3 py-2"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {generatedLink && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                    <p className="text-xs text-emerald-400 font-medium">Portal link created for {name}</p>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={generatedLink}
                            readOnly
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono"
                        />
                        <button
                            onClick={copyLink}
                            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                        >
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                        </button>
                    </div>
                    <button
                        onClick={() => { setGeneratedLink(null); setName(""); setEmail(""); setOpen(false); }}
                        className="text-xs text-slate-500 hover:text-slate-300"
                    >
                        Done
                    </button>
                </div>
            )}
        </div>
    );
}
