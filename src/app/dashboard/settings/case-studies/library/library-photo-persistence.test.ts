import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { fakeLibrary } from "@/lib/case-library/__fixtures__/fake-library";
import { caseLibraryDraftPhotosOnWire, newDraft } from "@/lib/case-library/content";
import { fieldMessage } from "@/lib/case-library/messages";
import { normalisePhotoSlots } from "@/lib/case-library/photos";
import { createStudy, saveStudy, type LibraryContext } from "@/lib/case-library/service";
import CaseStudyPhotoSlots, { libraryPhotoUploadOffered } from "./case-study-photo-slots";

const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("library photo persistence contract", () => {
    it("the wire contract flag is off while only the legacy twelve-key migration applies", () => {
        expect(caseLibraryDraftPhotosOnWire()).toBe(false);
        expect(libraryPhotoUploadOffered(false, vi.fn())).toBe(false);
        expect(libraryPhotoUploadOffered(true, vi.fn())).toBe(true);
    });

    it("does not offer upload controls while persistence is unavailable", () => {
        const html = renderToStaticMarkup(
            createElement(CaseStudyPhotoSlots, {
                photos: normalisePhotoSlots([]),
                onChange: () => {},
                onUpload: vi.fn(),
                cardIndex: 0,
                persistenceAvailable: false,
            }),
        );
        expect(html).toContain("saved to the library yet");
        expect(html).not.toContain('type="file"');
        expect(html).not.toContain(">Upload<");
    });

    it("does not call storage upload while persistence is unavailable", async () => {
        const upload = vi.fn(async (_formData: FormData) => ({ url: "https://images.example.test/x.jpg" }));
        const guard = async () => {
            if (!caseLibraryDraftPhotosOnWire()) return;
            const formData = new FormData();
            formData.set("file", new File(["x"], "x.jpg", { type: "image/jpeg" }));
            await upload(formData);
        };
        await guard();
        expect(upload).not.toHaveBeenCalled();
    });

    it("ordinary legacy text save is acknowledged without a photos key on the wire", async () => {
        const db = fakeLibrary();
        const me: LibraryContext = { userId: ME, reader: db.reader, admin: () => db.admin };
        const created = await createStudy(me, { content: newDraft("Kitchen"), disciplineIds: [] });
        expect(created.status).toBe("saved");
        const id = created.id!;
        const saved = await saveStudy(me, { id, revision: 1, content: { ...newDraft("Kitchen"), delivered: "Work done." }, disciplineIds: [] });
        expect(saved.status).toBe("saved");
        const last = db.rpcCalls.filter((call) => call.name === "case_study_save_draft").at(-1)!;
        expect(last.args.p_content).not.toHaveProperty("photos");
    });

    it("refuses honestly when a draft carries picture urls while persistence is unavailable", async () => {
        const db = fakeLibrary();
        const me: LibraryContext = { userId: ME, reader: db.reader, admin: () => db.admin };
        const created = await createStudy(me, { content: newDraft("Kitchen"), disciplineIds: [] });
        const id = created.id!;
        const withPhoto = {
            ...newDraft("Kitchen"),
            delivered: "Work done.",
            photos: [{ url: "https://images.example.test/a.jpg", caption: "" }, { url: "", caption: "" }, { url: "", caption: "" }],
        };
        const refused = await saveStudy(me, { id, revision: 1, content: withPhoto, disciplineIds: [] });
        expect(refused).toMatchObject({ status: "invalid", field: "photos", message: fieldMessage("photos") });
        expect(db.rpcCalls.at(-1)?.name).not.toBe("case_study_save_draft");
    });
});
