"use client";

import { useRef, useState, useCallback } from "react";
import { Video, Upload, Loader2, AlertTriangle, X, CheckCircle, Eye, ChevronDown, ChevronRight } from "lucide-react";
import { analyzeVideoAction, type VideoAnalysisResult } from "./actions";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_DURATION_SECS = 120;           // 2 minutes
const FRAME_COUNT = 20;                  // frames to extract and send
const ACCEPTED_VIDEO = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm", "video/mov"];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
    onApply: (result: VideoAnalysisResult) => void; // called when contractor clicks "Apply to Brief"
}

// ─── Frame extraction ─────────────────────────────────────────────────────────

async function extractFrames(
    file: File,
    onProgress: (current: number, total: number) => void
): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;

        const objectUrl = URL.createObjectURL(file);
        video.src = objectUrl;

        video.onloadedmetadata = async () => {
            const duration = video.duration;
            if (duration > MAX_DURATION_SECS) {
                URL.revokeObjectURL(objectUrl);
                reject(new Error(`Video is ${Math.round(duration)}s — please keep it under 2 minutes.`));
                return;
            }

            const frames: string[] = [];
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d")!;

            // Spread FRAME_COUNT evenly across the video, skip first/last 2%
            const interval = duration / (FRAME_COUNT + 1);

            for (let i = 1; i <= FRAME_COUNT; i++) {
                const seekTime = interval * i;
                await new Promise<void>((res) => {
                    video.currentTime = seekTime;
                    video.onseeked = () => {
                        canvas.width = Math.min(video.videoWidth, 640);
                        canvas.height = Math.round(canvas.width * (video.videoHeight / video.videoWidth));
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        frames.push(canvas.toDataURL("image/jpeg", 0.70));
                        onProgress(i, FRAME_COUNT);
                        res();
                    };
                });
            }

            URL.revokeObjectURL(objectUrl);
            resolve(frames);
        };

        video.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Could not read video file. Please try MP4 format."));
        };
    });
}

// ─── Component ────────────────────────────────────────────────────────────────

type State = "idle" | "extracting" | "analysing" | "done" | "error";

export default function VideoWalkthrough({ onApply }: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [state, setState] = useState<State>("idle");
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<VideoAnalysisResult | null>(null);
    const [showObservations, setShowObservations] = useState(false);
    const [applied, setApplied] = useState(false);

    async function processVideo(file: File) {
        setError(null);
        setResult(null);
        setApplied(false);

        // Validate type
        if (!ACCEPTED_VIDEO.includes(file.type) && !file.name.toLowerCase().match(/\.(mp4|mov|avi|webm|m4v)$/)) {
            setError("Unsupported format. Please upload an MP4, MOV, or WebM video.");
            return;
        }

        // Validate size
        if (file.size > MAX_SIZE_BYTES) {
            setError(`File is ${(file.size / 1024 / 1024).toFixed(0)}MB — please keep videos under 50MB.`);
            return;
        }

        try {
            // Step 1: Extract frames
            setState("extracting");
            setProgress({ current: 0, total: FRAME_COUNT });

            const frames = await extractFrames(file, (current, total) => {
                setProgress({ current, total });
            });

            // Step 2: Send to AI
            setState("analysing");
            setProgress(null);

            const response = await analyzeVideoAction(frames);

            if (!response) {
                setError("Server did not respond. Please try again.");
                setState("error");
                return;
            }

            if (response.success && response.result) {
                setResult(response.result);
                setState("done");
            } else {
                setError(response.error || "Analysis failed. Please try again.");
                setState("error");
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred.");
            setState("error");
        }
    }

    function handleFileSelect(files: FileList | null) {
        if (!files || files.length === 0) return;
        processVideo(files[0]);
    }

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    }, []);

    function handleApply() {
        if (!result) return;
        onApply(result);
        setApplied(true);
    }

    function handleReset() {
        setState("idle");
        setResult(null);
        setError(null);
        setApplied(false);
        setProgress(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    const isProcessing = state === "extracting" || state === "analysing";

    return (
        <div className="bg-slate-800/50 border border-purple-500/20 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-700/50">
                <Video className="w-4 h-4 text-purple-400" />
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Video Site Survey</h2>
                <span className="ml-auto text-xs text-slate-500">Upload a walkthrough — AI extracts scope & trades</span>
            </div>

            <div className="p-5">
                {/* Idle — upload zone */}
                {state === "idle" && (
                    <div
                        onDrop={handleDrop}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                            isDragging
                                ? "border-purple-500 bg-purple-500/10"
                                : "border-slate-600 hover:border-slate-500 bg-slate-800/40 hover:bg-slate-800/60"
                        }`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,.mp4,.mov,.webm,.avi,.m4v"
                            className="hidden"
                            onChange={(e) => handleFileSelect(e.target.files)}
                        />
                        <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                        <p className="text-slate-200 font-medium text-sm mb-1">
                            {isDragging ? "Drop your video here" : "Upload a site walkthrough video"}
                        </p>
                        <p className="text-slate-500 text-xs">MP4, MOV, WebM · Max 50MB · Max 2 minutes</p>
                    </div>
                )}

                {/* Processing */}
                {isProcessing && (
                    <div className="py-6 text-center">
                        <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
                        <p className="text-white font-medium text-sm mb-1">
                            {state === "extracting" ? "Extracting video frames…" : "AI is analysing your site survey…"}
                        </p>
                        {progress && state === "extracting" && (
                            <p className="text-slate-500 text-xs">
                                Frame {progress.current} of {progress.total}
                            </p>
                        )}
                        {state === "analysing" && (
                            <p className="text-slate-500 text-xs">Reading rooms, conditions, trade sections…</p>
                        )}
                    </div>
                )}

                {/* Error */}
                {(state === "error" || error) && (
                    <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4 flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-red-300 text-sm">{error}</p>
                        </div>
                        <button onClick={handleReset} className="text-red-500 hover:text-red-400">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Results */}
                {state === "done" && result && (
                    <div className="space-y-4">
                        {/* Scope preview */}
                        <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Scope extracted</p>
                            <p className="text-slate-200 text-sm leading-relaxed">{result.scope}</p>
                        </div>

                        {/* Trades */}
                        {result.suggestedTrades.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Trade sections identified</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {result.suggestedTrades.map((t) => (
                                        <span key={t} className="px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs rounded-full">
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Estimated value */}
                        {result.estimatedValue > 0 && (
                            <p className="text-xs text-slate-500">
                                Estimated value: <span className="text-slate-300 font-medium">£{result.estimatedValue.toLocaleString()}</span>
                            </p>
                        )}

                        {/* Site observations (collapsible) */}
                        {result.observations.length > 0 && (
                            <div className="bg-slate-900/40 border border-slate-700/40 rounded-lg overflow-hidden">
                                <button
                                    onClick={() => setShowObservations(!showObservations)}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-700/20 transition-colors"
                                >
                                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex-1">
                                        Site Observations ({result.observations.length})
                                    </span>
                                    {showObservations
                                        ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                                        : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                                    }
                                </button>
                                {showObservations && (
                                    <ul className="px-4 pb-3 space-y-1.5">
                                        {result.observations.map((obs, i) => (
                                            <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                                                <span className="text-slate-600 mt-0.5">•</span>
                                                {obs}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-1">
                            <button
                                onClick={handleReset}
                                className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
                            >
                                Upload another video
                            </button>
                            {applied ? (
                                <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium">
                                    <CheckCircle className="w-4 h-4" />
                                    Applied to Brief
                                </span>
                            ) : (
                                <button
                                    onClick={handleApply}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    Apply to Brief
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
