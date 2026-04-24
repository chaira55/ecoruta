import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (lat && lng) {
    const { data, error } = await supabase.rpc("reportes_cercanos", {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radio_metros: 10000,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase
    .from("reportes")
    .select("*")
    .order("creado_en", { ascending: false });

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
