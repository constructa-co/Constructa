import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ save: vi.fn(), enhance: vi.fn(), upload: vi.fn() }));
vi.mock("./actions", () => ({ saveCaseStudiesAction: actions.save, enhanceCaseStudyAction: actions.enhance }));
vi.mock("@/app/storage/actions", () => ({ uploadProfileImageAction: actions.upload }));

import CaseStudiesClient from "./case-studies-client";

function markup(photos: string[]) {
    return renderToStaticMarkup(<CaseStudiesClient userId="synthetic" initialCaseStudies={[{
        id: "example", projectName: "Example renovation", projectType: "Renovation",
        contractValue: "", programmeDuration: "", client: "", location: "",
        whatWeDelivered: "Example work", valueAdded: "Own wording", photos,
    }]} />);
}

describe("past-work photo input accessibility", () => {
    it("keeps three natively focusable inputs with distinct slot and example names", () => {
        const html = markup(["", "", ""]);
        const inputs = html.match(/<input[^>]*type="file"[^>]*>/g) ?? [];
        expect(inputs).toHaveLength(3);
        inputs.forEach((input, slot) => {
            expect(input).toContain(`aria-label="Upload photo ${slot + 1} for past work 1"`);
            expect(input).toContain('class="sr-only"');
            expect(input).toContain('accept="image/jpeg,image/png,image/webp"');
            expect(input).not.toMatch(/disabled|tabindex="-1"/);
        });
    });

    it("names replacement separately without activating an upload or changing the image", () => {
        const html = markup(["/example-photo.webp", "", ""]);
        expect(html).toContain('aria-label="Replace photo 1 for past work 1"');
        expect(html).toContain('aria-label="Upload photo 2 for past work 1"');
        expect(html).toContain('src="/example-photo.webp"');
        for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
    });

    it("names a remove control only for a slot that holds a photo, outside the replace label", () => {
        const html = markup(["/example-photo.webp", "", ""]);
        expect(html).toContain('aria-label="Remove photo 1 for past work 1"');
        expect(html).not.toContain("Remove photo 2");
        expect(html).toMatch(/<button[^>]*type="button"[^>]*aria-label="Remove photo 1 for past work 1"/);
        expect(html.match(/<label[^>]*>(?:(?!<\/label>)[^])*Remove photo 1/)).toBeNull();
    });
});
