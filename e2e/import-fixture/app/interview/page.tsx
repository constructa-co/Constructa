// Fixture harness for the guided company interview. TEST ONLY. See ./actions.ts.
import { notFound } from "next/navigation";
import InterviewClient from "@/app/dashboard/settings/profile/interview/interview-client";
import { fixtureAiOffered, fixtureApprove, fixtureBuild, fixtureInterview, fixtureReword, fixtureSave } from "./actions";

export const dynamic = "force-dynamic";

export default async function InterviewFixturePage(props: { searchParams: Promise<{ run?: string }> }) {
    if (process.env.CONSTRUCTA_IMPORT_FIXTURE !== "1") notFound();
    const run = (await props.searchParams).run ?? "default";
    return (
        <main className="min-h-screen bg-gray-50">
            <InterviewClient
                initialState={await fixtureInterview(run)}
                save={fixtureSave.bind(null, run)}
                build={fixtureBuild.bind(null, run)}
                reword={fixtureReword.bind(null, run)}
                aiOffered={await fixtureAiOffered(run)}
                approve={fixtureApprove.bind(null, run)}
            />
        </main>
    );
}
