import Link from "next/link";

export default function CiudadanoPage() {
  return (
    <main className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-6">
      <div className="text-5xl mb-4">🏘️</div>
      <h1 className="text-2xl font-bold text-green-800 mb-2">
        Vista Ciudadano
      </h1>
      <p className="text-gray-500 mb-6">Próximamente — Bloque 2</p>
      <Link
        href="/"
        className="text-green-700 underline hover:text-green-900 text-sm"
      >
        ← Volver al inicio
      </Link>
    </main>
  );
}
