"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, X, ChevronRight, Loader2, CheckCircle } from "lucide-react";
import { generateFullProposalAction, ProposalAnswers } from "./actions";
import { toast } from "sonner";

interface AiWizardProps {
    projectId: string;
    project: any;
    onComplete: (data: {
        introduction: string;
        scope_narrative: string;
        exclusions: string;
        clarifications: string;
        gantt_phases: any[];
        payment_stages: any[];
    }) => void;
    onClose: () => void;
}

type WizardStep = 0 | 1 | 2 | 3 | 4 | 5;

interface Message {
    role: "assistant" | "user";
    text: string;
}

const LOADING_MSGS = [
    "Writing your scope...",
    "Building timeline...",
    "Setting payment stages...",
    "Crafting introduction...",
];

export default function AiWizard({ projectId, project, onComplete, onClose }: AiWizardProps) {
    const [step, setStep] = useState<WizardStep>(0);
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            text: "What's the job? Describe the works in one or two sentences.",
        },
    ]);

    const [answers, setAnswers] = useState<ProposalAnswers>({
        description: "",
        client: project?.client_name || "",
        siteAddress: project?.site_address || project?.client_address || "",
        value: project?.potential_value ? String(project.potential_value) : "",
        startDate: project?.start_date || "",
        duration: "",
        extras: "",
    });

    const [inputValue, setInputValue] = useState("");
    const [durationNumber, setDurationNumber] = useState("");
    const [durationUnit, setDurationUnit] = useState<"weeks" | "months">("weeks");
    const [generating, setGenerating] = useState(false);
    const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
    const [done, setDone] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        return () => {
            if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
        };
    }, []);

    const QUESTIONS: { field: keyof ProposalAnswers; question: string }[] = [
        { field: "description", question: "What's the job? Describe the works in one or two sentences." },
        { field: "client", question: `Who is the client and what's the site address? (Pre-filled from project if available)` },
        { field: "value", question: "What's the estimated contract value? (£)" },
        { field: "startDate", question: "When do you want to start? (Enter a date)" },
        { field: "duration", question: "How long will the project take?" },
        { field: "extras", question: "Anything specific to highlight or exclude? (Optional — press Enter to skip)" },
    ];

    function getDisplayValue(): string {
        switch (step) {
            case 0: return answers.description || inputValue;
            case 1: return `${answers.client || inputValue}${answers.siteAddress ? ` — ${answers.siteAddress}` : ""}`;
            case 2: return answers.value ? `£${answers.value}` : inputValue;
            case 3: return answers.startDate || inputValue;
            case 4: return answers.duration || `${durationNumber} ${durationUnit}`;
            case 5: return answers.extras || inputValue || "(none)";
            default: return "";
        }
    }

    function advanceStep(userText: string, updatedAnswers: ProposalAnswers) {
        const newMessages: Message[] = [
            ...messages,
            { role: "user", text: userText },
        ];

        const nextStep = (step + 1) as WizardStep;

        if (nextStep <= 5) {
            const nextQ = QUESTIONS[nextStep];
            let questionText = nextQ.question;

            // Pre-fill hints
            if (nextStep === 1) {
                const client = project?.client_name || "";
                const site = project?.site_address || project?.client_address || "";
                if (client || site) {
                    questionText = `Who is the client and what's the site address?`;
                }
            }
            if (nextStep === 2 && project?.potential_value) {
                questionText = `What's the estimated contract value? (Pre-filled: £${project.potential_value})`;
            }

            newMessages.push({ role: "assistant", text: questionText });
        }

        setMessages(newMessages);
        setStep(nextStep);
        setInputValue("");
        setDurationNumber("");
    }

    function handleAnswer() {
        let userText = "";
        const updated = { ...answers };

        switch (step) {
            case 0:
                updated.description = inputValue;
                userText = inputValue;
                break;
            case 1:
                updated.client = inputValue.split("—")[0]?.trim() || answers.client;
                updated.siteAddress = inputValue.split("—")[1]?.trim() || answers.siteAddress;
                userText = inputValue || `${answers.client} — ${answers.siteAddress}`;
                break;
            case 2:
                updated.value = inputValue || answers.value;
                userText = inputValue ? `£${inputValue}` : (answers.value ? `£${answers.value}` : "TBC");
                break;
            case 3:
                updated.startDate = inputValue || answers.startDate;
                userText = inputValue || answers.startDate || "TBC";
                break;
            case 4:
                updated.duration = `${durationNumber} ${durationUnit}`;
                userText = `${durationNumber} ${durationUnit}`;
                break;
            case 5:
                updated.extras = inputValue;
                userText = inputValue || "(none)";
                break;
        }

        setAnswers(updated);
        advanceStep(userText, updated);
    }

    async function handleGenerate() {
        setGenerating(true);
        loadingIntervalRef.current = setInterval(() => {
            setLoadingMsgIdx(idx => (idx + 1) % LOADING_MSGS.length);
        }, 1200);

        try {
            const result = await generateFullProposalAction(answers, projectId);
            if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);

            if (!result.success) {
                toast.error("AI generation failed: " + result.error);
                setGenerating(false);
                return;
            }

            setDone(true);
            // Call onComplete immediately — no setTimeout which can lose state
            onComplete({
                introduction: result.data.introduction,
                scope_narrative: result.data.scope_narrative,
                exclusions: result.data.exclusions,
                clarifications: result.data.clarifications,
                gantt_phases: result.data.gantt_phases as any[],
                payment_stages: result.data.payment_stages as any[],
            });
            toast.success("Proposal pre-filled ✓");
        } catch (e: any) {
            if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
            toast.error("Error: " + e.message);
            setGenerating(false);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey && step < 5 && step !== 4) {
            e.preventDefault();
            if (step === 0 && !inputValue.trim()) return;
            handleAnswer();
        }
        if (e.key === "Enter" && !e.shiftKey && step === 5) {
            e.preventDefault();
            handleAnswer();
        }
    }

    const isLastStep = step === 5;
    const afterLastStep = (step as number) > 5;

    // Determine current input type for step
    function renderInput() {
        if (afterLastStep) {
            return (
                <Button
                    onClick={handleGenerate}
                    disabled={generating || done}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-8 gap-2 w-full"
                >
                    {done ? (
                        <>
                            <CheckCircle className="w-4 h-4" />
                            Done!
                        </>
                    ) : generating ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {LOADING_MSGS[loadingMsgIdx]}
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-4 h-4" />
                            Generate Proposal →
                        </>
                    )}
                </Button>
            );
        }

        if (step === 4) {
            return (
                <div className="flex gap-2">
                    <input
                        type="number"
                        min={1}
                        value={durationNumber}
                        onChange={e => setDurationNumber(e.target.value)}
                        placeholder="6"
                        className="w-24 h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <select
                        value={durationUnit}
                        onChange={e => setDurationUnit(e.target.value as "weeks" | "months")}
                        className="flex-1 h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                        <option value="weeks">weeks</option>
                        <option value="months">months</option>
                    </select>
                    <Button
                        onClick={handleAnswer}
                        disabled={!durationNumber}
                        className="bg-blue-600 hover:bg-blue-700 text-white h-11 px-4"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            );
        }

        if (step === 5) {
            return (
                <div className="flex gap-2">
                    <Textarea
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Any specific items to highlight or exclude... (optional)"
                        rows={2}
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                    />
                    <Button
                        onClick={handleAnswer}
                        className="bg-blue-600 hover:bg-blue-700 text-white h-11 px-4 self-end"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            );
        }

        // Default: single line input with pre-fills
        const defaultVals: Record<number, string> = {
            1: answers.client && answers.siteAddress ? `${answers.client} — ${answers.siteAddress}` : answers.client || answers.siteAddress || "",
            2: answers.value || "",
            3: answers.startDate || "",
        };

        return (
            <div className="flex gap-2">
                <input
                    type={step === 2 ? "number" : step === 3 ? "date" : "text"}
                    value={inputValue || ""}
                    defaultValue={defaultVals[step] || ""}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                        step === 0 ? "e.g. Single storey rear extension, brick and block construction..." :
                        step === 1 ? `${answers.client || "Mr Smith"} — ${answers.siteAddress || "12 High Street, London"}` :
                        step === 2 ? answers.value || "e.g. 45000" :
                        step === 3 ? answers.startDate || "YYYY-MM-DD" :
                        ""
                    }
                    className="flex-1 h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    autoFocus
                />
                <Button
                    onClick={handleAnswer}
                    disabled={step === 0 && !inputValue.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white h-11 px-4"
                >
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600/20 rounded-lg">
                            <Sparkles className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-100">AI Proposal Wizard</h2>
                            <p className="text-xs text-slate-500">Answer a few questions to pre-fill your proposal</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Progress bar */}
                <div className="h-1 bg-slate-800">
                    <div
                        className="h-full bg-blue-600 transition-all duration-500"
                        style={{ width: `${Math.min(100, (((step as number)) / 6) * 100)}%` }}
                    />
                </div>

                {/* Chat messages */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-[200px]">
                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            {msg.role === "assistant" && (
                                <div className="w-7 h-7 rounded-full bg-blue-600/20 flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                                </div>
                            )}
                            <div
                                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                                    msg.role === "assistant"
                                        ? "bg-slate-800 text-slate-200 rounded-tl-sm"
                                        : "bg-blue-600 text-white rounded-tr-sm"
                                }`}
                            >
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {generating && (
                        <div className="flex justify-start">
                            <div className="w-7 h-7 rounded-full bg-blue-600/20 flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                            </div>
                            <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-slate-200 flex items-center gap-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                                {LOADING_MSGS[loadingMsgIdx]}
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                {!generating && (
                    <div className="px-6 pb-5 pt-3 border-t border-slate-800">
                        {renderInput()}
                        {(step === 1 || step === 2 || step === 3) && (
                            <p className="text-xs text-slate-500 mt-2">
                                {step === 1 && (answers.client || answers.siteAddress) && `Pre-filled: ${answers.client}${answers.siteAddress ? ` — ${answers.siteAddress}` : ""}`}
                                {step === 2 && answers.value && `Pre-filled: £${answers.value} (from project)`}
                                {step === 3 && answers.startDate && `Pre-filled: ${answers.startDate} (from project)`}
                                {" "}Press Enter or click → to confirm.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
