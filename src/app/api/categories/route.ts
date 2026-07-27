import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

const categorySchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  parent_id: z.string().uuid().optional().nullable(),
});

// GET /api/categories — référentiel global des catégories
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data, error } = await supabase.from("categories").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ data });
}

// POST /api/categories — création (super_admin, manager — vérifié par RLS)
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({ ...parsed.data, slug: slugify(parsed.data.name) })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });

  return NextResponse.json({ data }, { status: 201 });
}
