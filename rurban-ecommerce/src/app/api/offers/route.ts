import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("offers")
    .select("*")
    .eq("status", "active")
    .order("is_highlighted", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const now = Date.now();
  const filtered = (data ?? []).filter((offer) => {
    const start = offer.start_date ? new Date(offer.start_date).getTime() : null;
    const end = offer.end_date ? new Date(offer.end_date).getTime() : null;
    return (start === null || now >= start) && (end === null || now <= end);
  });

  return NextResponse.json({ data: filtered });
}
