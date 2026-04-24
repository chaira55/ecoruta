"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { MEDELLIN_CENTER, MAPBOX_TOKEN, PIN_COLORS } from "@/lib/mapbox";
import type { EstadoReporte } from "@/lib/types";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Link from "next/link";

interface ReporteCercano {
  id: string;
  tipo: string;
  material: string | null;
  estado: EstadoReporte;
  foto_url: string;
  nota: string | null;
  lat: number;
  lng: number;
  distancia_metros: number;
  creado_en: string;
}

export default function RecicladorPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const routeLayerRef = useRef(false);

  const [reportes, setReportes] = useState<ReporteCercano[]>([]);
  const [seleccionado, setSeleccionado] = useState<ReporteCercano | null>(null);
  const [ubicacion, setUbicacion] = useState<[number, number] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [generandoRuta, setGenerandoRuta] = useState(false);

  // Inicializar mapa
  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: MEDELLIN_CENTER,
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      obtenerUbicacionYReportes();
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function obtenerUbicacionYReportes() {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setUbicacion(coords);
        map.current?.flyTo({ center: coords, zoom: 13 });
        // Marker del reciclador
        new mapboxgl.Marker({ color: "#6366f1" })
          .setLngLat(coords)
          .setPopup(new mapboxgl.Popup().setText("Tú estás aquí"))
          .addTo(map.current!);
        cargarReportes(coords[1], coords[0]);
      },
      () => {
        cargarReportes(MEDELLIN_CENTER[1], MEDELLIN_CENTER[0]);
      },
      { enableHighAccuracy: true }
    );
  }

  async function cargarReportes(lat: number, lng: number) {
    setCargando(true);
    try {
      const res = await fetch(`/api/reportes?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      setReportes(data ?? []);
      pintarPines(data ?? []);
    } finally {
      setCargando(false);
    }
  }

  function pintarPines(data: ReporteCercano[]) {
    // Limpiar markers anteriores
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    data.forEach((r) => {
      const el = document.createElement("div");
      el.className = "cursor-pointer";
      el.innerHTML = `<div style="
        background:${r.tipo === "emergencia" ? PIN_COLORS.emergencia : PIN_COLORS[r.estado]};
        width:36px;height:36px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.3);">
        <span style="display:block;transform:rotate(45deg);text-align:center;line-height:30px;font-size:14px;">
          ${r.tipo === "emergencia" ? "🚨" : "♻️"}
        </span>
      </div>`;

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([r.lng, r.lat])
        .addTo(map.current!);

      el.addEventListener("click", () => setSeleccionado(r));
      markersRef.current[r.id] = marker;
    });
  }

  async function actualizarEstado(id: string, estado: EstadoReporte, peso_kg?: number) {
    await fetch("/api/reportes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, estado, peso_kg }),
    });

    setReportes((prev) =>
      prev.map((r) => (r.id === id ? { ...r, estado } : r))
    );
    setSeleccionado((prev) => (prev?.id === id ? { ...prev, estado } : prev));

    // Actualizar color del pin
    const marker = markersRef.current[id];
    if (marker) {
      const el = marker.getElement().querySelector("div") as HTMLElement;
      if (el) {
        if (estado === "completado") {
          marker.remove();
          delete markersRef.current[id];
          setSeleccionado(null);
        } else {
          el.style.background = PIN_COLORS[estado];
        }
      }
    }
  }

  async function generarRuta() {
    if (!ubicacion || reportes.length === 0) return;
    setGenerandoRuta(true);

    const solicitudes = reportes
      .filter((r) => r.tipo === "solicitud" && r.estado === "pendiente")
      .slice(0, 11);

    const waypoints: [number, number][] = [
      ubicacion,
      ...solicitudes.map((r): [number, number] => [r.lng, r.lat]),
    ];

    try {
      const res = await fetch("/api/ruta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waypoints }),
      });
      const { geometry } = await res.json();

      if (map.current && geometry) {
        // Remover ruta anterior
        if (routeLayerRef.current) {
          map.current.removeLayer("ruta");
          map.current.removeSource("ruta");
        }
        map.current.addSource("ruta", { type: "geojson", data: { type: "Feature", properties: {}, geometry } });
        map.current.addLayer({
          id: "ruta",
          type: "line",
          source: "ruta",
          paint: { "line-color": "#22c55e", "line-width": 4, "line-dasharray": [2, 1] },
        });
        routeLayerRef.current = true;
      }
    } finally {
      setGenerandoRuta(false);
    }
  }

  // Realtime: escuchar nuevos reportes
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("reportes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "reportes" }, () => {
        if (ubicacion) cargarReportes(ubicacion[1], ubicacion[0]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ubicacion]);

  const solicitudesPendientes = reportes.filter(
    (r) => r.tipo === "solicitud" && r.estado === "pendiente"
  );
  const emergencias = reportes.filter((r) => r.tipo === "emergencia");

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">←</Link>
          <span className="text-lg font-bold text-gray-800">🚴 Vista Reciclador</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
            {solicitudesPendientes.length} solicitudes
          </span>
          {emergencias.length > 0 && (
            <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
              {emergencias.length} emergencias
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Panel lateral */}
        <div className="w-80 bg-white border-r flex flex-col overflow-hidden">
          <div className="p-3 border-b">
            <button
              onClick={generarRuta}
              disabled={generandoRuta || solicitudesPendientes.length === 0}
              className="w-full bg-green-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50"
            >
              {generandoRuta ? "Calculando ruta..." : "🗺️ Generar ruta óptima"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {cargando ? (
              <div className="p-4 text-center text-gray-400 text-sm">Cargando reportes...</div>
            ) : reportes.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-sm">
                No hay solicitudes cercanas
              </div>
            ) : (
              reportes.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setSeleccionado(r);
                    map.current?.flyTo({ center: [r.lng, r.lat], zoom: 15 });
                  }}
                  className={`w-full text-left p-3 border-b hover:bg-gray-50 transition ${
                    seleccionado?.id === r.id ? "bg-green-50 border-l-4 border-l-green-500" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>{r.tipo === "emergencia" ? "🚨" : "♻️"}</span>
                    <span className="text-sm font-semibold text-gray-800 capitalize">
                      {r.tipo === "emergencia" ? "Punto crítico" : r.material ?? "Reciclable"}
                    </span>
                    <span
                      className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.estado === "pendiente"
                          ? "bg-green-100 text-green-700"
                          : r.estado === "en_camino"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {r.estado.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {r.distancia_metros < 1000
                      ? `${Math.round(r.distancia_metros)} m`
                      : `${(r.distancia_metros / 1000).toFixed(1)} km`}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Mapa */}
        <div className="flex-1 relative">
          <div ref={mapContainer} className="w-full h-full" />

          {/* Panel de detalle */}
          {seleccionado && (
            <div className="absolute bottom-4 left-4 right-4 bg-white rounded-2xl shadow-xl p-4 z-10">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-gray-800">
                    {seleccionado.tipo === "emergencia" ? "🚨 Punto crítico" : `♻️ ${seleccionado.material ?? "Reciclable"}`}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {seleccionado.distancia_metros < 1000
                      ? `${Math.round(seleccionado.distancia_metros)} m de distancia`
                      : `${(seleccionado.distancia_metros / 1000).toFixed(1)} km de distancia`}
                  </p>
                </div>
                <button onClick={() => setSeleccionado(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
              </div>

              {seleccionado.nota && (
                <p className="text-sm text-gray-600 mb-3 bg-gray-50 rounded-xl p-2">
                  {seleccionado.nota}
                </p>
              )}

              {/* Botones de cambio de estado */}
              {seleccionado.tipo === "solicitud" && (
                <div className="flex gap-2">
                  {seleccionado.estado === "pendiente" && (
                    <button
                      onClick={() => actualizarEstado(seleccionado.id, "en_camino")}
                      className="flex-1 bg-yellow-500 text-white py-2 rounded-xl text-sm font-semibold hover:bg-yellow-600 transition"
                    >
                      🚴 Voy en camino
                    </button>
                  )}
                  {seleccionado.estado === "en_camino" && (
                    <button
                      onClick={() => actualizarEstado(seleccionado.id, "completado", 5)}
                      className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition"
                    >
                      ✅ Marcar completado
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
