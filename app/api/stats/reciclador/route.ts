import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { CO2_FACTOR, type Material } from "@/lib/types";

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
  const reciclador_id = searchParams.get("reciclador_id");

  if (!reciclador_id) {
    return NextResponse.json({ error: "reciclador_id requerido" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("reportes")
    .select("material, peso_kg, creado_en")
    .eq("reciclador_id", reciclador_id)
    .eq("estado", "completado")
    .not("peso_kg", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let total_kg = 0;
  let co2_kg = 0;
  const por_material: Record<string, number> = {};

  for (const row of data ?? []) {
    const kg = row.peso_kg as number;
    total_kg += kg;
    const mat = row.material as Material | null;
    const factor = mat && CO2_FACTOR[mat] ? CO2_FACTOR[mat] : 1.2;
    co2_kg += kg * factor;
    if (mat) por_material[mat] = (por_material[mat] ?? 0) + kg;
  }

  return NextResponse.json({
    total_kg: Math.round(total_kg * 10) / 10,
    co2_kg: Math.round(co2_kg * 10) / 10,
    completados: data?.length ?? 0,
    por_material,
  });
}
