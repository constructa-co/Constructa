import type { DataPoint } from "@/app/admin/types";

export function sumSignupPoints(points: DataPoint[]): number {
    return points.reduce((sum, point) => sum + point.value, 0);
}

/** Plausible visitors are a rolling 30d count — signups must use the same window. */
export function signupConversionRatePct(signupsLast30d: number, visitors30d: number): number {
    if (visitors30d <= 0) return 0;
    return (signupsLast30d / visitors30d) * 100;
}