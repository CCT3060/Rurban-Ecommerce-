import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/auth/request-context";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data, error } = await db
    .from("orders")
    .select("*, user:profiles(full_name,email,phone), order_items(*)")
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Fetch B2B payment terms if this order belongs to a B2B customer
  let b2b_payment_terms: string | null = null;
  if (data?.user_id) {
    const { data: b2b } = await db
      .from("b2b_customer_details")
      .select("payment_terms")
      .eq("user_id", data.user_id)
      .maybeSingle();
    b2b_payment_terms = b2b?.payment_terms ?? null;
  }

  return NextResponse.json({ data: { ...data, b2b_payment_terms } });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = (await request.json()) as { status?: string; payment_status?: string };
  const payload: Record<string, unknown> = {};
  if (body.status !== undefined) payload.status = body.status;
  if (body.payment_status !== undefined) payload.payment_status = body.payment_status;
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("orders").update(payload).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
