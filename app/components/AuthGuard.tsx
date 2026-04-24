"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Rol } from "@/lib/types";

interface Props {
  rolRequerido?: Rol;
  children: React.ReactNode;
}

export default function AuthGuard({ rolRequerido, children }: Props) {
  const router = useRouter();
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function verificar() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/auth");
        return;
      }

      if (!rolRequerido) {
        setVerificando(false);
        return;
      }

      // Intentar obtener perfil con reintento (el trigger puede tardar)
      let perfil = null;
      for (let i = 0; i < 3; i++) {
        const { data } = await supabase
          .from("perfiles")
          .select("rol")
          .eq("id", session.user.id)
          .single();
        if (data) { perfil = data; break; }
        await new Promise((r) => setTimeout(r, 500));
      }

      // Si no hay perfil todavía, dejamos pasar
      if (!perfil) {
        setVerificando(false);
        return;
      }

      // Admin puede acceder a cualquier vista
      if (perfil.rol === "admin") {
        setVerificando(false);
        return;
      }

      if (perfil.rol !== rolRequerido) {
        const destino = perfil.rol === "reciclador" ? "/reciclador" : "/ciudadano";
        router.replace(destino);
        return;
      }

      setVerificando(false);
    }

    verificar();
  }, [router, rolRequerido]);

  if (verificando) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <p className="text-green-700 font-medium">Cargando...</p>
      </div>
    );
  }

  return <>{children}</>;
}
