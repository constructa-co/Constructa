// Fixture harness for the case-study library. TEST ONLY. See ../../actions.ts.
import { NextResponse } from "next/server";
import { fixtureLibraryControl } from "../../actions";

export const dynamic = "force-dynamic";

export async function POST(request: Request, props: { params: Promise<{ run: string }> }) {
    if (process.env.CONSTRUCTA_IMPORT_FIXTURE !== "1") return new NextResponse(null, { status: 404 });
    const { run } = await props.params;
    return NextResponse.json(await fixtureLibraryControl(run, await request.json().catch(() => ({}))));
}
