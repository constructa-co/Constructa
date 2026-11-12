// Fixture harness for the website import. TEST ONLY. See ./actions.ts.
import { notFound } from "next/navigation";
import ImportClient from "@/app/dashboard/settings/profile/import/import-client";
import { fixtureApply, fixtureDraft, fixturePreview } from "./actions";

export const dynamic = "force-dynamic";

export default async function ImportFixturePage(props: { searchParams: Promise<{ run?: string }> }) {
    if (process.env.CONSTRUCTA_IMPORT_FIXTURE !== "1") notFound();
    const run = (await props.searchParams).run ?? "default";
    return (
        <main className="min-h-screen bg-gray-50">
            <ImportClient
                initialDraft={await fixtureDraft(run)}
                savedWebsite=""
                preview={fixturePreview.bind(null, run)}
                apply={fixtureApply.bind(null, run)}
            />
        </main>
    );
}
