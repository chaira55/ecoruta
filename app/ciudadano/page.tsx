"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import FormularioReporte from "./FormularioReporte";
import StatsWidget from "../components/StatsWidget";
import AuthGuard from "../components/AuthGuard";
import UserMenu from "../components/UserMenu";
import { createClient } from "@/lib/supabase/client";
import { MEDELLIN_CENTER, MAPBOX_TOKEN } from "@/lib/mapbox";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface MiReporte {
  id: string;
  tipo: string;
  material: string | null;
  estado: string;
  foto_url: string;
  nota: string | null;
  peso_kg: number | null;
  creado_en: string;
  lat?: number;
  lng?: number;
}

const ESTADO_LABEL: Record<string, { label: string; color: string; emoji: string }> = {
  pendiente: { label: "Pendiente", color: "bg-yellow-100 text-yellow-700", emoji: "⏳" },
  en_camino: { label: "En camino", color: "bg-blue-100 text-blue-700", emoji: "🚴" },
  completado: { label: "Completado", color: "bg-green-100 text-green-700", emoji: "✅" },
};

export default function CiudadanoPage() {
  const [tipo, setTipo] = useState<"emergencia" | "solicitud" | null>(null);
  const [tab, setTab] = useState<"nuevo" | "historial" | "mapa">("nuevo");
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapContainerEl, setMapContainerEl] = useState<HTMLDivElement | null>(null);
  const mapContainerRef = useCallback((node: HTMLDivElement | null) => setMapContainerEl(node), []);
  const [misReportes, setMisReportes] = useState<MiReporte[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [notificaciones, setNotificaciones] = useState<string[]>([]);
  const [prevEstados, setPrevEstados] = useState<Record<string, string>>({});

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setUserId(session.user.id);
    });
  }, []);

  useEffect(() => {
    if (userId) cargarHistorial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Polling de notificaciones cada 30s
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => checkNotificaciones(), 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, prevEstados]);

  // Inicializar mapa cuando el tab mapa esté activo
  useEffect(() => {
    if (tab !== "mapa" || !mapContainerEl || map.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    map.current = new mapboxgl.Map({
      container: mapContainerEl,
      style: "mapbox://styles/mapbox/streets-v12",
      center: MEDELLIN_CENTER,
      zoom: 12,
    });
    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.current.on("load", () => pintarMisReportes());
    return () => { map.current?.remove(); map.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, mapContainerEl]);

  // Repintar cuando cambian los reportes
  useEffect(() => {
    if (map.current?.loaded()) pintarMisReportes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [misReportes]);

  function pintarMisReportes() {
    if (!map.current) return;
    const COLORES: Record<string, string> = {
      pendiente: "#f59e0b",
      en_camino: "#3b82f6",
      completado: "#22c55e",
    };
    misReportes.forEach((r: MiReporte & { lat?: number; lng?: number }) => {
      if (!r.lat || !r.lng) return;
      const el = document.createElement("div");
      el.style.cssText = `width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${COLORES[r.estado] ?? "#6b7280"};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);`;
      new mapboxgl.Marker({ element: el })
        .setLngLat([r.lng, r.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div style="font-size:13px;padding:4px 2px">
            <b>${r.tipo === "emergencia" ? "🚨 Punto crítico" : `♻️ ${r.material ?? "Reciclable"}`}</b><br/>
            <span style="color:${COLORES[r.estado]}">${r.estado.replace("_", " ")}</span>
          </div>`
        ))
        .addTo(map.current!);
    });
  }

  async function cargarHistorial() {
    if (!userId) return;
    setCargandoHistorial(true);
    const res = await fetch(`/api/reportes/mios?ciudadano_id=${userId}`);
    const data = await res.json();
    setMisReportes(data);
    // Guardar estados actuales para detectar cambios
    const estados: Record<string, string> = {};
    for (const r of data) estados[r.id] = r.estado;
    setPrevEstados(estados);
    setCargandoHistorial(false);
  }

  async function checkNotificaciones() {
    if (!userId) return;
    const res = await fetch(`/api/reportes/mios?ciudadano_id=${userId}`);
    const data: MiReporte[] = await res.json();
    const nuevasNoti: string[] = [];
    for (const r of data) {
      if (prevEstados[r.id] && prevEstados[r.id] !== r.estado) {
        if (r.estado === "en_camino") nuevasNoti.push(`🚴 Un reciclador va en camino a tu reporte de ${r.material ?? r.tipo}`);
        if (r.estado === "completado") nuevasNoti.push(`✅ Tu reporte de ${r.material ?? r.tipo} fue completado`);
      }
    }
    if (nuevasNoti.length > 0) {
      setNotificaciones((prev) => [...nuevasNoti, ...prev]);
      setMisReportes(data);
      const estados: Record<string, string> = {};
      for (const r of data) estados[r.id] = r.estado;
      setPrevEstados(estados);
    }
  }

  if (tipo) {
    return (
      <AuthGuard rolRequerido="ciudadano">
        <FormularioReporte tipo={tipo} onVolver={() => { setTipo(null); cargarHistorial(); }} />
      </AuthGuard>
    );
  }

  return (
    <AuthGuard rolRequerido="ciudadano">
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex flex-col">
      <div className="absolute top-4 right-4 z-10">
        <UserMenu />
      </div>

      {/* Notificaciones */}
      {notificaciones.length > 0 && (
        <div className="fixed top-4 left-4 right-16 z-50 space-y-2">
          {notificaciones.map((n, i) => (
            <div key={i} className="bg-white border border-green-200 rounded-xl shadow-lg px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-800">{n}</span>
              <button onClick={() => setNotificaciones((prev) => prev.filter((_, j) => j !== i))} className="ml-3 text-gray-400 hover:text-gray-600">×</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col items-center pt-10 px-6 pb-6">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🏘️</div>
          <h1 className="text-3xl font-bold text-green-800 mb-1">EcoRuta</h1>
          <p className="text-green-700 text-sm">Ciudadano</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-2xl p-1 shadow-sm mb-6 w-full max-w-sm">
          <button
            onClick={() => setTab("nuevo")}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${tab === "nuevo" ? "bg-green-600 text-white shadow" : "text-gray-500 hover:text-gray-700"}`}
          >
            ♻️ Nuevo
          </button>
          <button
            onClick={() => { setTab("historial"); cargarHistorial(); }}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition relative ${tab === "historial" ? "bg-green-600 text-white shadow" : "text-gray-500 hover:text-gray-700"}`}
          >
            📋 Historial
            {notificaciones.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {notificaciones.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setTab("mapa"); cargarHistorial(); }}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${tab === "mapa" ? "bg-green-600 text-white shadow" : "text-gray-500 hover:text-gray-700"}`}
          >
            🗺️ Mapa
          </button>
        </div>

        {tab === "nuevo" && (
          <>
            <StatsWidget />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-xl mt-6">
              <button
                onClick={() => setTipo("emergencia")}
                className="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-1 border-2 border-transparent hover:border-red-400 text-left"
              >
                <div className="text-4xl mb-3">🚨</div>
                <h2 className="text-lg font-bold text-gray-800 mb-1">Punto crítico</h2>
                <p className="text-sm text-gray-500">Basura acumulada indebidamente en la calle o espacio público</p>
              </button>
              <button
                onClick={() => setTipo("solicitud")}
                className="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-1 border-2 border-transparent hover:border-green-400 text-left"
              >
                <div className="text-4xl mb-3">♻️</div>
                <h2 className="text-lg font-bold text-gray-800 mb-1">Solicitar recolección</h2>
                <p className="text-sm text-gray-500">Tengo material reciclable listo para entregar</p>
              </button>
            </div>
          </>
        )}

        {tab === "historial" && (
          <div className="w-full max-w-xl">
            {cargandoHistorial ? (
              <p className="text-center text-gray-400 py-10">Cargando reportes...</p>
            ) : misReportes.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-gray-500">Aún no tienes reportes.<br/>¡Haz tu primer reporte!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {misReportes.map((r) => {
                  const est = ESTADO_LABEL[r.estado] ?? ESTADO_LABEL.pendiente;
                  return (
                    <div key={r.id} className="bg-white rounded-2xl shadow-sm p-4 flex gap-3 items-start">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {r.foto_url && <img src={r.foto_url} alt="foto" className="w-14 h-14 object-cover rounded-xl flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-800 capitalize">
                            {r.tipo === "emergencia" ? "🚨 Punto crítico" : `♻️ ${r.material ?? "Reciclable"}`}
                          </span>
                          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${est.color}`}>
                            {est.emoji} {est.label}
                          </span>
                        </div>
                        {r.nota && <p className="text-xs text-gray-400 truncate">{r.nota}</p>}
                        <p className="text-xs text-gray-300 mt-1">
                          {new Date(r.creado_en).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                        {r.estado === "completado" && r.peso_kg && (
                          <p className="text-xs text-green-600 mt-1 font-medium">✅ {r.peso_kg} kg recolectados</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "mapa" && (
          <div className="w-full max-w-xl">
            {/* Leyenda */}
            <div className="flex gap-3 mb-3 text-xs text-gray-600 justify-center">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"/> Pendiente</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"/> En camino</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"/> Completado</span>
            </div>
            <div ref={mapContainerRef} className="w-full rounded-2xl overflow-hidden shadow-md" style={{ height: "420px" }} />
            {misReportes.length === 0 && (
              <p className="text-center text-gray-400 text-sm mt-4">Haz tu primer reporte para verlo en el mapa</p>
            )}
          </div>
        )}
      </div>
    </main>
    </AuthGuard>
  );
}
