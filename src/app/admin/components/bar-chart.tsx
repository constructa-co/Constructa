"use client";

interface BarChartProps {
    data: { label: string; value: number; sublabel?: string }[];
    height?: number;
    color?: string;
    showValues?: boolean;
    formatValue?: (v: number) => string;
    className?: string;
}

export default function BarChart({
    data,
    height = 120,
    color = "bg-amber-500",
    showValues,
    formatValue,
    className = "",
}: BarChartProps) {
    const allZero = data.every((d) => d.value === 0);
    const max = Math.max(...data.map((d) => d.value), 1);
    const rotateLabels = data.length > 8;
    const defaultShowValues = showValues ?? data.length <= 6;
    const fmt = formatValue ?? ((v: number) => String(v));

    if (allZero) {
        return (
            <div
                className={`flex items-center justify-center text-zinc-500 text-sm ${className}`}
                style={{ height: height + (rotateLabels ? 64 : 32) }}
            >
                No data yet
            </div>
        );
    }

    return (
        <div className={`w-full ${className}`}>
            {/* Bar area */}
            <div
                className="flex items-end gap-px w-full"
                style={{ height }}
            >
                {data.map((d, i) => {
                    const pct = Math.max(d.value / max, 0);
                    const barHeightPx = Math.max(Math.round(pct * height), 2);
                    const tooltipText = `${d.label}${d.sublabel ? ` (${d.sublabel})` : ""}: ${fmt(d.value)}`;

                    return (
                        <div
                            key={i}
                            className="group relative flex flex-col items-center flex-1 min-w-0"
                            style={{ height }}
                        >
                            {/* Value label above bar */}
                            {defaultShowValues && (
                                <span
                                    className="text-[10px] text-zinc-400 mb-0.5 leading-none"
                                    style={{
                                        marginBottom: 2,
                                        visibility: d.value === 0 ? "hidden" : "visible",
                                    }}
                                >
                                    {fmt(d.value)}
                                </span>
                            )}

                            {/* Spacer to push bar to bottom */}
                            <div className="flex-1" />

                            {/* The bar itself */}
                            <div
                                className={`w-full rounded-t-sm ${color} transition-opacity group-hover:opacity-80 cursor-default`}
                                style={{ height: barHeightPx }}
                            />

                            {/* Tooltip */}
                            <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 hidden group-hover:block">
                                <div className="bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                                    {tooltipText}
                                </div>
                                {/* Arrow */}
                                <div className="w-2 h-2 bg-zinc-900 border-r border-b border-zinc-700 rotate-45 mx-auto -mt-1" />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Label row */}
            <div className="flex gap-px w-full mt-1">
                {data.map((d, i) => (
                    <div
                        key={i}
                        className={`flex-1 min-w-0 flex ${rotateLabels ? "justify-end" : "justify-center"}`}
                        style={rotateLabels ? { height: 56 } : undefined}
                    >
                        <span
                            className="text-[10px] text-zinc-500 truncate block"
                            style={
                                rotateLabels
                                    ? {
                                          transformOrigin: "top right",
                                          transform: "rotate(-45deg)",
                                          whiteSpace: "nowrap",
                                          display: "inline-block",
                                          maxWidth: 80,
                                      }
                                    : undefined
                            }
                        >
                            {d.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
