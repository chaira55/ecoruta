"use client";

import { useEffect, useState, useRef } from "react";
import { MEDELLIN_CENTER, MAPBOX_TOKEN } from "@/lib/mapbox";
import { CO2_FACTOR } from "@/lib/types";
import type { Material } from "@/lib/types";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Link from "next/link";
import AuthGuard from "../components/AuthGuard";
import UserMenu from "../components/UserMenu";

interface Reporte {
  id: string;
  tipo: string;
  material: Material | null;
  estado: string;
  peso_kg: number | null;
  lat: number;
  lng: number;
  creado_en: string;
}

interface KPIs {
  total: number;
  emergencias: number;
  solicitudes: number;
  completados: number;
  kgDesviados: number;
  co2Evitado: number;
}

export default function AdminPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [cargando, setCargando] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<"calor" | "pines">("calor");
  const [filtroFecha, setFiltroFecha] = useState<"hoy" | "semana" | "mes" | "todo">("todo");
  const [tabActivo, setTabActivo] = useState<"mapa" | "tabla">("mapa");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "pendiente" | "en_camino" | "completado">("todos");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "emergencia" | "solicitud">("todos");

  useEffect(() => {
    cargarDatos();
  }, []);

  // Refrescar datos al entrar a la tabla
  useEffect(() => {
    if (tabActivo === "tabla") cargarDatos();
    // Al volver al mapa, forzar resize para que ocupe el espacio correcto
    if (tabActivo === "mapa") {
      setTimeout(() => map.current?.resize(), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabActivo]);

  function filtrarPorFecha(data: Reporte[]) {
    if (filtroFecha === "todo") return data;
    const ahora = new Date();
    const desde = new Date();
    if (filtroFecha === "hoy") desde.setHours(0, 0, 0, 0);
    else if (filtroFecha === "semana") desde.setDate(ahora.getDate() - 7);
    else if (filtroFecha === "mes") desde.setMonth(ahora.getMonth() - 1);
    return data.filter((r) => new Date(r.creado_en) >= desde);
  }

  const reportesFiltrados = filtrarPorFecha(reportes);

  async function cargarDatos() {
    setCargando(true);
    try {
      const res = await fetch("/api/reportes?todos=1", { credentials: "include" });
      const data = await res.json();

      // Mapear lat/lng desde la API
      const reportesMapeados: Reporte[] = (data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        lat: r.lat ?? 6.2442,
        lng: r.lng ?? -75.5812,
      }));

      setReportes(reportesMapeados);
      calcularKPIs(reportesMapeados);
    } finally {
      setCargando(false);
    }
  }

  function calcularKPIs(data: Reporte[]) {
    const completados = data.filter((r) => r.estado === "completado");
    const kgDesviados = completados.reduce((acc, r) => acc + (r.peso_kg ?? 0), 0);
    const co2Evitado = completados.reduce((acc, r) => {
      const factor = r.material ? (CO2_FACTOR[r.material] ?? 0.5) : 0.5;
      return acc + (r.peso_kg ?? 0) * factor;
    }, 0);

    setKpis({
      total: data.length,
      emergencias: data.filter((r) => r.tipo === "emergencia").length,
      solicitudes: data.filter((r) => r.tipo === "solicitud").length,
      completados: completados.length,
      kgDesviados,
      co2Evitado,
    });
  }

  // Inicializar mapa
  useEffect(() => {
    if (map.current || !mapContainer.current || cargando) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: MEDELLIN_CENTER,
      zoom: 11,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      agregarCapas();
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando]);

  // Actualizar mapa cuando cambia el filtro de fecha
  useEffect(() => {
    if (map.current?.loaded()) agregarCapas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroFecha, reportes]);

  function agregarCapas() {
    if (!map.current || reportesFiltrados.length === 0) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: reportesFiltrados.map((r) => ({
        type: "Feature",
        properties: { tipo: r.tipo, estado: r.estado },
        geometry: { type: "Point", coordinates: [r.lng, r.lat] },
      })),
    };

    if (map.current.getSource("reportes")) {
      (map.current.getSource("reportes") as mapboxgl.GeoJSONSource).setData(geojson);
    } else {
      map.current.addSource("reportes", { type: "geojson", data: geojson });
    }

    // Capa heatmap
    if (!map.current.getLayer("heatmap")) {
      map.current.addLayer({
        id: "heatmap",
        type: "heatmap",
        source: "reportes",
        paint: {
          "heatmap-weight": 1,
          "heatmap-intensity": 1.5,
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(0,0,0,0)",
            0.2, "#22c55e",
            0.5, "#f59e0b",
            0.8, "#ef4444",
            1, "#7f1d1d",
          ],
          "heatmap-radius": 40,
          "heatmap-opacity": 0.85,
        },
      });
    }

    // Capa pines
    if (!map.current.getLayer("pines")) {
      map.current.addLayer({
        id: "pines",
        type: "circle",
        source: "reportes",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 8,
          "circle-color": [
            "match", ["get", "tipo"],
            "emergencia", "#ef4444",
            "#22c55e",
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
    }
  }

  function toggleVista(vista: "calor" | "pines") {
    setVistaActiva(vista);
    if (!map.current) return;
    map.current.setLayoutProperty("heatmap", "visibility", vista === "calor" ? "visible" : "none");
    map.current.setLayoutProperty("pines", "visibility", vista === "pines" ? "visible" : "none");
  }

  // Recalcular KPIs al cambiar filtro
  const kpisActivos = (() => {
    const data = reportesFiltrados;
    const completados = data.filter((r) => r.estado === "completado");
    const kgDesviados = completados.reduce((acc, r) => acc + (r.peso_kg ?? 0), 0);
    const co2Evitado = completados.reduce((acc, r) => {
      const factor = r.material ? (CO2_FACTOR[r.material] ?? 0.5) : 0.5;
      return acc + (r.peso_kg ?? 0) * factor;
    }, 0);
    return {
      total: data.length,
      emergencias: data.filter((r) => r.tipo === "emergencia").length,
      solicitudes: data.filter((r) => r.tipo === "solicitud").length,
      completados: completados.length,
      kgDesviados,
      co2Evitado,
    };
  })();

  async function cambiarEstadoAdmin(id: string, estado: string) {
    await fetch("/api/reportes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, estado }),
    });
    setReportes((prev) => prev.map((r) => r.id === id ? { ...r, estado } : r));
  }

  const kpiCards = kpis ? [
    { label: "Total reportes", valor: kpisActivos.total, emoji: "📍", color: "bg-blue-50 text-blue-700" },
    { label: "Emergencias", valor: kpisActivos.emergencias, emoji: "🚨", color: "bg-red-50 text-red-700" },
    { label: "Solicitudes", valor: kpisActivos.solicitudes, emoji: "♻️", color: "bg-green-50 text-green-700" },
    { label: "Completados", valor: kpisActivos.completados, emoji: "✅", color: "bg-emerald-50 text-emerald-700" },
    { label: "kg desviados", valor: `${kpisActivos.kgDesviados.toFixed(1)} kg`, emoji: "⚖️", color: "bg-yellow-50 text-yellow-700" },
    { label: "CO₂ evitado", valor: `${kpisActivos.co2Evitado.toFixed(2)} kg`, emoji: "🌿", color: "bg-teal-50 text-teal-700" },
  ] : [];

  return (
    <AuthGuard rolRequerido="admin">
    <div className="h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm">←</Link>
          <span className="text-lg font-bold text-white">📊 Panel Administrador</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={cargarDatos}
            className="text-xs text-gray-400 hover:text-white border border-gray-700 px-3 py-1 rounded-lg transition"
          >
            Actualizar
          </button>
          <UserMenu />
        </div>
      </div>

      {/* KPIs */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {kpiCards.map((k) => (
            <div key={k.label} className={`rounded-xl p-3 ${k.color}`}>
              <div className="text-xl mb-1">{k.emoji}</div>
              <div className="text-lg font-bold">{k.valor}</div>
              <div className="text-xs opacity-70">{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs mapa / tabla */}
      <div className="bg-gray-900 px-4 py-2 flex flex-wrap gap-2 border-b border-gray-800 items-center">
        <button
          onClick={() => setTabActivo("mapa")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tabActivo === "mapa" ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
        >
          🗺️ Mapa
        </button>
        <button
          onClick={() => setTabActivo("tabla")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tabActivo === "tabla" ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
        >
          📋 Tabla
        </button>

        {tabActivo === "mapa" && (
          <>
            <button onClick={() => toggleVista("calor")} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${vistaActiva === "calor" ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
              🔥 Calor
            </button>
            <button onClick={() => toggleVista("pines")} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${vistaActiva === "pines" ? "bg-blue-500 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
              📍 Pines
            </button>
          </>
        )}

        {tabActivo === "tabla" && (
          <>
            {(["todos", "pendiente", "en_camino", "completado"] as const).map((e) => (
              <button key={e} onClick={() => setFiltroEstado(e)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${filtroEstado === e ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                {e === "todos" ? "Todos" : e.replace("_", " ")}
              </button>
            ))}
            <div className="w-px h-4 bg-gray-700" />
            {(["todos", "emergencia", "solicitud"] as const).map((t) => (
              <button key={t} onClick={() => setFiltroTipo(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${filtroTipo === t ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                {t === "todos" ? "Todos tipos" : t}
              </button>
            ))}
          </>
        )}

        <div className="ml-auto flex gap-1">
          {(["hoy", "semana", "mes", "todo"] as const).map((f) => (
            <button key={f} onClick={() => setFiltroFecha(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${filtroFecha === f ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Mapa — siempre en el DOM, oculto con CSS cuando no está activo */}
      <div className={`flex-1 relative ${tabActivo !== "mapa" ? "hidden" : ""}`}>
        {cargando ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
            <p className="text-gray-400">Cargando datos...</p>
          </div>
        ) : (
          <div ref={mapContainer} className="w-full h-full" />
        )}
        {vistaActiva === "calor" && !cargando && tabActivo === "mapa" && (
          <div className="absolute bottom-4 right-4 bg-gray-900/90 rounded-xl p-3 text-xs text-white">
            <p className="font-semibold mb-2">Intensidad</p>
            <div className="flex items-center gap-1">
              <div className="w-24 h-3 rounded" style={{background: "linear-gradient(to right, #22c55e, #f59e0b, #ef4444, #7f1d1d)"}} />
            </div>
            <div className="flex justify-between text-gray-400 mt-1">
              <span>Baja</span><span>Alta</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabla */}
      {tabActivo === "tabla" && (
        <div className="flex-1 overflow-auto">
          {cargando ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400">Cargando datos...</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-900 text-gray-400 sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Material</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Peso (kg)</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {reportesFiltrados
                  .filter((r) => (filtroEstado === "todos" || r.estado === filtroEstado) && (filtroTipo === "todos" || r.tipo === filtroTipo))
                  .map((r, i) => (
                    <tr key={r.id} className={`border-b border-gray-800 ${i % 2 === 0 ? "bg-gray-950" : "bg-gray-900/30"}`}>
                      <td className="px-4 py-3 text-white">
                        {r.tipo === "emergencia" ? "🚨 Emergencia" : "♻️ Solicitud"}
                      </td>
                      <td className="px-4 py-3 text-gray-300 capitalize">{r.material ?? "—"}</td>
                      <td className="px-4 py-3">
                        {r.tipo === "emergencia" ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-900 text-red-300">
                            ⚠️ Cuidado
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            r.estado === "pendiente" ? "bg-yellow-900 text-yellow-300" :
                            r.estado === "en_camino" ? "bg-blue-900 text-blue-300" :
                            "bg-green-900 text-green-300"
                          }`}>
                            {r.estado.replace("_", " ")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{r.peso_kg ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(r.creado_en).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
    </AuthGuard>
  );
}
