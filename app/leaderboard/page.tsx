"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Entrada {
  id: string;
  nombre: string;
  total_kg: number;
  co2_kg: number;
  completados: number;
}

const MEDALLAS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [lista, setLista] = useState<Entrada[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => { setLista(d); setCargando(false); })
      .catch(() => setCargando(false));
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="text-green-700 hover:text-green-900 text-sm">← Inicio</Link>
        </div>

        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏆</div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-1">Top Recicladores</h1>
          <p className="text-gray-500 text-sm">Medellín — ranking por kg recolectados</p>
        </div>

        {cargando ? (
          <div className="text-center py-16 text-gray-400">Cargando ranking...</div>
        ) : lista.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-500">Aún no hay recicladores con reportes completados.<br/>¡Sé el primero!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lista.map((entry, i) => (
              <div
                key={entry.id}
                className={`bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 border-2 ${
                  i === 0 ? "border-yellow-300 shadow-yellow-100" :
                  i === 1 ? "border-gray-300" :
                  i === 2 ? "border-amber-600/30" :
                  "border-transparent"
                }`}
              >
                {/* Posición */}
                <div className="text-2xl w-8 text-center flex-shrink-0">
                  {MEDALLAS[i] ?? <span className="text-gray-400 font-bold text-base">#{i + 1}</span>}
                </div>

                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                  i === 0 ? "bg-yellow-400" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-amber-600" : "bg-green-500"
                }`}>
                  {entry.nombre.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 truncate">{entry.nombre}</p>
                  <p className="text-xs text-gray-400">{entry.completados} recolecciones</p>
                </div>

                {/* Stats */}
                <div className="text-right flex-shrink-0">
                  <p className="font-extrabold text-green-700 text-lg">{entry.total_kg} kg</p>
                  <p className="text-xs text-emerald-600">{entry.co2_kg} kg CO₂</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 mb-3">¿Eres reciclador? Únete y aparece en el ranking.</p>
          <Link href="/auth" className="inline-block bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition">
            Registrarme como reciclador
          </Link>
        </div>
      </div>
    </main>
  );
}
