// Fixture harness for the case-study library. TEST ONLY. See ../../actions.ts.
import { notFound } from "next/navigation";
import { fixturePublish, fixtureReview, fixtureSaveDraft } from "../../actions";
import ReviewHost from "./review-host";

export const dynamic = "force-dynamic";

export default async function ReviewFixturePage(props: { params: Promise<{ run: string }> }) {
    if (process.env.CONSTRUCTA_IMPORT_FIXTURE !== "1") notFound();
    const { run } = await props.params;
    const { context, older } = await fixtureReview(run);
    return (
        <main className="min-h-screen bg-gray-50">
            <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-4 sm:pt-8 pb-16">
                <ReviewHost context={context} older={older} save={fixtureSaveDraft.bind(null, run)} publish={fixturePublish.bind(null, run)} />
            </div>
        </main>
    );
}
