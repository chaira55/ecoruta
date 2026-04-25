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

  // Obtener todos los reportes completados con reciclador_id y peso
  const { data: reportes, error } = await supabase
    .from("reportes")
    .select("reciclador_id, material, peso_kg")
    .eq("estado", "completado")
    .not("reciclador_id", "is", null)
    .not("peso_kg", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Agrupar por reciclador
  const mapa: Record<string, { total_kg: number; co2_kg: number; completados: number }> = {};
  for (const r of reportes ?? []) {
    const id = r.reciclador_id as string;
    if (!mapa[id]) mapa[id] = { total_kg: 0, co2_kg: 0, completados: 0 };
    const kg = r.peso_kg as number;
    const mat = r.material as Material | null;
    mapa[id].total_kg += kg;
    mapa[id].co2_kg += kg * (mat && CO2_FACTOR[mat] ? CO2_FACTOR[mat] : 1.2);
    mapa[id].completados += 1;
  }

  if (Object.keys(mapa).length === 0) return NextResponse.json([]);

  // Obtener nombres de los recicladores
  const ids = Object.keys(mapa);
  const { data: perfiles } = await supabase
    .from("perfiles")
    .select("id, nombre")
    .in("id", ids);

  const resultado = ids
    .map((id) => ({
      id,
      nombre: perfiles?.find((p) => p.id === id)?.nombre ?? "Reciclador",
      total_kg: Math.round(mapa[id].total_kg * 10) / 10,
      co2_kg: Math.round(mapa[id].co2_kg * 10) / 10,
      completados: mapa[id].completados,
    }))
    .sort((a, b) => b.total_kg - a.total_kg)
    .slice(0, 10);

  return NextResponse.json(resultado);
}
