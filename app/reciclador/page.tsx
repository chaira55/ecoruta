"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { MEDELLIN_CENTER, MAPBOX_TOKEN, PIN_COLORS } from "@/lib/mapbox";
import type { EstadoReporte } from "@/lib/types";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Link from "next/link";
import AuthGuard from "../components/AuthGuard";
import UserMenu from "../components/UserMenu";

interface ReporteCercano {
  id: string;
  tipo: string;
  material: string | null;
  estado: EstadoReporte;
  foto_url: string;
  fotos_extra: string[];
  nota: string | null;
  lat: number;
  lng: number;
  distancia_metros: number;
  creado_en: string;
}

export default function RecicladorPage() {
  const [mapContainerEl, setMapContainerEl] = useState<HTMLDivElement | null>(null);
  const mapContainerRef = useCallback((node: HTMLDivElement | null) => setMapContainerEl(node), []);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const reportesRef = useRef<ReporteCercano[]>([]);
  const routeLayerRef = useRef(false);

  const [reportes, setReportes] = useState<ReporteCercano[]>([]);
  const [seleccionado, setSeleccionado] = useState<ReporteCercano | null>(null);
  const [ubicacion, setUbicacion] = useState<[number, number] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [generandoRuta, setGenerandoRuta] = useState(false);
  const [pesoInput, setPesoInput] = useState("");
  const [filtroMaterial, setFiltroMaterial] = useState<string>("todos");
  const [confirmando, setConfirmando] = useState(false);
  const [errorApi, setErrorApi] = useState<string | null>(null);

  // Cargar reportes al montar (independiente del mapa)
  useEffect(() => {
    cargarReportes(MEDELLIN_CENTER[1], MEDELLIN_CENTER[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Inicializar mapa cuando el container esté disponible
  useEffect(() => {
    if (map.current || !mapContainerEl) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainerEl,
      style: "mapbox://styles/mapbox/streets-v12",
      center: MEDELLIN_CENTER,
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      obtenerUbicacion();
      if (reportesRef.current.length > 0) pintarPines(reportesRef.current);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapContainerEl]);

  function obtenerUbicacion() {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setUbicacion(coords);
        map.current?.flyTo({ center: coords, zoom: 13 });
        new mapboxgl.Marker({ color: "#6366f1" })
          .setLngLat(coords)
          .setPopup(new mapboxgl.Popup().setText("Tú estás aquí"))
          .addTo(map.current!);
      },
      () => {},
      { enableHighAccuracy: true }
    );
  }

  async function cargarReportes(lat: number, lng: number) {
    setCargando(true);
    setErrorApi(null);
    try {
      const res = await fetch(`/api/reportes?lat=${lat}&lng=${lng}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || data?.error) {
        setErrorApi(data?.error ?? `Error ${res.status}`);
        setReportes([]);
        return;
      }
      const lista = Array.isArray(data) ? data : [];
      setReportes(lista);
      reportesRef.current = lista;
      if (map.current?.loaded()) pintarPines(lista);
    } catch (e) {
      setErrorApi(e instanceof Error ? e.message : "Error de red");
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
        const coords = ubicacion ?? [MEDELLIN_CENTER[0], MEDELLIN_CENTER[1]] as [number, number];
        cargarReportes(coords[1], coords[0]);
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
    <AuthGuard rolRequerido="reciclador">
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-2">
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
          <UserMenu />
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

          {/* Filtro por material */}
          <div className="px-3 py-2 border-b flex gap-1 overflow-x-auto">
            {["todos", "plastico", "carton", "vidrio", "metal", "organico"].map((m) => (
              <button
                key={m}
                onClick={() => setFiltroMaterial(m)}
                className={`px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  filtroMaterial === m
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {m === "todos" ? "Todos" : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {cargando ? (
              <div className="p-4 text-center text-gray-400 text-sm">Cargando reportes...</div>
            ) : errorApi ? (
              <div className="p-4 text-center text-red-500 text-xs bg-red-50 m-2 rounded-xl">
                Error: {errorApi}
              </div>
            ) : reportes.filter((r) => r.estado !== "completado" && (filtroMaterial === "todos" || r.material === filtroMaterial || (filtroMaterial === "todos" && r.tipo === "emergencia"))).length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-sm">
                No hay solicitudes cercanas
              </div>
            ) : (
              reportes.filter((r) => r.estado !== "completado" && (filtroMaterial === "todos" || r.material === filtroMaterial)).map((r) => (
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
          <div ref={mapContainerRef} className="w-full h-full" />

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

              {/* Fotos del reporte */}
              {seleccionado.foto_url && (
                <div className={`grid gap-2 mb-3 ${[...(seleccionado.fotos_extra ?? []), seleccionado.foto_url].length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {[seleccionado.foto_url, ...(seleccionado.fotos_extra ?? [])].map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={url}
                      alt={`Foto ${i + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                  ))}
                </div>
              )}

              {seleccionado.nota && (
                <p className="text-sm text-gray-600 mb-3 bg-gray-50 rounded-xl p-2">
                  {seleccionado.nota}
                </p>
              )}

              {/* Botones de cambio de estado */}
              {seleccionado.tipo === "solicitud" && (
                <div className="flex gap-2">
                  {seleccionado.estado === "pendiente" && !confirmando && (
                    <button
                      onClick={() => setConfirmando(true)}
                      className="flex-1 bg-yellow-500 text-white py-2 rounded-xl text-sm font-semibold hover:bg-yellow-600 transition"
                    >
                      🚴 Voy en camino
                    </button>
                  )}
                  {seleccionado.estado === "pendiente" && confirmando && (
                    <div className="flex-1 flex gap-2">
                      <button
                        onClick={() => { actualizarEstado(seleccionado.id, "en_camino"); setConfirmando(false); }}
                        className="flex-1 bg-yellow-500 text-white py-2 rounded-xl text-sm font-semibold hover:bg-yellow-600 transition"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setConfirmando(false)}
                        className="px-3 bg-gray-100 text-gray-600 py-2 rounded-xl text-sm font-semibold hover:bg-gray-200 transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                  {seleccionado.estado === "en_camino" && (
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          placeholder="Peso en kg"
                          value={pesoInput}
                          onChange={(e) => setPesoInput(e.target.value)}
                          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                        <span className="text-sm text-gray-500">kg</span>
                      </div>
                      <button
                        onClick={() => {
                          const kg = parseFloat(pesoInput);
                          if (!kg || kg <= 0) return;
                          actualizarEstado(seleccionado.id, "completado", kg);
                          setPesoInput("");
                        }}
                        disabled={!pesoInput || parseFloat(pesoInput) <= 0}
                        className="w-full bg-green-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ✅ Marcar completado
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </AuthGuard>
  );
}
