import { afterEach, describe, expect, it, vi } from "vitest";
import { captureSharedWordmark } from "./shared-wordmark";

afterEach(() => vi.unstubAllGlobals());

describe("shared PDF wordmark", () => {
    it("uses the mounted brand's font, weight and spacing without loading or embedding a font", () => {
        const context = {
            font: "", letterSpacing: "", fillStyle: "",
            scale: vi.fn(), fillText: vi.fn(),
            measureText: vi.fn(() => ({ width: 87, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 87, actualBoundingBoxAscent: 15, actualBoundingBoxDescent: 4 })),
        };
        const canvas = { width: 0, height: 0, getContext: vi.fn(() => context), toDataURL: vi.fn(() => "data:image/png;base64,c3ludGhldGlj") };
        const style = { fontStyle: "normal", fontWeight: "650", fontSize: "18px", fontFamily: '"Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif', letterSpacing: "-0.9px" };
        vi.stubGlobal("getComputedStyle", vi.fn(() => style));
        vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });
        const element = { textContent: "constructa" } as HTMLElement;

        expect(captureSharedWordmark(element, [15, 23, 42])).toEqual({ dataUrl: "data:image/png;base64,c3ludGhldGlj", aspectRatio: 91 / 23 });
        expect(getComputedStyle).toHaveBeenCalledWith(element);
        expect(document.createElement).toHaveBeenCalledWith("canvas");
        expect(context.font).toBe(`normal 650 18px ${style.fontFamily}`);
        expect(context.letterSpacing).toBe("-0.9px");
        expect(context.fillStyle).toBe("rgb(15,23,42)");
        expect(context.fillText).toHaveBeenCalledWith("constructa", 2, 17);
        expect(context.scale).toHaveBeenCalledWith(3, 3);
        expect([canvas.width, canvas.height]).toEqual([273, 69]);
        expect(canvas.toDataURL).toHaveBeenCalledWith("image/png");
    });

    it("refuses an unavailable wordmark instead of inventing a second identity", () => {
        expect(() => captureSharedWordmark(null, [15, 23, 42])).toThrow("Shared wordmark is unavailable");
    });
});
