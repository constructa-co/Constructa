import { afterEach, describe, expect, it, vi } from "vitest";
import { BEFORE_PROJECT_NAVIGATION, requestProjectNavigation } from "./project-navigation";

afterEach(() => vi.unstubAllGlobals());

describe("project picker navigation handoff", () => {
    it("preserves normal navigation when no active editor objects", () => {
        vi.stubGlobal("window", new EventTarget());
        expect(requestProjectNavigation()).toBe(true);
    });

    it("lets the editor cancel before any picker state or route change", () => {
        const target = new EventTarget();
        const listener = vi.fn((event: Event) => event.preventDefault());
        target.addEventListener(BEFORE_PROJECT_NAVIGATION, listener);
        vi.stubGlobal("window", target);
        expect(requestProjectNavigation()).toBe(false);
        expect(listener).toHaveBeenCalledOnce();
        target.removeEventListener(BEFORE_PROJECT_NAVIGATION, listener);
        expect(requestProjectNavigation()).toBe(true);
    });
});
