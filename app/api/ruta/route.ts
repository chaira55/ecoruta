import { NextRequest, NextResponse } from "next/server";
import { getOptimizedRoute } from "@/lib/mapbox";

export async function POST(request: NextRequest) {
  const body = await request.json();
  // waypoints: [[lng, lat], [lng, lat], ...]
  const { waypoints } = body as { waypoints: [number, number][] };

  if (!waypoints || waypoints.length < 2) {
    return NextResponse.json(
      { error: "Se necesitan al menos 2 puntos" },
      { status: 400 }
    );
  }

  const geometry = await getOptimizedRoute(waypoints.slice(0, 12));
  if (!geometry) {
    return NextResponse.json(
      { error: "No se pudo calcular la ruta" },
      { status: 500 }
    );
  }

  return NextResponse.json({ geometry });
}
