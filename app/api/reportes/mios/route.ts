import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const ciudadano_id = searchParams.get("ciudadano_id");

  if (!ciudadano_id) {
    return NextResponse.json({ error: "ciudadano_id requerido" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("reportes")
    .select("id, tipo, material, estado, foto_url, fotos_extra, nota, peso_kg, creado_en")
    .eq("ciudadano_id", ciudadano_id)
    .order("creado_en", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
