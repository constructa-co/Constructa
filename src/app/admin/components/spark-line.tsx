const COLOR_MAP: Record<string, string> = {
    amber: "bg-amber-500",
    emerald: "bg-emerald-500",
    red: "bg-red-500",
    blue: "bg-blue-500",
};

interface SparkLineProps {
    data: number[];
    color?: "amber" | "emerald" | "red" | "blue";
    height?: number;
}

export default function SparkLine({
    data,
    color = "amber",
    height = 32,
}: SparkLineProps) {
    if (!data || data.length === 0) return null;

    const max = Math.max(...data, 1);
    const barClass = COLOR_MAP[color] ?? COLOR_MAP.amber;

    return (
        <div
            className="flex items-end gap-px w-full"
            style={{ height }}
            aria-hidden="true"
        >
            {data.map((v, i) => {
                const pct = Math.max(v / max, 0);
                const barH = Math.max(Math.round(pct * height), 2);
                return (
                    <div
                        key={i}
                        className={`flex-1 rounded-t-[1px] ${barClass} opacity-80`}
                        style={{ height: barH }}
                    />
                );
            })}
        </div>
    );
}
