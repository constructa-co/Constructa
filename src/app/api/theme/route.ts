import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { theme } = await req.json();
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await supabase.from("profiles").update({ theme_preference: theme }).eq("id", user.id);
  return NextResponse.json({ ok: true });
}
