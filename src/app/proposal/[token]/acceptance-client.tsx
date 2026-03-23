"use client";

import { useState } from "react";
import { acceptProposalAction } from "./actions";

interface Props {
    projectId: string;
    token: string;
    clientName: string;
    companyName: string;
}

export default function AcceptanceClient({ projectId, token, clientName, companyName }: Props) {
    const [accepted, setAccepted] = useState(false);
    const [accepting, setAccepting] = useState(false);

    const handleAccept = async () => {
        setAccepting(true);
        const result = await acceptProposalAction(token, clientName);
        if (result?.success) {
            setAccepted(true);
        }
        setAccepting(false);
    };

    if (accepted) {
        return (
            <div className="bg-green-900/30 border border-green-800 rounded-xl p-5 text-center">
                <div className="text-green-400 text-lg font-bold mb-1">Proposal Accepted</div>
                <p className="text-sm text-slate-400 mt-2">
                    {companyName} will be in touch shortly.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-400 text-center">
                By clicking below, you accept the Scope of Works, Fee Proposal, and Terms & Conditions as set out in the proposal document.
            </p>
            <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full h-14 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg transition-all active:scale-[0.98]"
            >
                {accepting ? "Accepting..." : "Accept This Proposal"}
            </button>
        </div>
    );
}
