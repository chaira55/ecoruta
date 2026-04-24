"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Material } from "@/lib/types";

interface Props {
  tipo: "emergencia" | "solicitud";
  onVolver: () => void;
}

const MATERIALES: { valor: Material; etiqueta: string; emoji: string }[] = [
  { valor: "carton", etiqueta: "Cartón / Papel", emoji: "📦" },
  { valor: "plastico", etiqueta: "Plástico", emoji: "🧴" },
  { valor: "vidrio", etiqueta: "Vidrio", emoji: "🍾" },
  { valor: "metal", etiqueta: "Metal / Aluminio", emoji: "🥫" },
  { valor: "organico", etiqueta: "Orgánico", emoji: "🌿" },
];

export default function FormularioReporte({ tipo, onVolver }: Props) {
  const [fotos, setFotos] = useState<File[]>([]);
  const [fotoPreviews, setFotoPreviews] = useState<string[]>([]);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [iaDetectado, setIaDetectado] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null);
  const [cargandoUbicacion, setCargandoUbicacion] = useState(false);
  const [analizandoIA, setAnalizandoIA] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statsGlobal, setStatsGlobal] = useState<{ total_kg: number; co2_kg: number } | null>(null);
  const inputFotoRef = useRef<HTMLInputElement>(null);
  const MAX_FOTOS = 3;

  const esEmergencia = tipo === "emergencia";

  useEffect(() => {
    if (exito) {
      fetch("/api/stats")
        .then((r) => r.json())
        .then((d) => setStatsGlobal(d))
        .catch(() => null);
    }
  }, [exito]);

  function toggleMaterial(m: Material) {
    setMateriales((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  }

  function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fotos.length >= MAX_FOTOS) return;
    setFotos((prev) => [...prev, file]);
    setFotoPreviews((prev) => [...prev, URL.createObjectURL(file)]);
    setIaDetectado(null);
    e.target.value = "";
  }

  function quitarFoto(index: number) {
    setFotos((prev) => prev.filter((_, i) => i !== index));
    setFotoPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  // Comprime la imagen a máx 800px y calidad 0.7 para evitar límite de tamaño
  async function comprimirImagen(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
          else { width = Math.round((width * MAX) / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        resolve(dataUrl.split(",")[1]);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function analizarConIA(file: File) {
    setAnalizandoIA(true);
    try {
      const base64 = await comprimirImagen(file);

      const res = await fetch("/api/vision-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, media_type: "image/jpeg" }),
      });

      const resultado = await res.json();

      if (!res.ok) throw new Error(resultado.error ?? `HTTP ${res.status}`);

      if (resultado.tipo_material) {
        setMateriales([resultado.tipo_material as Material]);
        setIaDetectado(resultado.tipo_material);
      } else {
        setIaDetectado("no_detectado");
      }
    } catch (err) {
      setIaDetectado("error:" + (err instanceof Error ? err.message : String(err)));
    } finally {
      setAnalizandoIA(false);
    }
  }

  function obtenerUbicacion() {
    setCargandoUbicacion(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setCargandoUbicacion(false);
      },
      () => {
        setError("No se pudo obtener tu ubicación. Activa el GPS e intenta de nuevo.");
        setCargandoUbicacion(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (fotos.length === 0) return setError("Agrega al menos una foto del reporte.");
    if (!ubicacion) return setError("Comparte tu ubicación antes de enviar.");
    if (!esEmergencia && materiales.length === 0)
      return setError("Selecciona al menos un tipo de material.");

    setEnviando(true);
    setError(null);

    try {
      const supabase = createClient();

      // Subir todas las fotos
      const urls: string[] = [];
      for (const foto of fotos) {
        const ext = foto.name.split(".").pop() ?? "jpg";
        const nombreArchivo = `reporte-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("fotos-reportes")
          .upload(nombreArchivo, foto);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("fotos-reportes")
          .getPublicUrl(nombreArchivo);
        urls.push(urlData.publicUrl);
      }

      const res = await fetch("/api/reportes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          material: esEmergencia ? null : materiales[0],
          materiales_extra: materiales.slice(1),
          lat: ubicacion.lat,
          lng: ubicacion.lng,
          foto_url: urls[0],
          fotos_extra: urls.slice(1),
          nota: nota || null,
        }),
      });

      if (!res.ok) throw new Error("Error al enviar el reporte");
      setExito(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setEnviando(false);
    }
  }

  if (exito) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-green-800 mb-2">¡Reporte enviado!</h2>
        <p className="text-green-700 mb-6 max-w-xs">
          {esEmergencia
            ? "El punto crítico fue registrado. Las autoridades serán notificadas."
            : "Tu solicitud está activa. Un reciclador cercano la verá pronto."}
        </p>

        {statsGlobal && (
          <div className="bg-white rounded-2xl shadow-md p-5 mb-6 max-w-xs w-full">
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-3">
              Impacto acumulado en Medellín
            </p>
            <div className="flex justify-around">
              <div>
                <p className="text-2xl font-bold text-green-700">{statsGlobal.total_kg} kg</p>
                <p className="text-xs text-gray-500">desviados del relleno</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{statsGlobal.co2_kg} kg</p>
                <p className="text-xs text-gray-500">CO₂ evitado</p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onVolver}
          className="bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition"
        >
          Hacer otro reporte
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-6">
      <div className="max-w-lg mx-auto">
        <button onClick={onVolver} className="text-sm text-green-700 hover:text-green-900 mb-6 block">
          ← Volver
        </button>

        <div className="bg-white rounded-2xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">{esEmergencia ? "🚨" : "♻️"}</span>
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                {esEmergencia ? "Reportar punto crítico" : "Solicitar recolección"}
              </h2>
              <p className="text-sm text-gray-500">
                {esEmergencia
                  ? "Basura acumulada en espacio público"
                  : "Material reciclable listo para entregar"}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Fotos — hasta 3 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Fotos <span className="text-red-500">*</span>
                <span className="ml-1 text-xs font-normal text-gray-400">({fotoPreviews.length}/{MAX_FOTOS})</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {fotoPreviews.map((preview, i) => (
                  <div key={i} className="relative aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt={`Foto ${i + 1}`} className="w-full h-full object-cover rounded-xl" />
                    <button
                      type="button"
                      onClick={() => quitarFoto(i)}
                      className="absolute top-1 right-1 bg-white rounded-full w-6 h-6 flex items-center justify-center text-xs text-gray-600 shadow font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {fotoPreviews.length < MAX_FOTOS && (
                  <button
                    type="button"
                    onClick={() => inputFotoRef.current?.click()}
                    className="aspect-square border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-green-400 hover:text-green-500 transition"
                  >
                    <span className="text-2xl">📷</span>
                    <span className="text-xs mt-1">Agregar</span>
                  </button>
                )}
              </div>
              <input
                ref={inputFotoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFoto}
              />
            </div>

            {/* Tipo de material — selección múltiple */}
            {!esEmergencia && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Tipo de material <span className="text-red-500">*</span>
                    <span className="ml-1 text-xs font-normal text-gray-400">(puedes seleccionar varios)</span>
                  </label>
                  {analizandoIA && (
                    <span className="text-xs text-blue-500">🤖 analizando...</span>
                  )}
                  {!analizandoIA && iaDetectado && iaDetectado !== "error" && iaDetectado !== "no_detectado" && (
                    <span className="text-xs text-green-600">✓ IA detectó: {iaDetectado}</span>
                  )}
                  {!analizandoIA && iaDetectado === "no_detectado" && (
                    <span className="text-xs text-gray-400">IA no detectó material</span>
                  )}
                  {!analizandoIA && iaDetectado?.startsWith("error") && (
                    <span className="text-xs text-red-400">{iaDetectado}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {MATERIALES.map((m) => (
                    <button
                      key={m.valor}
                      type="button"
                      onClick={() => toggleMaterial(m.valor)}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition ${
                        materiales.includes(m.valor)
                          ? "border-green-500 bg-green-50 text-green-800"
                          : "border-gray-200 text-gray-600 hover:border-green-300"
                      }`}
                    >
                      <span>{m.emoji}</span>
                      {m.etiqueta}
                      {materiales.includes(m.valor) && (
                        <span className="ml-auto text-green-500">✓</span>
                      )}
                    </button>
                  ))}
                </div>
                {materiales.length > 0 && (
                  <p className="text-xs text-green-600 mt-2">
                    Seleccionados: {materiales.map((m) => MATERIALES.find((x) => x.valor === m)?.etiqueta).join(", ")}
                  </p>
                )}
              </div>
            )}

            {/* Ubicación */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ubicación <span className="text-red-500">*</span>
              </label>
              {ubicacion ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
                  <span className="text-green-600">📍</span>
                  <span className="text-sm text-green-700">
                    {ubicacion.lat.toFixed(5)}, {ubicacion.lng.toFixed(5)}
                  </span>
                  <button type="button" onClick={obtenerUbicacion} className="ml-auto text-xs text-green-600 underline">
                    Actualizar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={obtenerUbicacion}
                  disabled={cargandoUbicacion}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-green-400 hover:text-green-600 transition disabled:opacity-50"
                >
                  {cargandoUbicacion ? "Obteniendo ubicación..." : "📍 Compartir mi ubicación"}
                </button>
              )}
            </div>

            {/* Nota opcional */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nota (opcional)
              </label>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder={
                  esEmergencia
                    ? "Describe el problema: cantidad de basura, tiempo acumulada..."
                    : "Cantidad aproximada, instrucciones para el reciclador..."
                }
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold text-base hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enviando ? "Enviando..." : "Enviar reporte"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
