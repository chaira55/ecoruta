"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"login" | "registro">("login");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<"ciudadano" | "reciclador" | "admin">("ciudadano");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ROLES = [
    { valor: "ciudadano", emoji: "🏘️", label: "Ciudadano" },
    { valor: "reciclador", emoji: "🚴", label: "Reciclador" },
    { valor: "admin", emoji: "📊", label: "Administrador" },
  ] as const;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const supabase = createClient();

    if (modo === "registro") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nombre, rol } },
      });
      if (error) return setError(error.message), setCargando(false);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setError("Correo o contraseña incorrectos"), setCargando(false);
    }

    // Obtener perfil para redirigir según rol
    const supabase2 = createClient();
    const { data: { user } } = await supabase2.auth.getUser();
    if (user) {
      const { data: perfil } = await supabase2
        .from("perfiles")
        .select("rol")
        .eq("id", user.id)
        .single();
      const destino = perfil?.rol === "reciclador" ? "/reciclador"
        : perfil?.rol === "admin" ? "/admin"
        : "/ciudadano";
      router.push(destino);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">♻️</div>
          <h1 className="text-2xl font-bold text-green-800">EcoRuta Inteligente</h1>
          <p className="text-sm text-gray-500 mt-1">
            {modo === "login" ? "Inicia sesión para continuar" : "Crea tu cuenta"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {modo === "registro" && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Tu nombre completo"
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Rol</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r.valor}
                      type="button"
                      onClick={() => setRol(r.valor)}
                      className={`flex flex-col items-center p-3 rounded-xl border-2 text-sm font-medium transition ${
                        rol === r.valor
                          ? "border-green-500 bg-green-50 text-green-800"
                          : "border-gray-200 text-gray-600 hover:border-green-300"
                      }`}
                    >
                      <span className="text-2xl mb-1">{r.emoji}</span>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Correo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition disabled:opacity-50"
          >
            {cargando ? "Cargando..." : modo === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          {modo === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
          <button
            onClick={() => { setModo(modo === "login" ? "registro" : "login"); setError(null); }}
            className="text-green-600 font-semibold hover:underline"
          >
            {modo === "login" ? "Regístrate" : "Inicia sesión"}
          </button>
        </p>
      </div>
    </main>
  );
}
