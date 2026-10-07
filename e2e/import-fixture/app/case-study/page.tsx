// Fixture harness for the case-study wording suggestion. TEST ONLY. See ./actions.ts.
import { notFound } from "next/navigation";
import CaseStudiesClient from "@/app/dashboard/settings/case-studies/case-studies-client";
import { fixtureEnhance } from "./actions";

export const dynamic = "force-dynamic";

const CASE_STUDY = {
    id: "fixture-case-study",
    projectName: "Kitchen at Example Road",
    projectType: "Refurbishment",
    contractValue: "",
    programmeDuration: "",
    client: "",
    location: "",
    whatWeDelivered: "we refitted the kitchen moved the wall and replastered throughout",
    valueAdded: "family could stay in the house the whole time",
    photos: ["", "", ""],
};

export default async function CaseStudyFixturePage(props: { searchParams: Promise<{ run?: string }> }) {
    if (process.env.CONSTRUCTA_IMPORT_FIXTURE !== "1") notFound();
    const run = (await props.searchParams).run ?? "default";
    return (
        <main className="min-h-screen bg-slate-950">
            <div className="max-w-5xl mx-auto px-6 py-8">
                <CaseStudiesClient initialCaseStudies={[CASE_STUDY]} userId="fixture" enhance={fixtureEnhance.bind(null, run)} />
            </div>
        </main>
    );
}
