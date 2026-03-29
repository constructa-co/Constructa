"use client";

import { useState } from "react";
import { MapPin, Search } from "lucide-react";

interface PostcodeLookupProps {
    onAddressFound: (address: string) => void;
    label?: string;
    theme?: "dark" | "light";
}

export default function PostcodeLookup({ onAddressFound, theme = "light" }: PostcodeLookupProps) {
    const [postcode, setPostcode] = useState("");
    const [streetLine, setStreetLine] = useState("");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const [message, setMessage] = useState("");
    const [areaResult, setAreaResult] = useState<string | null>(null);

    const baseInput = theme === "dark"
        ? "h-10 px-3 rounded-lg border border-slate-700 bg-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
        : "h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600";

    const handleLookup = async () => {
        const trimmed = postcode.trim().replace(/\s+/g, "").toUpperCase();
        if (!trimmed) return;
        setLoading(true);
        setStatus("idle");
        setMessage("");
        setAreaResult(null);

        try {
            const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(trimmed)}`);
            const data = await res.json();
            if (data.status === 200 && data.result) {
                const r = data.result;
                // postcodes.io returns area-level data only — no street name
                const area = [r.admin_district, r.admin_county || r.region, r.postcode.toUpperCase()]
                    .filter(Boolean).map(toTitleCase).join(", ");
                setAreaResult(area);
                setStatus("success");
                setMessage("Area found — add your street number and name above");
                // Build the full address combining street + area
                const street = streetLine.trim();
                onAddressFound(street ? `${street}\n${area}` : area);
            } else {
                setStatus("error");
                setMessage("Postcode not found — please enter address manually");
            }
        } catch {
            setStatus("error");
            setMessage("Postcode lookup failed");
        } finally {
            setLoading(false);
        }
    };

    // When street line changes after area is found, update the parent
    const handleStreetChange = (val: string) => {
        setStreetLine(val);
        if (areaResult) {
            onAddressFound(val ? `${val}\n${areaResult}` : areaResult);
        }
    };

    // Capitalise first letter of each word for display
    const toTitleCase = (str: string) =>
        str.replace(/\b\w/g, c => c.toUpperCase());

    return (
        <div className="space-y-2">
            {/* Street number + name */}
            <input
                type="text"
                value={streetLine}
                onChange={e => handleStreetChange(e.target.value)}
                placeholder="Street number and name (e.g. 42 High Street)"
                className={`w-full ${baseInput}`}
            />
            {/* Postcode row */}
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 flex-1">
                    <MapPin className={`w-4 h-4 flex-shrink-0 ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`} />
                    <input
                        type="text"
                        value={postcode}
                        onChange={e => setPostcode(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleLookup(); } }}
                        placeholder="Postcode (e.g. CO3 8WD)"
                        className={`flex-1 ${baseInput}`}
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
            </div>
            {status !== "idle" && (
                <p className={`text-xs font-medium ${status === "success" ? "text-green-600" : "text-red-500"}`}>
                    {message}
                </p>
            )}
            {areaResult && (
                <p className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                    Area: {areaResult}
                </p>
            )}
        </div>
    );
}
