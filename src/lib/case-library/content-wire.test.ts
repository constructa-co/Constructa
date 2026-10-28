import { beforeEach, describe, expect, it } from "vitest";
import { fakeLibrary } from "./__fixtures__/fake-library";
import { contentFromInput, contentProblemLegacy, hasCaseStudyPhoto, newDraft, toLegacyWireContent } from "./content";
import { createStudy, saveStudy, type LibraryContext } from "./service";

const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("legacy database wire contract (photos migration not applied)", () => {
    it("rejects any payload that includes a photos key, even when empty", () => {
        const wire = toLegacyWireContent(newDraft("Job"));
        expect(contentProblemLegacy(wire)).toBeNull();
        expect(contentProblemLegacy({ ...wire, photos: [] })).toBe("keys");
        expect(contentProblemLegacy({ ...wire, photos: [{ url: "", caption: "" }] })).toBe("keys");
    });

    it("saveStudy sends the legacy shape and refuses when a picture url was chosen", async () => {
        let db = fakeLibrary();
        let me: LibraryContext = { userId: ME, reader: db.reader, admin: () => db.admin };
        const created = await createStudy(me, { content: newDraft("Kitchen"), disciplineIds: [] });
        expect(created.status).toBe("saved");
        const id = created.id!;
        const withPhoto = { ...newDraft("Kitchen"), delivered: "Work done.", photos: [{ url: "https://images.example.test/a.jpg", caption: "", }, { url: "", caption: "" }, { url: "", caption: "" }] };
        expect(hasCaseStudyPhoto(withPhoto)).toBe(true);
        const refused = await saveStudy(me, { id, revision: 1, content: withPhoto, disciplineIds: [] });
        expect(refused).toMatchObject({ status: "invalid", field: "photos" });
        expect(db.rpcCalls.at(-1)?.name).not.toBe("case_study_save_draft");

        const saved = await saveStudy(me, { id, revision: 1, content: { ...newDraft("Kitchen"), delivered: "Work done." }, disciplineIds: [] });
        expect(saved.status).toBe("saved");
        const last = db.rpcCalls.filter((call) => call.name === "case_study_save_draft").at(-1)!;
        expect(contentProblemLegacy(last.args.p_content)).toBeNull();
        expect(last.args.p_content).not.toHaveProperty("photos");
        expect(contentFromInput(db.studies[0].draft).delivered).toBe("Work done.");
    });
});
