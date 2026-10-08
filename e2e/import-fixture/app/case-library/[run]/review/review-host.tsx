"use client";

// Fixture harness for the case-study library. TEST ONLY. See ../../actions.ts.
import ReviewSendClient, { type CaseStudyOption, type ReviewServer } from "@/app/dashboard/projects/proposal/review-send-client";
import type { ReviewContext } from "@/lib/proposal-review";

const unused = async () => ({ success: false as const, error: "Not part of this fixture." });

/** The real review screen, with its saves and sends pointed at the fixture's stand-ins. */
export default function ReviewHost({ context, older, save, publish }: {
    context: ReviewContext;
    older: CaseStudyOption[];
    save: (payload: { caseStudyIds?: unknown }) => Promise<{ success: true }>;
    publish: (input: { responseKind: "acknowledgement" | "non_binding_intent"; reviewedContent: string }) => Promise<unknown>;
}) {
    const server: ReviewServer = {
        save: (payload) => save(payload),
        ask: async () => ({ ok: false, error: "Not part of this fixture." }),
        publish: (input) => publish(input) as ReturnType<ReviewServer["publish"]>,
        retry: unused as never,
        upload: async () => ({ error: "Not part of this fixture." }),
        loadPublication: unused,
    };
    return <ReviewSendClient context={context} caseStudies={older} lockReason={null} estimateIssue={null} publications={[]} server={server} now="2026-10-05T09:00:00.000Z" />;
}
