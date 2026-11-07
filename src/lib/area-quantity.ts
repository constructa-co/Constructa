import { MAX_LINE_QUANTITY } from "./simple-estimate";

export type AreaQuantityResult = { ok: true; quantity: string } | { ok: false; error: string };

export function areaQuantity(length: string, width: string): AreaQuantityResult {
    const dimensions = [length.trim(), width.trim()];
    if (dimensions.some(value => value.length > 64 || !/^\d+(\.\d+)?$/.test(value))) {
        return { ok: false, error: "Enter positive measurements as plain decimals, for example 2.5. Use at most 64 characters per measurement." };
    }
    const parts = dimensions.map(value => {
        const [whole, fraction = ""] = value.split(".");
        return { coefficient: BigInt(whole + fraction), scale: fraction.length };
    });
    if (parts.some(value => value.coefficient === BigInt(0))) {
        return { ok: false, error: "Length and width must both be above zero." };
    }

    // Integer coefficients preserve the exact product before checking precision.
    let coefficient = parts[0].coefficient * parts[1].coefficient;
    let scale = parts[0].scale + parts[1].scale;
    while (scale > 0 && coefficient % BigInt(10) === BigInt(0)) {
        coefficient /= BigInt(10);
        scale--;
    }
    if (coefficient > BigInt(MAX_LINE_QUANTITY) * BigInt(10) ** BigInt(scale)) {
        return { ok: false, error: "The area exceeds the existing maximum quantity of 1,000,000. Quantity has not changed." };
    }
    if (scale > 3) {
        return { ok: false, error: "The exact result needs more than three decimal places. Quantity has not changed; no rounding is applied." };
    }
    const digits = coefficient.toString().padStart(scale + 1, "0");
    return { ok: true, quantity: scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits };
}
