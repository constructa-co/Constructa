import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ updateProfileAction: vi.fn(), rewriteWithAIAction: vi.fn(), rewriteMdMessageAction: vi.fn() }));
vi.mock("@/app/storage/actions", () => ({ uploadProfileImageAction: vi.fn() }));

import ProfileForm from "./profile-form";

const render = (preferred_trades: string[]) => renderToStaticMarkup(createElement(ProfileForm, {
    profile: { company_name: "Example Kitchens", business_type: "Kitchen fitting", preferred_trades },
    userEmail: "sam@example.invalid",
}));

describe("optional profile trade discovery", () => {
    it("does not open an unrelated checklist or infer trades from the existing work description", () => {
        const html = render([]);
        const details = html.match(/<details[^>]*data-profile-trade-preferences[^>]*>[\s\S]*?<\/details>/)?.[0];
        expect(details).toBeDefined();
        expect(details!.slice(0, details!.indexOf(">") + 1)).not.toMatch(/\bopen(?:=|\s|>)/);
        expect(details).toContain("Optional trade preferences (0 selected)");
        expect(details).toContain("Piling");
        expect(details).toContain("Asbestos Removal");
        expect(details).not.toContain('aria-pressed="true"');
        expect(html).toContain("Your own work description stays in Company basics.");
        expect(html).toContain('value="Kitchen fitting"');
        expect(html).toContain('data-preferred-trades="[]"');
    });

    it("keeps exact saved preferences, including legacy values, and retains the optional editing controls", () => {
        const html = render(["Kitchen Installation", "Legacy specialist <work>"]);
        expect(html).toContain("Optional trade preferences (2 selected)");
        expect(html).toContain("Selected preferences: Kitchen Installation, Legacy specialist &lt;work&gt;");
        expect(html).toContain('data-preferred-trades="[&quot;Kitchen Installation&quot;,&quot;Legacy specialist &lt;work&gt;&quot;]"');
        expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Kitchen Installation<\/button>/);
        expect(html).toContain('name="specialisms"');
        expect(html).toContain('name="capability_statement"');
        expect(html).toContain("Save Company Profile");
    });
});
