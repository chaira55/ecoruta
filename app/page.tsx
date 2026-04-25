"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Perfil {
  nombre: string;
  rol: string;
}

interface Stats {
  total_kg: number;
  co2_kg: number;
  reportes_completados: number;
}

export default function Home() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => null);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data } = await supabase
          .from("perfiles")
          .select("nombre, rol")
          .eq("id", session.user.id)
          .single();
        if (data) {
          setPerfil(data);
          if (data.rol === "ciudadano") { router.replace("/ciudadano"); return; }
          if (data.rol === "reciclador") { router.replace("/reciclador"); return; }
        }
      }
      setCargando(false);
    });
  }, [router]);

  async function cerrarSesion() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setPerfil(null);
  }

  const ROL_LINK: Record<string, string> = {
    ciudadano: "/ciudadano",
    reciclador: "/reciclador",
    admin: "/admin",
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl">♻️</span>
          <span className="text-xl font-bold text-green-800">EcoRuta</span>
        </div>
        {!cargando && (
          perfil ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-green-800 font-medium hidden sm:block">Hola, {perfil.nombre}</span>
              <Link href={ROL_LINK[perfil.rol] ?? "/ciudadano"} className="bg-green-600 text-white text-sm px-4 py-2 rounded-xl font-semibold hover:bg-green-700 transition">
                Mi panel
              </Link>
              <button onClick={cerrarSesion} className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-2 rounded-xl transition">
                Salir
              </button>
            </div>
          ) : (
            <Link href="/auth" className="bg-green-600 text-white text-sm px-5 py-2 rounded-xl font-semibold hover:bg-green-700 transition shadow-sm">
              Iniciar sesión
            </Link>
          )
        )}
      </nav>

      {/* Hero */}
      <section className="text-center px-6 pt-10 pb-12 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
          🌎 Medellín más limpia, un reporte a la vez
        </div>
        <h1 className="text-5xl font-extrabold text-gray-900 mb-5 leading-tight">
          Conectamos ciudadanos<br/>con recicladores
        </h1>
        <p className="text-xl text-gray-500 mb-8 max-w-xl mx-auto">
          Reporta basura, solicita recolección y rastrea el impacto ambiental de tu comunidad en tiempo real.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/ciudadano" className="bg-green-600 text-white px-7 py-3.5 rounded-2xl font-semibold text-base hover:bg-green-700 transition shadow-md">
            Hacer un reporte
          </Link>
          <Link href="/auth" className="bg-white text-green-700 px-7 py-3.5 rounded-2xl font-semibold text-base hover:bg-green-50 transition border border-green-200 shadow-sm">
            Soy reciclador
          </Link>
        </div>
      </section>

      {/* Link leaderboard */}
      <div className="text-center mb-4">
        <Link href="/leaderboard" className="inline-flex items-center gap-2 text-sm text-green-700 hover:text-green-900 font-medium underline underline-offset-2">
          🏆 Ver ranking de recicladores
        </Link>
      </div>

      {/* Stats en vivo */}
      {stats && (
        <section className="max-w-3xl mx-auto px-6 mb-14">
          <div className="bg-white rounded-3xl shadow-lg p-6 border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center mb-5">Impacto acumulado en Medellín</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-4xl font-extrabold text-green-600">{stats.total_kg}</p>
                <p className="text-sm text-gray-500 mt-1">kg desviados<br/>del relleno</p>
              </div>
              <div className="border-x border-gray-100">
                <p className="text-4xl font-extrabold text-emerald-600">{stats.co2_kg}</p>
                <p className="text-sm text-gray-500 mt-1">kg CO₂<br/>evitado</p>
              </div>
              <div>
                <p className="text-4xl font-extrabold text-teal-600">{stats.reportes_completados}</p>
                <p className="text-sm text-gray-500 mt-1">recolecciones<br/>completadas</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Roles */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold text-gray-800 text-center mb-8">¿Cómo quieres participar?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              emoji: "🏘️",
              title: "Ciudadano",
              desc: "Reporta puntos críticos o solicita que un reciclador recoja tu material reciclable.",
              href: "/ciudadano",
              border: "hover:border-green-400",
            },
            {
              emoji: "🚴",
              title: "Reciclador",
              desc: "Ve las solicitudes más cercanas, traza tu ruta óptima y registra tu impacto.",
              href: "/reciclador",
              border: "hover:border-blue-400",
            },
            {
              emoji: "📊",
              title: "Administrador",
              desc: "Monitorea el mapa de calor y las métricas de impacto de toda la ciudad.",
              href: "/admin",
              border: "hover:border-purple-400",
            },
          ].map((r) => (
            <Link key={r.title} href={r.href} className="group">
              <div className={`bg-white rounded-2xl p-7 shadow-md hover:shadow-xl transition-all duration-200 group-hover:-translate-y-1 border-2 border-transparent ${r.border}`}>
                <div className="text-5xl mb-4">{r.emoji}</div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">{r.title}</h3>
                <p className="text-sm text-gray-500">{r.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
