import Link from "next/link";

export default function RecicladorPage() {
  return (
    <main className="min-h-screen bg-blue-50 flex flex-col items-center justify-center p-6">
      <div className="text-5xl mb-4">🚴</div>
      <h1 className="text-2xl font-bold text-blue-800 mb-2">Vista Reciclador</h1>
      <p className="text-gray-500 mb-6">Próximamente — Bloque 3</p>
      <Link
        href="/"
        className="text-blue-700 underline hover:text-blue-900 text-sm"
      >
        ← Volver al inicio
      </Link>
    </main>
  );
}
