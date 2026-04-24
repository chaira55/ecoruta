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

  const centerLat = lat ? parseFloat(lat) : 6.2442;
  const centerLng = lng ? parseFloat(lng) : -75.5812;

  const { data, error } = await supabase.rpc("reportes_cercanos", {
    lat: centerLat,
    lng: centerLng,
    radio_metros: 999999999, // sin límite de distancia
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
    })
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
