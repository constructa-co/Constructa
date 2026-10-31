"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import {
    isPostcodeLookupInputPresent,
    normalizePostcodeForLookup,
    POSTCODE_LOOKUP_FAILED_MESSAGE,
    POSTCODE_LOOKUP_NOT_AVAILABLE_MESSAGE,
    POSTCODE_LOOKUP_NOT_FOUND_MESSAGE,
    type PostcodeAddressCandidate,
    type PostcodeLookupFn,
} from "@/lib/postcode-address";
import { coreFocusVisibleRing, corePrimaryButton } from "@/lib/core-editing-palette";

type Props = {
    idPrefix: string;
    disabled?: boolean;
    /** When omitted, Find explains that search is not connected — no network calls. */
    lookup?: PostcodeLookupFn;
    onSelect: (address: string) => void;
    isDark: boolean;
    inputCls: string;
    muted: string;
};

export default function PostcodeAddressPicker({
    idPrefix,
    disabled = false,
    lookup,
    onSelect,
    isDark,
    inputCls,
    muted,
}: Props) {
    const [postcode, setPostcode] = useState("");
    const [loading, setLoading] = useState(false);
    const [candidates, setCandidates] = useState<PostcodeAddressCandidate[]>([]);
    const [status, setStatus] = useState<"idle" | "info" | "error">("idle");
    const [message, setMessage] = useState("");
    const lookupGenerationRef = useRef(0);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            lookupGenerationRef.current += 1;
        };
    }, []);

    const applyIfCurrentGeneration = (generation: number, apply: () => void) => {
        if (!mountedRef.current || generation !== lookupGenerationRef.current) return;
        apply();
    };

    const invalidateInFlightLookup = () => {
        lookupGenerationRef.current += 1;
    };

    const runLookup = async () => {
        if (disabled || !isPostcodeLookupInputPresent(postcode)) return;
        const generation = ++lookupGenerationRef.current;
        setLoading(true);
        setCandidates([]);
        setStatus("idle");
        setMessage("");

        if (!lookup) {
            applyIfCurrentGeneration(generation, () => {
                setStatus("info");
                setMessage(POSTCODE_LOOKUP_NOT_AVAILABLE_MESSAGE);
                setLoading(false);
            });
            return;
        }

        const requestedPostcode = normalizePostcodeForLookup(postcode);

        try {
            const result = await lookup(requestedPostcode);
            applyIfCurrentGeneration(generation, () => {
                if (result.kind === "ok") {
                    if (result.candidates.length === 0) {
                        setStatus("info");
                        setMessage(POSTCODE_LOOKUP_NOT_FOUND_MESSAGE);
                    } else {
                        setCandidates(result.candidates);
                        setStatus("info");
                        setMessage("Choose an address below. Nothing is filled in until you select one.");
                    }
                } else if (result.kind === "not_found") {
                    setStatus("info");
                    setMessage(POSTCODE_LOOKUP_NOT_FOUND_MESSAGE);
                } else {
                    setStatus("error");
                    setMessage(POSTCODE_LOOKUP_FAILED_MESSAGE);
                }
                setLoading(false);
            });
        } catch {
            applyIfCurrentGeneration(generation, () => {
                setStatus("error");
                setMessage(POSTCODE_LOOKUP_FAILED_MESSAGE);
                setLoading(false);
            });
        }
    };

    const pickCandidate = (candidate: PostcodeAddressCandidate) => {
        if (disabled) return;
        onSelect(candidate.label);
        setCandidates([]);
        setStatus("idle");
        setMessage("");
    };

    const statusCls =
        status === "error"
            ? "text-red-500"
            : isDark
              ? "text-slate-300"
              : "text-slate-600";

    return (
        <div className="space-y-2" data-postcode-address-picker={idPrefix}>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <MapPin className={`w-4 h-4 flex-shrink-0 ${isDark ? "text-slate-500" : "text-slate-400"}`} />
                    <input
                        id={`${idPrefix}-postcode`}
                        type="text"
                        autoComplete="off"
                        disabled={disabled}
                        value={postcode}
                        onChange={(e) => {
                            setPostcode(e.target.value);
                            invalidateInFlightLookup();
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                void runLookup();
                            }
                        }}
                        placeholder="Postcode first (e.g. CO3 8WD)"
                        className={`flex-1 min-w-0 ${inputCls}`}
                        maxLength={8}
                    />
                </div>
                <button
                    type="button"
                    id={`${idPrefix}-find`}
                    disabled={disabled || loading || !isPostcodeLookupInputPresent(postcode)}
                    onClick={() => void runLookup()}
                    className={`h-12 px-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${corePrimaryButton} hover:bg-[#e0f9e3] ${coreFocusVisibleRing}`}
                >
                    <Search className="w-3.5 h-3.5" />
                    {loading ? "Searching…" : "Find addresses"}
                </button>
            </div>
            {status !== "idle" && message && (
                <p id={`${idPrefix}-lookup-status`} role={status === "error" ? "alert" : "status"} className={`text-sm ${statusCls}`}>
                    {message}
                </p>
            )}
            {candidates.length > 0 && (
                <ul className="space-y-1.5" aria-label="Matching addresses">
                    {candidates.map((candidate) => (
                        <li key={candidate.id}>
                            <button
                                type="button"
                                id={`${idPrefix}-candidate-${candidate.id}`}
                                disabled={disabled}
                                onClick={() => pickCandidate(candidate)}
                                className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                                    isDark
                                        ? "border-slate-600 bg-slate-900/40 hover:bg-slate-800 text-slate-100"
                                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-900"
                                }`}
                            >
                                {candidate.label.split("\n").map((line, index) => (
                                    <span key={index} className="block break-words">
                                        {line}
                                    </span>
                                ))}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <p className={`text-sm ${muted}`}>
                Results appear only when address search is connected. You can always type below or use structured parts.
            </p>
        </div>
    );
}
