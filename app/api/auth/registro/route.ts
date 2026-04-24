import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Cliente admin — usa service role, no envía emails
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  const { email, password, nombre, rol } = await request.json();

  if (!email || !password || !nombre || !rol) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  if (!["ciudadano", "reciclador", "admin"].includes(rol)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  // Crear usuario sin enviar email de confirmación
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: { nombre, rol },
    email_confirm: true, // confirma automáticamente sin enviar email
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Insertar perfil manualmente (por si el trigger falla)
  await supabaseAdmin.from("perfiles").upsert({
    id: data.user.id,
    rol,
    nombre,
  });

  return NextResponse.json({ ok: true });
}
