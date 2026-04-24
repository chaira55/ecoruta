import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-purple-50 flex flex-col items-center justify-center p-6">
      <div className="text-5xl mb-4">📊</div>
      <h1 className="text-2xl font-bold text-purple-800 mb-2">Vista Admin</h1>
      <p className="text-gray-500 mb-6">Próximamente — Bloque 5</p>
      <Link
        href="/"
        className="text-purple-700 underline hover:text-purple-900 text-sm"
      >
        ← Volver al inicio
      </Link>
    </main>
  );
}
