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
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace("/auth");
        return;
      }
      if (rolRequerido) {
        const { data: perfil } = await supabase
          .from("perfiles")
          .select("rol")
          .eq("id", user.id)
          .single();
        if (perfil?.rol !== rolRequerido) {
          // Redirigir a su vista correcta
          const destino = perfil?.rol === "reciclador" ? "/reciclador"
            : perfil?.rol === "admin" ? "/admin"
            : "/ciudadano";
          router.replace(destino);
          return;
        }
      }
      setVerificando(false);
    });
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
