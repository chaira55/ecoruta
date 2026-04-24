import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { CO2_FACTOR, type Material } from "@/lib/types";

function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  const supabase = createClient();

  // Suma de kg por material en reportes completados
  const { data, error } = await supabase
    .from("reportes")
    .select("material, peso_kg")
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
    const factor = mat && CO2_FACTOR[mat] ? CO2_FACTOR[mat] : 1.2; // promedio si no hay material
    co2_kg += kg * factor;

    if (mat) {
      por_material[mat] = (por_material[mat] ?? 0) + kg;
    }
  }

  // Número de reportes completados
  const { count } = await supabase
    .from("reportes")
    .select("*", { count: "exact", head: true })
    .eq("estado", "completado");

  return NextResponse.json({
    total_kg: Math.round(total_kg * 10) / 10,
    co2_kg: Math.round(co2_kg * 10) / 10,
    reportes_completados: count ?? 0,
    por_material,
  });
}
