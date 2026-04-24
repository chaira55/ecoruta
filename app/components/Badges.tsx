"use client";

interface BadgeProps {
  total_kg: number;
  reportes_completados: number;
}

const BADGES = [
  { id: "primer_paso", emoji: "🌱", nombre: "Primer Paso", desc: "Primera recolección completada", min_reportes: 1, min_kg: 0 },
  { id: "eco_iniciante", emoji: "♻️", nombre: "Eco Iniciante", desc: "10 kg desviados del relleno", min_reportes: 0, min_kg: 10 },
  { id: "guardian", emoji: "🌿", nombre: "Guardián Verde", desc: "50 kg reciclados en comunidad", min_reportes: 0, min_kg: 50 },
  { id: "eco_guerrero", emoji: "🏆", nombre: "Eco Guerrero", desc: "100 kg desviados del relleno", min_reportes: 0, min_kg: 100 },
  { id: "ciudad_verde", emoji: "🏙️", nombre: "Ciudad Verde", desc: "50 recolecciones completadas", min_reportes: 50, min_kg: 0 },
  { id: "heroe", emoji: "🌍", nombre: "Héroe del Planeta", desc: "500 kg reciclados en comunidad", min_reportes: 0, min_kg: 500 },
];

export default function Badges({ total_kg, reportes_completados }: BadgeProps) {
  const desbloqueados = BADGES.filter(
    (b) => reportes_completados >= b.min_reportes && total_kg >= b.min_kg &&
      (b.min_reportes > 0 || b.min_kg > 0)
  );
  const bloqueados = BADGES.filter((b) => !desbloqueados.includes(b));

  if (desbloqueados.length === 0 && bloqueados.length === 0) return null;

  return (
    <div className="w-full max-w-3xl mt-4">
      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-3 text-center">
        Logros de la comunidad
      </p>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {BADGES.map((b) => {
          const desbloqueado = desbloqueados.includes(b);
          return (
            <div
              key={b.id}
              title={b.desc}
              className={`flex flex-col items-center p-2 rounded-xl text-center transition ${
                desbloqueado
                  ? "bg-white shadow-md"
                  : "bg-white/40 opacity-40 grayscale"
              }`}
            >
              <span className="text-2xl mb-1">{b.emoji}</span>
              <p className="text-xs font-semibold text-gray-700 leading-tight">{b.nombre}</p>
              {desbloqueado && (
                <span className="text-xs text-green-600 mt-0.5">✓</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
