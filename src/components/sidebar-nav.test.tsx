import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectPickerControls } from "./sidebar-nav";

function markup(selected: boolean, open = false) {
    return renderToStaticMarkup(<ProjectPickerControls selected={selected} name={selected ? "Example job" : null} open={open} onToggle={() => {}} onClear={() => {}} />);
}

describe("desktop project picker controls", () => {
    it("renders separate labelled native buttons, never a nested control", () => {
        const html = markup(true);
        let depth = 0;
        let count = 0;
        for (const [tag] of html.matchAll(/<\/?button\b[^>]*>/g)) {
            if (tag.startsWith("</")) depth--;
            else { depth++; count++; }
            expect(depth).toBeLessThanOrEqual(1);
        }
        expect(depth).toBe(0);
        expect(count).toBe(2);
        expect(html).toContain('type="button" aria-label="Deselect project"');
        expect(html).toContain("Example job");
        expect(html).toContain("w-11 min-h-11");
    });

    it("offers only the picker when nothing is selected and exposes expansion state", () => {
        const html = markup(false, true);
        expect(html.match(/<button\b/g)).toHaveLength(1);
        expect(html).toContain("Select a project\u2026");
        expect(html).toContain('aria-expanded="true"');
        expect(html).not.toContain('aria-label="Deselect project"');
        expect(markup(true)).toContain('aria-expanded="false"');
    });
});
