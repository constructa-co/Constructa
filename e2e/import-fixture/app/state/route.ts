// Fixture harness for the website import. TEST ONLY. See ../actions.ts.
import { NextResponse } from "next/server";
import { fixtureState } from "../actions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    if (process.env.CONSTRUCTA_IMPORT_FIXTURE !== "1") return new NextResponse(null, { status: 404 });
    return NextResponse.json(await fixtureState(new URL(request.url).searchParams.get("run") ?? "default"));
}
