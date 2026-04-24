export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

// Centro del mapa en Medellín
export const MEDELLIN_CENTER: [number, number] = [-75.5812, 6.2442];
export const DEFAULT_ZOOM = 12;

// Colores de pines por estado
export const PIN_COLORS: Record<string, string> = {
  pendiente: "#22c55e",   // verde
  en_camino: "#f59e0b",  // amarillo
  completado: "#6b7280", // gris
  emergencia: "#ef4444", // rojo
};

// Llama a la Directions API de Mapbox con hasta 12 waypoints
export async function getOptimizedRoute(
  waypoints: [number, number][]
): Promise<GeoJSON.LineString | null> {
  if (waypoints.length < 2) return null;

  const coords = waypoints.map((w) => w.join(",")).join(";");
  const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;

  const res = await fetch(url);
  const json = await res.json();

  if (!json.routes?.length) return null;
  return json.routes[0].geometry;
}
