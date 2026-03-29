"use client";

import { useState } from "react";
import { MapPin, Search } from "lucide-react";

interface PostcodeLookupProps {
    onAddressFound: (address: string) => void;
    label?: string;
    /** dark = dashboard style, light = onboarding/public style */
    theme?: "dark" | "light";
}

export default function PostcodeLookup({ onAddressFound, label = "Postcode Lookup", theme = "light" }: PostcodeLookupProps) {
    const [postcode, setPostcode] = useState("");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const inputClass = theme === "dark"
        ? "h-10 px-3 rounded-lg border border-slate-700 bg-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
        : "h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600";

    const handleLookup = async () => {
        const trimmed = postcode.trim().replace(/\s+/g, "").toUpperCase();
        if (!trimmed) return;
        setLoading(true);
        setStatus("idle");
        setMessage("");

        try {
            const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(trimmed)}`);
            const data = await res.json();
            if (data.status === 200 && data.result) {
                const r = data.result;
                const parts = [
                    r.admin_ward,
                    r.admin_district,
                    r.admin_county,
                    r.region,
                    r.postcode,
                ].filter(Boolean);
                const address = parts.join(", ");
                onAddressFound(address);
                setStatus("success");
                setMessage("Address populated from postcode");
            } else {
                setStatus("error");
                setMessage("Postcode not found");
            }
        } catch {
            setStatus("error");
            setMessage("Postcode lookup failed");
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleLookup();
        }
    };

    return (
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1">
                <MapPin className={`w-4 h-4 flex-shrink-0 ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`} />
                <input
                    type="text"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter postcode (e.g. SW1A 1AA)"
                    className={`flex-1 ${inputClass}`}
                    maxLength={8}
                />
            </div>
            <button
                type="button"
                onClick={handleLookup}
                disabled={loading || !postcode.trim()}
                className="h-10 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
                <Search className="w-3.5 h-3.5" />
                {loading ? "Looking up..." : "Find Address"}
            </button>
            {status !== "idle" && (
                <span className={`text-xs font-medium whitespace-nowrap ${status === "success" ? "text-green-600" : "text-red-500"}`}>
                    {message}
                </span>
            )}
        </div>
    );
}
