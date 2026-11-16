import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import UkDateInput from "./uk-date-input";

describe("CON-035 UK date presentation", () => {
    it("renders a written UK preview and en-GB lang on the date input", () => {
        const markup = renderToStaticMarkup(
            createElement(UkDateInput, {
                id: "brief-start-date",
                value: "2026-11-06",
                className: "input",
                mutedClassName: "text-muted",
            }),
        );
        expect(markup).toContain('lang="en-GB"');
        expect(markup).toContain("6 Nov 2026");
        expect(markup).toContain('value="2026-11-06"');
        expect(markup).toContain("brief-start-date-uk-date-help");
    });

    it("shows the written preview for an uncontrolled field from defaultValue", () => {
        const markup = renderToStaticMarkup(
            createElement(UkDateInput, {
                id: "settings-start-date",
                name: "start_date",
                defaultValue: "2026-12-01",
            }),
        );
        expect(markup).toContain('value="2026-12-01"');
        expect(markup).toContain("1 Dec 2026");
        expect(markup).toContain("data-uk-date-preview");
    });
});