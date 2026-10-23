import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./actions", () => ({ updateProjectAction: vi.fn() }));

import ClientProjectSettings from "./client-page";

function typeInput(projectType: string | null) {
    const html = renderToStaticMarkup(<ClientProjectSettings project={{ id: "project-b", name: "Example renovation", project_type: projectType }} />);
    return html.match(/<input id="project_type"[^>]*>/)?.[0] || "";
}

describe("settings saved project type", () => {
    it.each(["Repairs\nMaintenance", "Repairs\rMaintenance", "Repairs\r\nMaintenance"])("retains the existing select path for multi-line stored wording %j", projectType => {
        const html = renderToStaticMarkup(<ClientProjectSettings project={{ id: "project-b", project_type: projectType }} />);
        expect(html).not.toMatch(/<input id="project_type"/);
        const select = html.match(/<select id="project_type"[\s\S]*?<\/select>/)![0];
        expect(select).toContain(`<option value="${projectType}" selected="">${projectType}</option>`);
        expect(select.match(/<option\b/g)).toHaveLength(9);
        expect(html).toContain("This saved multi-line type is retained.");
    });

    it.each(["  Specialist repairs  ", "   ", "Old type & maintenance"])("keeps single-line legacy wording %j without normalising it", projectType => {
        expect(typeInput(projectType)).toContain(`value="${projectType.replace(/&/g, "&amp;")}"`);
    });

    it("offers and selects the exact stored type when absent from the standard list", () => {
        const input = typeInput("Domestic Renovation");
        expect(input).toContain('value="Domestic Renovation"');
        expect(input).toContain('list="settings-job-type-examples"');
        expect(input).not.toContain("readOnly");
    });

    it("does not duplicate a standard type or change its selection", () => {
        const input = typeInput("Other");
        expect(input).toContain('value="Other"');
        const html = renderToStaticMarkup(<ClientProjectSettings project={{ id: "project-b", project_type: "Other" }} />);
        const examples = html.match(/<datalist id="settings-job-type-examples">[\s\S]*?<\/datalist>/)![0];
        expect(examples.match(/<option\b/g)).toHaveLength(8);
        expect(examples.match(/value="Other"/g)).toHaveLength(1);
    });

    it("retains the existing Extension fallback when no type is stored", () => {
        expect(typeInput(null)).toContain('value="Extension"');
    });
});

describe("settings saved project status", () => {
    function statusSelect(status: string | null) {
        const html = renderToStaticMarkup(<ClientProjectSettings project={{ id: "project-b", name: "Example renovation", status }} />);
        return html.match(/<select id="status"[\s\S]*?<\/select>/)?.[0] || "";
    }

    it.each(["Lead", "Estimating"])("retains the exact existing %s status instead of Draft", status => {
        const select = statusSelect(status);
        expect(select).toContain(`<option value="${status}" selected="">${status}</option>`);
        expect(select.match(/<option\b/g)).toHaveLength(6);
    });

    it("does not duplicate a standard status or change its label", () => {
        const select = statusSelect("Won");
        expect(select.match(/<option\b/g)).toHaveLength(5);
        expect(select).toContain('<option value="Won" selected="">Won / Active</option>');
    });

    it("retains the existing Draft fallback only when no status is stored", () => {
        const select = statusSelect(null);
        expect(select.match(/<option\b/g)).toHaveLength(5);
        expect(select).toContain('<option value="Draft" selected="">Draft</option>');
    });
});

describe("settings control sizing", () => {
    const markup = () => renderToStaticMarkup(<ClientProjectSettings project={{ id: "project-b", name: "Example renovation" }} />);

    it("uses readable text and existing large targets for all text and selection controls", () => {
        const controls = markup().match(/<(?:input|select|textarea)\b[^>]*>/g)!.filter(control => !/type="(?:hidden|checkbox)"/.test(control));
        expect(controls).toHaveLength(12);
        for (const control of controls) {
            expect(control).toContain("text-base");
            expect(control).not.toContain("text-sm");
            expect(control).toContain(control.startsWith("<textarea") ? "min-h-[80px]" : "h-12");
        }
    });

    it("keeps the save action a large native submit button", () => {
        const button = markup().match(/<button\b[^>]*type="submit"[^>]*>/)?.[0];
        expect(button).toContain("min-h-12");
        expect(button).toContain("text-base");
    });
});

describe("settings scope and tablet layout", () => {
    const markup = () => renderToStaticMarkup(<ClientProjectSettings project={{ id: "project-b", name: "Example renovation", project_type: "Domestic Renovation" }} />);

    it("names the scope editor using its existing visible heading", () => {
        const html = markup();
        const scope = html.match(/<textarea\b[^>]*name="scope"[^>]*>/)?.[0] || "";
        const fieldId = scope.match(/id="([^"]+)"/)?.[1];
        expect(fieldId).toBeTruthy();
        expect(html).toMatch(new RegExp(`<h3\\b[^>]*><label for="${fieldId}">Scope Description</label></h3>`));
        expect(html.match(new RegExp(`id="${fieldId}"`, "g"))).toHaveLength(1);
    });

    it("keeps the type grid single-column at tablet widths without changing other grids", () => {
        const html = markup();
        expect(html).toMatch(/<div class="grid lg:grid-cols-2 gap-4">[\s\S]*?<input id="project_type"/);
        expect(html.match(/class="grid sm:grid-cols-2 gap-4"/g)).toHaveLength(2);
    });
});
