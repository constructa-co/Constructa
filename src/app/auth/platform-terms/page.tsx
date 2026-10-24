import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PLATFORM_TERMS_CURRENT_REVISION } from "@/lib/platform-terms";
import { PLATFORM_TERMS_COMPLETION_SIGN_IN } from "@/lib/platform-terms-completion";
import PlatformTermsCompletion from "./completion-client";

// A023 — where a confirmed user explicitly accepts the platform terms.
// Rendering this page records nothing; only the form's explicit submit does.
// Without a server session the user is sent to sign in, returning only here.
export const dynamic = "force-dynamic";

export default async function PlatformTermsCompletionPage() {
    let signedIn = false;
    try {
        const supabase = await createClient();
        const { data, error } = await supabase.auth.getUser();
        signedIn = !error && Boolean(data?.user);
    } catch {
        signedIn = false;
    }
    if (!signedIn) redirect(PLATFORM_TERMS_COMPLETION_SIGN_IN);

    return <PlatformTermsCompletion revision={PLATFORM_TERMS_CURRENT_REVISION} />;
}
