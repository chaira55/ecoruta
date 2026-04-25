import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Usa service role para evitar problemas de RLS en API routes
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
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const todos = searchParams.get("todos"); // admin: traer todos los estados

  if (todos === "1") {
    // Vista admin: todos los reportes incluyendo completados
    const { data, error } = await supabase.rpc("reportes_todos", {
      lat: 6.2442,
      lng: -75.5812,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const centerLat = lat ? parseFloat(lat) : 6.2442;
  const centerLng = lng ? parseFloat(lng) : -75.5812;

  const { data, error } = await supabase.rpc("reportes_cercanos", {
    lat: centerLat,
    lng: centerLng,
    radio_metros: 999999999,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("reportes")
    .insert({
      tipo: body.tipo,
      material: body.material ?? null,
      ubicacion: `POINT(${body.lng} ${body.lat})`,
      foto_url: body.foto_url,
      fotos_extra: body.fotos_extra ?? [],
      nota: body.nota ?? null,
      estado: "pendiente",
      ciudadano_id: body.ciudadano_id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("reportes")
    .update({
      estado: body.estado,
      ...(body.peso_kg ? { peso_kg: body.peso_kg } : {}),
      ...(body.reciclador_id ? { reciclador_id: body.reciclador_id } : {}),
    })
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
