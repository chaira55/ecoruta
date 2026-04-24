import { createClient } from "./client";
import type { EstadoReporte, Material, TipoReporte } from "@/lib/types";

// Trae solicitudes pendientes ordenadas por distancia al reciclador
export async function getReportesCercanos(lat: number, lng: number) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("reportes_cercanos", {
    lat,
    lng,
    radio_metros: 10000,
  });

  if (error) throw error;
  return data;
}

// Inserta un nuevo reporte
export async function crearReporte(reporte: {
  tipo: TipoReporte;
  material: Material | null;
  lat: number;
  lng: number;
  foto_url: string;
  nota: string | null;
}) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("reportes")
    .insert({
      tipo: reporte.tipo,
      material: reporte.material,
      ubicacion: `POINT(${reporte.lng} ${reporte.lat})`,
      foto_url: reporte.foto_url,
      nota: reporte.nota,
      estado: "pendiente",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Actualiza el estado de un reporte
export async function actualizarEstadoReporte(
  id: string,
  estado: EstadoReporte,
  peso_kg?: number
) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("reportes")
    .update({ estado, ...(peso_kg ? { peso_kg } : {}) })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// KPIs para el dashboard admin
export async function getKPIs() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("reportes")
    .select("estado, peso_kg, material");

  if (error) throw error;

  const total = data.length;
  const completados = data.filter((r) => r.estado === "completado");
  const kgDesviados = completados.reduce(
    (acc, r) => acc + (r.peso_kg ?? 0),
    0
  );

  return { total, completados: completados.length, kgDesviados };
}
