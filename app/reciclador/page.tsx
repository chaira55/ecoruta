"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { MEDELLIN_CENTER, MAPBOX_TOKEN, PIN_COLORS } from "@/lib/mapbox";
import type { EstadoReporte } from "@/lib/types";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
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

const COLOR_EN_RUTA = "#3b82f6";

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
  const [filtroMaterial, setFiltroMaterial] = useState<string>("todos");
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [statsPanel, setStatsPanel] = useState(false);
  const [statsReciclador, setStatsReciclador] = useState<{ total_kg: number; co2_kg: number; completados: number; por_material: Record<string, number> } | null>(null);

  // Estado para la lista de puntos seleccionados para recoger
  const [puntosEnRuta, setPuntosEnRuta] = useState<string[]>([]);
  const [tabActiva, setTabActiva] = useState<"disponibles" | "mi_ruta">("disponibles");
  const [pesosInput, setPesosInput] = useState<Record<string, string>>({});

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setUserId(session.user.id);
    });
  }, []);

  useEffect(() => {
    cargarReportes(MEDELLIN_CENTER[1], MEDELLIN_CENTER[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (reportesRef.current.length > 0) pintarPines(reportesRef.current, []);
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      map.current?.remove();
      map.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapContainerEl]);

  const miMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);

  function obtenerUbicacion() {
    if (watchIdRef.current !== null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setUbicacion(coords);

        if (!miMarkerRef.current) {
          miMarkerRef.current = new mapboxgl.Marker({ color: "#6366f1" })
            .setLngLat(coords)
            .setPopup(new mapboxgl.Popup().setText("Tú estás aquí"))
            .addTo(map.current!);
          map.current?.flyTo({ center: coords, zoom: 14 });
        } else {
          miMarkerRef.current.setLngLat(coords);
          map.current?.easeTo({ center: coords, duration: 1000 });
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
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
      if (map.current?.loaded()) pintarPines(lista, puntosEnRuta);
    } catch (e) {
      setErrorApi(e instanceof Error ? e.message : "Error de red");
    } finally {
      setCargando(false);
    }
  }

  function pintarPines(data: ReporteCercano[], enRuta: string[]) {
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    data.forEach((r) => {
      const esEmergencia = r.tipo === "emergencia";
      const estaEnRuta = enRuta.includes(r.id);
      const el = document.createElement("div");
      el.className = esEmergencia ? "cursor-default" : "cursor-pointer";

      const bgColor = esEmergencia
        ? PIN_COLORS.emergencia
        : estaEnRuta
        ? COLOR_EN_RUTA
        : PIN_COLORS[r.estado];

      el.innerHTML = `<div style="
        background:${bgColor};
        width:${esEmergencia ? "30px" : "36px"};height:${esEmergencia ? "30px" : "36px"};
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);border:3px solid ${estaEnRuta ? "#1d4ed8" : "white"};
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
        opacity:${esEmergencia ? "0.8" : "1"};">
        <span style="display:block;transform:rotate(45deg);text-align:center;line-height:${esEmergencia ? "24px" : "30px"};font-size:12px;">
          ${esEmergencia ? "🚨" : estaEnRuta ? "📋" : "♻️"}
        </span>
      </div>`;

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([r.lng, r.lat])
        .addTo(map.current!);

      if (esEmergencia) {
        marker.setPopup(
          new mapboxgl.Popup({ offset: 25, closeButton: false })
            .setHTML(`<div style="font-size:12px;padding:2px 4px"><b>🚨 Punto crítico</b><br/><span style="color:#666">${r.nota ?? "Basura acumulada"}</span></div>`)
        );
        el.addEventListener("mouseenter", () => marker.getPopup()?.addTo(map.current!));
        el.addEventListener("mouseleave", () => marker.getPopup()?.remove());
      } else {
        el.addEventListener("click", () => {
          setSeleccionado(r);
          map.current?.flyTo({ center: [r.lng, r.lat], zoom: 15 });
        });
        markersRef.current[r.id] = marker;
      }
    });
  }

  function toggleEnRuta(reporte: ReporteCercano) {
    setPuntosEnRuta((prev) => {
      const estaEnRuta = prev.includes(reporte.id);
      const nueva = estaEnRuta ? prev.filter((x) => x !== reporte.id) : [...prev, reporte.id];

      // Actualizar color del pin en el mapa
      const marker = markersRef.current[reporte.id];
      if (marker) {
        const pinDiv = marker.getElement().querySelector("div") as HTMLElement;
        const iconSpan = marker.getElement().querySelector("span") as HTMLElement;
        if (pinDiv) {
          pinDiv.style.background = estaEnRuta ? PIN_COLORS[reporte.estado] : COLOR_EN_RUTA;
          pinDiv.style.borderColor = estaEnRuta ? "white" : "#1d4ed8";
        }
        if (iconSpan) {
          iconSpan.textContent = estaEnRuta ? "♻️" : "📋";
        }
      }

      return nueva;
    });
  }

  async function cargarStatsReciclador() {
    if (!userId) return;
    const res = await fetch(`/api/stats/reciclador?reciclador_id=${userId}`);
    const data = await res.json();
    setStatsReciclador(data);
  }

  async function actualizarEstado(id: string, estado: EstadoReporte, peso_kg?: number) {
    await fetch("/api/reportes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, estado, peso_kg, reciclador_id: userId }),
    });

    setReportes((prev) =>
      prev.map((r) => (r.id === id ? { ...r, estado } : r))
    );
    setSeleccionado((prev) => (prev?.id === id ? { ...prev, estado } : prev));

    const marker = markersRef.current[id];
    if (marker) {
      if (estado === "completado") {
        marker.remove();
        delete markersRef.current[id];
        setSeleccionado((prev) => (prev?.id === id ? null : prev));
        // Quitar de la lista de ruta
        setPuntosEnRuta((prev) => prev.filter((x) => x !== id));
        setPesosInput((prev) => { const next = { ...prev }; delete next[id]; return next; });
      } else {
        const el = marker.getElement().querySelector("div") as HTMLElement;
        if (el) el.style.background = PIN_COLORS[estado];
      }
    }

    if (estado === "completado") {
      const restantes = reportesRef.current.filter(
        (r) => r.id !== id && r.estado !== "completado"
      );
      if (restantes.length === 0 && routeLayerRef.current && map.current) {
        if (map.current.getLayer("ruta")) map.current.removeLayer("ruta");
        if (map.current.getSource("ruta")) map.current.removeSource("ruta");
        routeLayerRef.current = false;
      }
    }
  }

  async function generarRuta() {
    if (!ubicacion) return;
    setGenerandoRuta(true);

    const base = puntosEnRuta.length > 0
      ? reportes.filter((r) => puntosEnRuta.includes(r.id) && r.estado !== "completado")
      : reportes.filter((r) => r.tipo === "solicitud" && r.estado === "pendiente");

    const solicitudes = base.slice(0, 24);
    if (solicitudes.length === 0) { setGenerandoRuta(false); return; }

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
  const reportesEnRuta = reportes.filter((r) => puntosEnRuta.includes(r.id) && r.estado !== "completado");

  return (
    <>
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
          {puntosEnRuta.length > 0 && (
            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
              📋 {puntosEnRuta.length} en mi ruta
            </span>
          )}
          <button
            onClick={() => { setStatsPanel(true); cargarStatsReciclador(); }}
            className="text-gray-500 hover:text-green-600 border border-gray-200 px-3 py-1 rounded-xl transition text-xs font-medium"
          >
            🏆 Mi impacto
          </button>
          <UserMenu />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Panel lateral */}
        <div className="w-80 bg-white border-r flex flex-col overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setTabActiva("disponibles")}
              className={`flex-1 py-2 text-sm font-semibold transition ${
                tabActiva === "disponibles"
                  ? "text-green-700 border-b-2 border-green-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Disponibles
              {solicitudesPendientes.length > 0 && (
                <span className="ml-1 bg-gray-100 text-gray-600 text-xs px-1.5 rounded-full">
                  {solicitudesPendientes.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTabActiva("mi_ruta")}
              className={`flex-1 py-2 text-sm font-semibold transition ${
                tabActiva === "mi_ruta"
                  ? "text-blue-700 border-b-2 border-blue-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Mi ruta
              {puntosEnRuta.length > 0 && (
                <span className="ml-1 bg-blue-100 text-blue-700 text-xs px-1.5 rounded-full">
                  {puntosEnRuta.length}
                </span>
              )}
            </button>
          </div>

          {/* Botón generar ruta */}
          <div className="p-3 border-b">
            <button
              onClick={generarRuta}
              disabled={generandoRuta || (puntosEnRuta.length === 0 && solicitudesPendientes.length === 0)}
              className="w-full bg-green-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50"
            >
              {generandoRuta
                ? "Calculando ruta..."
                : puntosEnRuta.length > 0
                ? `🗺️ Ruta con ${puntosEnRuta.length} punto${puntosEnRuta.length > 1 ? "s" : ""} seleccionado${puntosEnRuta.length > 1 ? "s" : ""}`
                : "🗺️ Generar ruta óptima"}
            </button>
          </div>

          {/* ─── TAB: DISPONIBLES ─── */}
          {tabActiva === "disponibles" && (
            <>
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
                {emergencias.length > 0 && (
                  <div className="mx-3 mt-2 mb-1 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
                    <span className="text-red-500 text-sm">🚨</span>
                    <p className="text-xs text-red-700">
                      <span className="font-semibold">{emergencias.length} punto{emergencias.length > 1 ? "s" : ""} crítico{emergencias.length > 1 ? "s" : ""}</span> visibles en el mapa. Solo son informativos.
                    </p>
                  </div>
                )}
                {cargando ? (
                  <div className="p-4 text-center text-gray-400 text-sm">Cargando reportes...</div>
                ) : errorApi ? (
                  <div className="p-4 text-center text-red-500 text-xs bg-red-50 m-2 rounded-xl">
                    Error: {errorApi}
                  </div>
                ) : solicitudesPendientes.filter((r) => filtroMaterial === "todos" || r.material === filtroMaterial).length === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-sm">
                    No hay solicitudes cercanas
                  </div>
                ) : (
                  reportes
                    .filter((r) => r.tipo === "solicitud" && r.estado !== "completado" && (filtroMaterial === "todos" || r.material === filtroMaterial))
                    .map((r) => {
                      const estaEnRuta = puntosEnRuta.includes(r.id);
                      return (
                        <div
                          key={r.id}
                          className={`border-b transition ${
                            seleccionado?.id === r.id ? "bg-green-50 border-l-4 border-l-green-500" : ""
                          }`}
                        >
                          <button
                            onClick={() => {
                              setSeleccionado(r);
                              map.current?.flyTo({ center: [r.lng, r.lat], zoom: 15 });
                            }}
                            className="w-full text-left p-3 hover:bg-gray-50 transition"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span>{estaEnRuta ? "📋" : "♻️"}</span>
                              <span className="text-sm font-semibold text-gray-800 capitalize flex-1">
                                {r.material ?? "Reciclable"}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  r.estado === "pendiente"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-yellow-100 text-yellow-700"
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
                          {/* Botón agregar / quitar de ruta */}
                          <div className="px-3 pb-2">
                            <button
                              onClick={() => {
                                toggleEnRuta(r);
                                if (!estaEnRuta) setTabActiva("mi_ruta");
                              }}
                              className={`w-full text-xs py-1.5 rounded-lg font-semibold transition ${
                                estaEnRuta
                                  ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                            >
                              {estaEnRuta ? "✓ En mi ruta" : "+ Agregar a mi ruta"}
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </>
          )}

          {/* ─── TAB: MI RUTA ─── */}
          {tabActiva === "mi_ruta" && (
            <div className="flex-1 overflow-y-auto">
              {reportesEnRuta.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-4xl mb-3">📋</p>
                  <p className="text-sm text-gray-500 font-medium">Tu lista está vacía</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Ve a <span className="font-semibold">Disponibles</span> y agrega puntos a tu ruta
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {reportesEnRuta.map((r) => (
                    <div key={r.id} className="p-3">
                      {/* Cabecera del item */}
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={() => {
                            map.current?.flyTo({ center: [r.lng, r.lat], zoom: 15 });
                            setSeleccionado(r);
                          }}
                          className="flex-1 flex items-center gap-2 text-left"
                        >
                          <span className="text-base">📋</span>
                          <span className="text-sm font-semibold text-gray-800 capitalize">
                            {r.material ?? "Reciclable"}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              r.estado === "pendiente"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {r.estado.replace("_", " ")}
                          </span>
                        </button>
                        <button
                          onClick={() => toggleEnRuta(r)}
                          className="text-gray-300 hover:text-red-400 transition text-lg leading-none"
                          title="Quitar de mi ruta"
                        >
                          ×
                        </button>
                      </div>

                      <p className="text-xs text-gray-400 mb-2">
                        📍 {r.distancia_metros < 1000
                          ? `${Math.round(r.distancia_metros)} m`
                          : `${(r.distancia_metros / 1000).toFixed(1)} km`}
                      </p>

                      {/* Acciones */}
                      {r.estado === "pendiente" && confirmandoId !== r.id && (
                        <button
                          onClick={() => setConfirmandoId(r.id)}
                          className="w-full bg-yellow-500 text-white py-1.5 rounded-lg text-xs font-semibold hover:bg-yellow-600 transition"
                        >
                          🚴 Voy en camino
                        </button>
                      )}

                      {r.estado === "pendiente" && confirmandoId === r.id && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => { actualizarEstado(r.id, "en_camino"); setConfirmandoId(null); }}
                            className="flex-1 bg-yellow-500 text-white py-1.5 rounded-lg text-xs font-semibold hover:bg-yellow-600 transition"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setConfirmandoId(null)}
                            className="px-3 bg-gray-100 text-gray-600 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-200 transition"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}

                      {r.estado === "en_camino" && (
                        <div className="flex gap-2 items-center">
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            placeholder="kg"
                            value={pesosInput[r.id] ?? ""}
                            onChange={(e) =>
                              setPesosInput((prev) => ({ ...prev, [r.id]: e.target.value }))
                            }
                            className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-400"
                          />
                          <span className="text-xs text-gray-400">kg</span>
                          <button
                            onClick={() => {
                              const kg = parseFloat(pesosInput[r.id] ?? "");
                              if (!kg || kg <= 0) return;
                              actualizarEstado(r.id, "completado", kg);
                            }}
                            disabled={!pesosInput[r.id] || parseFloat(pesosInput[r.id]) <= 0}
                            className="flex-1 bg-green-600 text-white py-1.5 rounded-lg text-xs font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            ✅ Recolectado
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mapa */}
        <div className="flex-1 relative">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Panel de detalle (fotos + nota) */}
          {seleccionado && (
            <div className="absolute bottom-4 left-4 right-4 bg-white rounded-2xl shadow-xl p-4 z-10 max-h-72 overflow-y-auto">
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

              {seleccionado.foto_url && (
                <div className={`grid gap-2 mb-3 ${[...(seleccionado.fotos_extra ?? []), seleccionado.foto_url].length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {[seleccionado.foto_url, ...(seleccionado.fotos_extra ?? [])].map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={url}
                      alt={`Foto ${i + 1}`}
                      onClick={() => setFotoAmpliada(url)}
                      className="w-full h-24 object-contain rounded-lg bg-gray-100 cursor-pointer hover:opacity-90 transition"
                    />
                  ))}
                </div>
              )}

              {seleccionado.nota && (
                <p className="text-sm text-gray-600 mb-3 bg-gray-50 rounded-xl p-2">
                  {seleccionado.nota}
                </p>
              )}

              {/* Acceso rápido a Mi ruta desde el detalle */}
              {seleccionado.tipo === "solicitud" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      toggleEnRuta(seleccionado);
                      setTabActiva("mi_ruta");
                      setSeleccionado(null);
                    }}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                      puntosEnRuta.includes(seleccionado.id)
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {puntosEnRuta.includes(seleccionado.id) ? "✓ En mi ruta" : "+ Agregar a mi ruta"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </AuthGuard>

    {/* Panel Mi Impacto */}
    {statsPanel && (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setStatsPanel(false)}>
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-800">🏆 Mi impacto</h2>
            <button onClick={() => setStatsPanel(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>
          {!statsReciclador ? (
            <p className="text-center text-gray-400 py-6">Cargando...</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{statsReciclador.total_kg}</p>
                  <p className="text-xs text-gray-500 mt-1">kg recolectados</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{statsReciclador.co2_kg}</p>
                  <p className="text-xs text-gray-500 mt-1">kg CO₂ evitado</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{statsReciclador.completados}</p>
                  <p className="text-xs text-gray-500 mt-1">completados</p>
                </div>
              </div>
              {Object.keys(statsReciclador.por_material).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Por material</p>
                  <div className="space-y-2">
                    {Object.entries(statsReciclador.por_material).map(([mat, kg]) => (
                      <div key={mat} className="flex items-center justify-between">
                        <span className="text-sm capitalize text-gray-700">{mat}</span>
                        <span className="text-sm font-semibold text-green-700">{kg} kg</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {statsReciclador.completados === 0 && (
                <p className="text-center text-gray-400 text-sm py-2">¡Completa tu primer reporte para ver tu impacto!</p>
              )}
            </>
          )}
        </div>
      </div>
    )}

    {/* Lightbox */}
    {fotoAmpliada && (
      <div
        className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
        onClick={() => setFotoAmpliada(null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fotoAmpliada}
          alt="Foto ampliada"
          className="max-w-full max-h-full object-contain rounded-xl"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          onClick={() => setFotoAmpliada(null)}
          className="absolute top-4 right-4 text-white text-3xl font-bold hover:text-gray-300"
        >
          ×
        </button>
      </div>
    )}
    </>
  );
}
