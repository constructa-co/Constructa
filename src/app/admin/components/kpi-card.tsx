import SparkLine from "./spark-line";

interface KpiCardProps {
    label: string;
    value: string;
    sublabel?: string;
    delta?: number | null;
    deltaLabel?: string;
    invertDelta?: boolean;
    sparkData?: number[];
    accent?: boolean;
    alert?: boolean;
    icon?: string;
    size?: "sm" | "md" | "lg";
}

function DeltaBadge({
    delta,
    deltaLabel,
    invertDelta,
}: {
    delta: number;
    deltaLabel?: string;
    invertDelta?: boolean;
}) {
    // Positive delta is good unless invertDelta (e.g. churn — down is good)
    const isGood = invertDelta ? delta <= 0 : delta >= 0;
    const arrow = delta >= 0 ? "↑" : "↓";
    const absVal = Math.abs(delta).toFixed(1);

    return (
        <span
            className={`inline-flex items-center gap-0.5 text-xs font-medium rounded px-1.5 py-0.5 ${
                isGood
                    ? "bg-emerald-900/50 text-emerald-400"
                    : "bg-red-900/50 text-red-400"
            }`}
        >
            <span>{arrow}</span>
            <span>{absVal}%</span>
            {deltaLabel && (
                <span className="text-zinc-500 font-normal ml-1">{deltaLabel}</span>
            )}
        </span>
    );
}

export default function KpiCard({
    label,
    value,
    sublabel,
    delta,
    deltaLabel,
    invertDelta = false,
    sparkData,
    accent = false,
    alert = false,
    icon,
    size = "md",
}: KpiCardProps) {
    // Border highlight
    const borderClass = alert
        ? "border-red-600"
        : accent
        ? "border-amber-500"
        : "border-zinc-800";

    // Padding / text sizing by size
    const sizeClasses = {
        sm: {
            card: "p-3",
            value: "text-xl font-bold",
            label: "text-xs",
            sublabel: "text-xs",
        },
        md: {
            card: "p-4",
            value: "text-2xl font-bold",
            label: "text-sm",
            sublabel: "text-xs",
        },
        lg: {
            card: "p-5",
            value: "text-4xl font-extrabold",
            label: "text-base",
            sublabel: "text-sm",
        },
    }[size];

    const sparkColor =
        alert ? "red" : accent ? "amber" : "amber";

    return (
        <div
            className={`bg-zinc-900 border rounded-lg flex flex-col gap-1 ${borderClass} ${sizeClasses.card}`}
        >
            {/* Header row: icon + label */}
            <div className="flex items-center gap-1.5">
                {icon && <span className="text-base leading-none">{icon}</span>}
                <span className={`text-zinc-400 leading-tight ${sizeClasses.label}`}>
                    {label}
                </span>
            </div>

            {/* Value */}
            <div
                className={`text-zinc-100 leading-tight ${sizeClasses.value} ${
                    alert ? "text-red-400" : accent ? "text-amber-400" : ""
                }`}
            >
                {value}
            </div>

            {/* Sublabel */}
            {sublabel && (
                <div className={`text-zinc-500 leading-tight ${sizeClasses.sublabel}`}>
                    {sublabel}
                </div>
            )}

            {/* Delta badge */}
            {delta != null && (
                <div className="mt-0.5">
                    <DeltaBadge
                        delta={delta}
                        deltaLabel={deltaLabel}
                        invertDelta={invertDelta}
                    />
                </div>
            )}

            {/* Sparkline */}
            {sparkData && sparkData.length > 0 && (
                <div className="mt-2">
                    <SparkLine data={sparkData} color={sparkColor} height={28} />
                </div>
            )}
        </div>
    );
}
