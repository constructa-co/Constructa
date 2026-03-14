"use client";

import { useState } from "react";
import { createValuationAction } from "./actions"; // Import Server Action

// Inline UI Components for Client Component (or import from shared)
function Button({ children, className }: { children: React.ReactNode; className?: string }) {
    return <button className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 ${className}`}>{children}</button>;
}
function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-slate-200 text-slate-900 bg-white ${props.className}`}
        />
    );
}

interface Props {
    projectId: string;
    estimates: any[];
    retentionRate: number;
    previousProgress: Record<string, number>;
}

export default function ValuationForm({ projectId, estimates, retentionRate, previousProgress }: Props) {
    // Initialize state with PREVIOUS VALUES
    const [inputs, setInputs] = useState<Record<string, { mode: 'percent' | 'value', val: number }>>(() => {
        const defaults: any = {};
        estimates.forEach(est => {
            // Default to the previous percentage if it exists
            defaults[est.id] = {
                mode: 'percent',
                val: previousProgress[est.id] || 0
            };
        });
        return defaults;
    });

    const handleInputChange = (id: string, field: 'mode' | 'val', value: any) => {
        setInputs(prev => ({
            ...prev,
            [id]: {
                mode: field === 'mode' ? value : (prev[id]?.mode || 'percent'),
                val: field === 'val' ? parseFloat(value) || 0 : (prev[id]?.val || 0)
            }
        }));
    };

    // Calculate totals for preview
    const totalGross = estimates.reduce((sum, est) => {
        const markup = 1 + ((est.profit_pct || 0) + (est.overhead_pct || 0) + (est.risk_pct || 0)) / 100;
        const totalVal = est.total_cost * markup;

        const input = inputs[est.id] || { mode: 'percent', val: 0 };
        let claim = 0;

        if (input.mode === 'percent') {
            claim = totalVal * (input.val / 100);
        } else {
            claim = input.val;
        }
        return sum + claim;
    }, 0);

    // Calculate Previous Gross (for context)
    const previousGross = estimates.reduce((sum, est) => {
        const markup = 1 + ((est.profit_pct || 0) + (est.overhead_pct || 0) + (est.risk_pct || 0)) / 100;
        const totalVal = est.total_cost * markup;
        const prevPerc = previousProgress[est.id] || 0;
        return sum + (totalVal * (prevPerc / 100));
    }, 0);

    const retentionAmount = totalGross * (retentionRate / 100);

    // Previous Net (Approximate for display)
    const prevRetention = previousGross * (retentionRate / 100);
    const prevNet = previousGross - prevRetention;
    const currentNet = totalGross - retentionAmount;

    const netDue = currentNet - prevNet;

    return (
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm bg-white overflow-hidden border-blue-200">
            <div className="flex flex-col space-y-1.5 p-6 bg-blue-50 border-b border-blue-100 flex-row justify-between items-center">
                <h3 className="font-semibold leading-none tracking-tight text-lg">New Application for Payment</h3>
                <div className="text-right">
                    <div className="text-xs text-slate-500 uppercase font-bold">Net Claim Preview</div>
                    <div className="text-xl font-bold text-blue-800">£{netDue.toFixed(2)}</div>
                </div>
            </div>
            <div className="p-6 pt-6">
                <form action={createValuationAction}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="retentionRate" value={retentionRate} />

                    <table className="w-full text-sm mb-6">
                        <thead>
                            <tr className="text-left text-xs uppercase text-slate-500 border-b">
                                <th className="pb-2 pl-2 text-slate-600">Activity</th>
                                <th className="pb-2 text-right text-slate-600">Contract Value</th>
                                <th className="pb-2 text-center w-32 text-slate-600">Mode</th>
                                <th className="pb-2 text-right w-32 text-slate-600">Input</th>
                                <th className="pb-2 text-right w-32 pr-2 text-slate-600">Claim Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {estimates.map(est => {
                                const markup = 1 + ((est.profit_pct || 0) + (est.overhead_pct || 0) + (est.risk_pct || 0)) / 100;
                                const totalVal = est.total_cost * markup;
                                const input = inputs[est.id] || { mode: 'percent', val: 0 };
                                const prev = previousProgress[est.id] || 0;

                                let displayClaim = input.mode === 'percent' ? totalVal * (input.val / 100) : input.val;

                                return (
                                    <tr key={est.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-3 pl-2">
                                            <div className="font-medium text-slate-900">{est.version_name}</div>
                                            {/* VISUAL INDICATOR OF PREVIOUS PROGRESS */}
                                            {prev > 0 && <div className="text-[10px] text-slate-500">Previously Applied: {prev}%</div>}
                                        </td>
                                        <td className="py-3 text-right text-slate-500">£{totalVal.toFixed(2)}</td>
                                        <td className="py-3 text-center">
                                            {/* MODE TOGGLE */}
                                            <select
                                                name={`mode_${est.id}`}
                                                className="border rounded text-xs p-1 bg-white text-slate-900 border-slate-200 h-8"
                                                onChange={(e) => handleInputChange(est.id, 'mode', e.target.value)}
                                            >
                                                <option value="percent">% Complete</option>
                                                <option value="value">£ Fixed</option>
                                            </select>
                                        </td>
                                        <td className="py-3 text-right">
                                            <input type="hidden" name={`total_${est.id}`} value={totalVal} />
                                            <Input
                                                name={`input_${est.id}`}
                                                type="number"
                                                step="0.01"
                                                value={input.val} // Controlled value
                                                placeholder="0"
                                                className="text-right h-8"
                                                onChange={(e) => handleInputChange(est.id, 'val', e.target.value)}
                                            />
                                        </td>
                                        <td className="py-3 text-right font-bold pr-2 text-blue-900">
                                            £{displayClaim.toFixed(2)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div className="flex justify-end border-t border-slate-100 pt-4">
                        <Button className="bg-blue-700 hover:bg-blue-800 text-white w-48 font-bold">Generate Application</Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
