// Fixture harness for the case-study library. TEST ONLY. See ../actions.ts.
import { notFound } from "next/navigation";
import LibraryPanel from "@/app/dashboard/settings/case-studies/library-panel";
import { fixtureArchiveDiscipline, fixtureArchiveStudy, fixtureLibrary, fixtureSaveDiscipline, fixtureStartFromOlder } from "../actions";

export const dynamic = "force-dynamic";

export default async function LibraryFixturePage(props: { params: Promise<{ run: string }> }) {
    if (process.env.CONSTRUCTA_IMPORT_FIXTURE !== "1") notFound();
    const { run } = await props.params;
    const library = await fixtureLibrary(run);
    return (
        <main className="min-h-screen bg-slate-950">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                <LibraryPanel
                    available={library.available}
                    studies={library.studies}
                    disciplines={library.disciplines}
                    older={library.older}
                    basePath={`/admin-e2e-import-fixture/case-library/${run}/study`}
                    server={{
                        archiveStudy: fixtureArchiveStudy.bind(null, run),
                        saveDiscipline: fixtureSaveDiscipline.bind(null, run),
                        archiveDiscipline: fixtureArchiveDiscipline.bind(null, run),
                        startFromOlder: fixtureStartFromOlder.bind(null, run),
                    }}
                />
            </div>
        </main>
    );
}
