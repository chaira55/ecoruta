"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UserMenu() {
  const router = useRouter();
  const [nombre, setNombre] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data } = await supabase
        .from("perfiles")
        .select("nombre")
        .eq("id", session.user.id)
        .single();
      if (data) setNombre(data.nombre);
    });
  }, []);

  async function cerrarSesion() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth");
  }

  if (!nombre) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-gray-700 hidden sm:block">
        Hola, {nombre}
      </span>
      <button
        onClick={cerrarSesion}
        className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-1.5 rounded-xl transition"
      >
        Salir
      </button>
    </div>
  );
}
