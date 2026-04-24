"use client";

import { useState, useRef } from "react";
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
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [material, setMaterial] = useState<Material | null>(null);
  const [nota, setNota] = useState("");
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null);
  const [cargandoUbicacion, setCargandoUbicacion] = useState(false);
  const [analizandoIA, setAnalizandoIA] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const esEmergencia = tipo === "emergencia";

  function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFoto(file);
    setFotoPreview(URL.createObjectURL(file));
    if (!esEmergencia) analizarConIA(file);
  }

  async function analizarConIA(file: File) {
    setAnalizandoIA(true);
    try {
      const supabase = createClient();
      const nombre = `temp-${Date.now()}-${file.name}`;
      await supabase.storage.from("fotos-reportes").upload(nombre, file);
      const { data } = supabase.storage.from("fotos-reportes").getPublicUrl(nombre);

      const res = await fetch("/api/vision-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foto_url: data.publicUrl }),
      });
      const resultado = await res.json();
      if (resultado.tipo_material) {
        setMaterial(resultado.tipo_material as Material);
      }
    } catch {
      // Si falla la IA, el usuario selecciona manualmente
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
    if (!foto) return setError("Agrega una foto del reporte.");
    if (!ubicacion) return setError("Comparte tu ubicación antes de enviar.");
    if (!esEmergencia && !material) return setError("Selecciona el tipo de material.");

    setEnviando(true);
    setError(null);

    try {
      const supabase = createClient();

      // Subir foto definitiva
      const nombreArchivo = `${Date.now()}-${foto.name}`;
      const { error: uploadError } = await supabase.storage
        .from("fotos-reportes")
        .upload(nombreArchivo, foto);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("fotos-reportes")
        .getPublicUrl(nombreArchivo);

      // Insertar reporte
      const res = await fetch("/api/reportes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          material: esEmergencia ? null : material,
          lat: ubicacion.lat,
          lng: ubicacion.lng,
          foto_url: urlData.publicUrl,
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
        <h2 className="text-2xl font-bold text-green-800 mb-2">
          ¡Reporte enviado!
        </h2>
        <p className="text-green-700 mb-6 max-w-xs">
          {esEmergencia
            ? "El punto crítico fue registrado. Las autoridades serán notificadas."
            : "Tu solicitud está activa. Un reciclador cercano la verá pronto."}
        </p>
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
            {/* Foto */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Foto <span className="text-red-500">*</span>
              </label>
              {fotoPreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fotoPreview}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-xl"
                  />
                  {analizandoIA && (
                    <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                      <p className="text-white text-sm font-medium">🤖 Analizando con IA...</p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => { setFoto(null); setFotoPreview(null); setMaterial(null); }}
                    className="absolute top-2 right-2 bg-white rounded-full px-2 py-1 text-xs text-gray-600 shadow"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputFotoRef.current?.click()}
                  className="w-full h-36 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-green-400 hover:text-green-500 transition"
                >
                  <span className="text-3xl mb-1">📷</span>
                  <span className="text-sm">Toca para tomar foto</span>
                </button>
              )}
              <input
                ref={inputFotoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFoto}
              />
            </div>

            {/* Tipo de material (solo solicitud) */}
            {!esEmergencia && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tipo de material <span className="text-red-500">*</span>
                  {analizandoIA && (
                    <span className="ml-2 text-xs text-blue-500 font-normal">
                      detectando con IA...
                    </span>
                  )}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {MATERIALES.map((m) => (
                    <button
                      key={m.valor}
                      type="button"
                      onClick={() => setMaterial(m.valor)}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition ${
                        material === m.valor
                          ? "border-green-500 bg-green-50 text-green-800"
                          : "border-gray-200 text-gray-600 hover:border-green-300"
                      }`}
                    >
                      <span>{m.emoji}</span>
                      {m.etiqueta}
                    </button>
                  ))}
                </div>
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
                  <button
                    type="button"
                    onClick={obtenerUbicacion}
                    className="ml-auto text-xs text-green-600 underline"
                  >
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
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
                {error}
              </p>
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
