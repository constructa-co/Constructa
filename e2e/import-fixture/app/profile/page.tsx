// Fixture harness for the Company Profile form. TEST ONLY. See ./actions.ts.
import { notFound } from "next/navigation";
import { Toaster } from "sonner";
import ProfileForm from "@/app/dashboard/settings/profile/profile-form";
import { fixtureProfile, fixtureSaveProfile } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProfileFixturePage(props: { searchParams: Promise<{ run?: string }> }) {
    if (process.env.CONSTRUCTA_IMPORT_FIXTURE !== "1") notFound();
    const run = (await props.searchParams).run ?? "default";
    return (
        <main className="min-h-screen bg-slate-950">
            <div className="max-w-4xl mx-auto p-8 pt-12 space-y-8">
                <Toaster richColors position="top-right" />
                <ProfileForm profile={(await fixtureProfile(run)) as never} userEmail="sam@example.com" save={fixtureSaveProfile.bind(null, run)} />
            </div>
        </main>
    );
}
