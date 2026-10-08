// Fixture harness for the case-study library. TEST ONLY. See ../../../../actions.ts.
import { notFound } from "next/navigation";
import GuidedCapture from "@/app/dashboard/settings/case-studies/library/guided-capture";
import { fixtureCreate, fixtureSave, fixtureSaveDiscipline, fixtureStudy } from "../../../../actions";

export const dynamic = "force-dynamic";

/** The questions, for a new case study (`new`) or an existing one. Only the three actions the real screen uses are given to it. */
export default async function GuidedFixturePage(props: { params: Promise<{ run: string; id: string }> }) {
    if (process.env.CONSTRUCTA_IMPORT_FIXTURE !== "1") notFound();
    const { run, id } = await props.params;
    const data = await fixtureStudy(run, id === "new" ? null : id);
    if (id !== "new" && !data.study) notFound();
    return (
        <main className="min-h-screen bg-slate-950">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
                <GuidedCapture
                    initial={data.study}
                    disciplines={data.disciplines}
                    basePath={`/admin-e2e-import-fixture/case-library/${run}/study`}
                    listHref={`/admin-e2e-import-fixture/case-library/${run}`}
                    server={{
                        create: fixtureCreate.bind(null, run),
                        save: fixtureSave.bind(null, run),
                        addDiscipline: fixtureSaveDiscipline.bind(null, run),
                    }}
                />
            </div>
        </main>
    );
}
