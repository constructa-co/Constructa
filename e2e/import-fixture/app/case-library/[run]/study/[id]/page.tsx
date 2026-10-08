// Fixture harness for the case-study library. TEST ONLY. See ../../../actions.ts.
import { notFound } from "next/navigation";
import CaseStudyEditor from "@/app/dashboard/settings/case-studies/library/case-study-editor";
import { fixtureApprove, fixtureCheck, fixtureCreate, fixtureSave, fixtureSaveDiscipline, fixtureStudy } from "../../../actions";

export const dynamic = "force-dynamic";

/** `new` adds a case study; anything else edits that one. */
export default async function EditorFixturePage(props: { params: Promise<{ run: string; id: string }> }) {
    if (process.env.CONSTRUCTA_IMPORT_FIXTURE !== "1") notFound();
    const { run, id } = await props.params;
    const data = await fixtureStudy(run, id === "new" ? null : id);
    if (id !== "new" && !data.study) notFound();
    return (
        <main className="min-h-screen bg-slate-950">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
                <CaseStudyEditor
                    initial={data.study}
                    disciplines={data.disciplines}
                    listHref={`/admin-e2e-import-fixture/case-library/${run}`}
                    server={{
                        create: fixtureCreate.bind(null, run),
                        save: fixtureSave.bind(null, run),
                        check: fixtureCheck.bind(null, run),
                        approve: fixtureApprove.bind(null, run),
                        addDiscipline: fixtureSaveDiscipline.bind(null, run),
                    }}
                />
            </div>
        </main>
    );
}
