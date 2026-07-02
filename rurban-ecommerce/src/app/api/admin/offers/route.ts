import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeSupabaseImageUrl, toIsoBoundary } from "@/lib/utils";

function normalizeDateInput(value: string | undefined, boundary: "start" | "end") {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return toIsoBoundary(value, boundary);
  }
  return value;
}

async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const role =
    user.app_metadata?.role as string | undefined;

  if (role !== "admin") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const };
}

interface CreateOfferBody {
  title?: string;
  description?: string | null;
  type?: "percentage" | "fixed" | "bogo" | "category_discount" | "product_discount";
  value?: number;
  image_url?: string | null;
  apply_to?: "all" | "category" | "product";
  target_id?: string | null;
  start_date?: string;
  end_date?: string;
  status?: "active" | "inactive";
  is_highlighted?: boolean;
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("offers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as CreateOfferBody;
  const title = body.title?.trim();

  if (!title) {
    return NextResponse.json({ error: "Offer title is required" }, { status: 400 });
  }

  if (!body.end_date) {
    return NextResponse.json({ error: "End date is required" }, { status: 400 });
  }

  const payload = {
    title,
    description: body.description?.trim() || null,
    type: body.type ?? "percentage",
    value: Number(body.value ?? 0),
    image_url: normalizeSupabaseImageUrl(body.image_url) || null,
    apply_to: body.apply_to ?? "all",
    target_id: body.target_id || null,
    start_date: normalizeDateInput(body.start_date, "start") || new Date().toISOString(),
    end_date: normalizeDateInput(body.end_date, "end"),
    status: body.status ?? "active",
    is_highlighted: Boolean(body.is_highlighted),
  };

  const admin = createAdminClient();
  const { data, error } = await admin.from("offers").insert(payload).select("*").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
