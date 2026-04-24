"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import StatsWidget from "./components/StatsWidget";

interface Perfil {
  nombre: string;
  rol: string;
}

export default function Home() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data } = await supabase
          .from("perfiles")
          .select("nombre, rol")
          .eq("id", user.id)
          .single();
        setPerfil(data);
      }
      setCargando(false);
    });
  }, []);

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
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex flex-col items-center justify-center p-6">
      {/* Header con sesión */}
      <div className="absolute top-4 right-4 flex items-center gap-3">
        {!cargando && (
          perfil ? (
            <>
              <span className="text-sm text-green-800 font-medium hidden sm:block">
                Hola, {perfil.nombre}
              </span>
              <Link
                href={ROL_LINK[perfil.rol] ?? "/ciudadano"}
                className="bg-green-600 text-white text-sm px-4 py-2 rounded-xl font-semibold hover:bg-green-700 transition"
              >
                Ir a mi vista
              </Link>
              <button
                onClick={cerrarSesion}
                className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-2 rounded-xl transition"
              >
                Salir
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              className="bg-green-600 text-white text-sm px-4 py-2 rounded-xl font-semibold hover:bg-green-700 transition"
            >
              Iniciar sesión
            </Link>
          )
        )}
      </div>

      {/* Header */}
      <div className="text-center mb-12">
        <div className="text-6xl mb-4">♻️</div>
        <h1 className="text-4xl font-bold text-green-800 mb-3">
          EcoRuta Inteligente
        </h1>
        <p className="text-lg text-green-700 max-w-md mx-auto">
          Conectando ciudadanos con recicladores en Medellín para un futuro más limpio
        </p>
      </div>

      {/* Role selector — filtrado según rol del usuario */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
        {(!perfil || perfil.rol === "ciudadano" || perfil.rol === "admin") && (
          <Link href="/ciudadano" className="group">
            <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-200 group-hover:-translate-y-1 border-2 border-transparent hover:border-green-400 cursor-pointer">
              <div className="text-5xl mb-4 text-center">🏘️</div>
              <h2 className="text-xl font-bold text-gray-800 text-center mb-2">Ciudadano</h2>
              <p className="text-sm text-gray-500 text-center">
                Reporta puntos críticos o solicita recolección de reciclables
              </p>
            </div>
          </Link>
        )}

        {(!perfil || perfil.rol === "reciclador" || perfil.rol === "admin") && (
          <Link href="/reciclador" className="group">
            <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-200 group-hover:-translate-y-1 border-2 border-transparent hover:border-blue-400 cursor-pointer">
              <div className="text-5xl mb-4 text-center">🚴</div>
              <h2 className="text-xl font-bold text-gray-800 text-center mb-2">Reciclador</h2>
              <p className="text-sm text-gray-500 text-center">
                Visualiza solicitudes cercanas y optimiza tu ruta de recolección
              </p>
            </div>
          </Link>
        )}

        {(!perfil || perfil.rol === "admin") && (
          <Link href="/admin" className="group">
            <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-200 group-hover:-translate-y-1 border-2 border-transparent hover:border-purple-400 cursor-pointer">
              <div className="text-5xl mb-4 text-center">📊</div>
              <h2 className="text-xl font-bold text-gray-800 text-center mb-2">Administrador</h2>
              <p className="text-sm text-gray-500 text-center">
                Monitorea métricas de impacto y mapa de calor de la ciudad
              </p>
            </div>
          </Link>
        )}
      </div>

      {/* Stats en vivo */}
      <StatsWidget />
    </main>
  );
}
