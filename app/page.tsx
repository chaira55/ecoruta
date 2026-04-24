import Link from "next/link";
import StatsWidget from "./components/StatsWidget";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="text-6xl mb-4">♻️</div>
        <h1 className="text-4xl font-bold text-green-800 mb-3">
          EcoRuta Inteligente
        </h1>
        <p className="text-lg text-green-700 max-w-md mx-auto">
          Conectando ciudadanos con recicladores en Medellín para un futuro más
          limpio
        </p>
      </div>

      {/* Role selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
        {/* Ciudadano */}
        <Link href="/ciudadano" className="group">
          <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-200 group-hover:-translate-y-1 border-2 border-transparent hover:border-green-400 cursor-pointer">
            <div className="text-5xl mb-4 text-center">🏘️</div>
            <h2 className="text-xl font-bold text-gray-800 text-center mb-2">
              Ciudadano
            </h2>
            <p className="text-sm text-gray-500 text-center">
              Reporta puntos críticos o solicita recolección de reciclables
            </p>
          </div>
        </Link>

        {/* Reciclador */}
        <Link href="/reciclador" className="group">
          <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-200 group-hover:-translate-y-1 border-2 border-transparent hover:border-blue-400 cursor-pointer">
            <div className="text-5xl mb-4 text-center">🚴</div>
            <h2 className="text-xl font-bold text-gray-800 text-center mb-2">
              Reciclador
            </h2>
            <p className="text-sm text-gray-500 text-center">
              Visualiza solicitudes cercanas y optimiza tu ruta de recolección
            </p>
          </div>
        </Link>

        {/* Admin */}
        <Link href="/admin" className="group">
          <div className="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-200 group-hover:-translate-y-1 border-2 border-transparent hover:border-purple-400 cursor-pointer">
            <div className="text-5xl mb-4 text-center">📊</div>
            <h2 className="text-xl font-bold text-gray-800 text-center mb-2">
              Administrador
            </h2>
            <p className="text-sm text-gray-500 text-center">
              Monitorea métricas de impacto y mapa de calor de la ciudad
            </p>
          </div>
        </Link>
      </div>

      {/* Stats en vivo */}
      <StatsWidget />
    </main>
  );
}
