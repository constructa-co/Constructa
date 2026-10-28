import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DashboardRouteShell from "./dashboard-route-shell";

describe("DashboardRouteShell", () => {
    it("exposes route shell markers and aligns header above body", () => {
        const html = renderToStaticMarkup(
            createElement(DashboardRouteShell, {
                header: createElement("nav", { "aria-label": "Job context" }, "Pipeline / Job / Brief"),
                children: createElement("section", { "data-test": "body" }, "Content"),
            }),
        );
        expect(html).toMatch(/data-dashboard-route-shell=/);
        expect(html).toMatch(/data-route-header=/);
        expect(html).toMatch(/data-route-body=/);
        expect(html).toContain('aria-label="Job context"');
        expect(html).toContain('data-test="body"');
        expect(html).toContain("max-w-[1600px]");
    });

    it("renders body-only routes without a header slot", () => {
        const html = renderToStaticMarkup(
            createElement(DashboardRouteShell, null, createElement("p", null, "Only body")),
        );
        expect(html).toContain('data-route-body="true"');
        expect(html).not.toContain("data-route-header");
    });
});
