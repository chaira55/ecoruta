"use client";

import { useState } from "react";
import FormularioReporte from "./FormularioReporte";
import StatsWidget from "../components/StatsWidget";
import AuthGuard from "../components/AuthGuard";
import UserMenu from "../components/UserMenu";

export default function CiudadanoPage() {
  const [tipo, setTipo] = useState<"emergencia" | "solicitud" | null>(null);

  if (tipo) {
    return (
      <AuthGuard rolRequerido="ciudadano">
        <FormularioReporte tipo={tipo} onVolver={() => setTipo(null)} />
      </AuthGuard>
    );
  }

  return (
    <AuthGuard rolRequerido="ciudadano">
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex flex-col items-center justify-center p-6">
      <div className="absolute top-4 right-4">
        <UserMenu />
      </div>

      <div className="text-center mb-10">
        <div className="text-5xl mb-3">🏘️</div>
        <h1 className="text-3xl font-bold text-green-800 mb-2">
          ¿Qué quieres reportar?
        </h1>
        <p className="text-green-700 text-sm max-w-xs mx-auto">
          Selecciona el tipo de reporte según tu situación
        </p>
      </div>

      <StatsWidget />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-xl mt-8">
        {/* Emergencia */}
        <button
          onClick={() => setTipo("emergencia")}
          className="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-1 border-2 border-transparent hover:border-red-400 text-left"
        >
          <div className="text-4xl mb-3">🚨</div>
          <h2 className="text-lg font-bold text-gray-800 mb-1">
            Punto crítico
          </h2>
          <p className="text-sm text-gray-500">
            Basura acumulada indebidamente en la calle o espacio público
          </p>
        </button>

        {/* Solicitud */}
        <button
          onClick={() => setTipo("solicitud")}
          className="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-1 border-2 border-transparent hover:border-green-400 text-left"
        >
          <div className="text-4xl mb-3">♻️</div>
          <h2 className="text-lg font-bold text-gray-800 mb-1">
            Solicitar recolección
          </h2>
          <p className="text-sm text-gray-500">
            Tengo material reciclable listo para entregar
          </p>
        </button>
      </div>
    </main>
    </AuthGuard>
  );
}
