export type Rol = "ciudadano" | "reciclador" | "admin";

export type TipoReporte = "emergencia" | "solicitud";

export type Material = "carton" | "plastico" | "vidrio" | "metal" | "organico";

export type EstadoReporte = "pendiente" | "en_camino" | "completado";

export interface Perfil {
  id: string;
  rol: Rol;
  nombre: string;
  kg_recolectados_total: number;
  foto_url: string | null;
}

export interface Reporte {
  id: string;
  ciudadano_id: string;
  tipo: TipoReporte;
  material: Material | null;
  // lat/lng extraídos de la columna geometry en Supabase
  lat: number;
  lng: number;
  foto_url: string;
  nota: string | null;
  estado: EstadoReporte;
  reciclador_id: string | null;
  peso_kg: number | null;
  creado_en: string;
  actualizado_en: string;
}

// Factor de CO₂ evitado por kg de material reciclado
export const CO2_FACTOR: Record<Material, number> = {
  carton: 0.9,
  plastico: 1.5,
  vidrio: 0.3,
  metal: 9.0,
  organico: 0.5,
};
