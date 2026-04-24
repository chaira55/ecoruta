"use client";

import { useEffect, useState } from "react";
import Badges from "./Badges";

interface Stats {
  total_kg: number;
  co2_kg: number;
  reportes_completados: number;
}

export default function StatsWidget() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => null);
  }, []);

  if (!stats) return null;

  const arboles = Math.round(stats.co2_kg / 21); // 1 árbol absorbe ~21 kg CO₂/año
  const km = Math.round(stats.co2_kg / 0.21); // 0.21 kg CO₂/km en coche promedio

  return (
    <>
    <div className="w-full max-w-3xl bg-white/80 backdrop-blur rounded-2xl shadow-md p-5 mt-6">
      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-4 text-center">
        Impacto acumulado de la comunidad
      </p>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-green-700">{stats.total_kg} kg</p>
          <p className="text-xs text-gray-500 mt-1">desviados del relleno</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-emerald-600">{stats.co2_kg} kg</p>
          <p className="text-xs text-gray-500 mt-1">CO₂ evitado</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-teal-600">{stats.reportes_completados}</p>
          <p className="text-xs text-gray-500 mt-1">recolecciones</p>
        </div>
      </div>
      {(arboles > 0 || km > 0) && (
        <p className="text-xs text-center text-gray-400 mt-4">
          Equivale a plantar {arboles} árbol{arboles !== 1 ? "es" : ""} · {km.toLocaleString()} km sin conducir
        </p>
      )}
    </div>
    <Badges total_kg={stats.total_kg} reportes_completados={stats.reportes_completados} />
    </>
  );
}
