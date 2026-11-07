// Fixture harness for the case-study wording suggestion. TEST ONLY. See ../actions.ts.
import { NextResponse } from "next/server";
import { fixtureCaseStudyControl } from "../actions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    if (process.env.CONSTRUCTA_IMPORT_FIXTURE !== "1") return new NextResponse(null, { status: 404 });
    const run = new URL(request.url).searchParams.get("run") ?? "default";
    return NextResponse.json(await fixtureCaseStudyControl(run, await request.json().catch(() => ({}))));
}
