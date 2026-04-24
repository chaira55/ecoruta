# EcoRuta Inteligente

Plataforma que conecta ciudadanos con recicladores en Medellín para reducir residuos en el relleno sanitario y medir el impacto ambiental en tiempo real.

**Demo en vivo:** https://ecoruta-phi.vercel.app

---

## ¿Qué hace?

| Rol | Funcionalidad |
|-----|---------------|
| Ciudadano | Reporta puntos críticos de basura o solicita recolección de reciclables con foto y ubicación GPS |
| Reciclador | Ve solicitudes cercanas en un mapa, genera ruta óptima y registra el peso recolectado |
| Administrador | Monitorea KPIs, mapa de calor y métricas de impacto CO₂ de toda la ciudad |

---

## Stack tecnológico

- **Frontend:** Next.js 14 · React · Tailwind CSS
- **Base de datos:** Supabase (PostgreSQL + PostGIS)
- **Mapas:** Mapbox GL JS — heatmap, pins, rutas optimizadas
- **IA:** Claude Haiku (visión — detección de material reciclable)
- **Realtime:** Supabase Realtime WebSockets
- **Deploy:** Vercel

---

## Vistas

### Ciudadano
Selecciona tipo de reporte (punto crítico o solicitud de recolección), toma una foto, comparte ubicación GPS y envía. Al completarse, ve el impacto acumulado de la comunidad en kg desviados del relleno y CO₂ evitado.

### Reciclador
Mapa interactivo con todos los reportes activos. Genera ruta óptima entre solicitudes pendientes. Cambia estados (Pendiente → En camino → Completado) e ingresa el peso recolectado en kg.

### Administrador
Dashboard con 6 KPIs: total reportes, kg recolectados, CO₂ evitado, emergencias activas, recicladores activos y tasa de completitud. Alterna entre mapa de calor y pins individuales.

---

## Correrlo localmente

```bash
git clone https://github.com/chaira55/ecoruta.git
cd ecoruta
npm install
```

Crea un archivo `.env.local` con:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_MAPBOX_TOKEN=...
ANTHROPIC_API_KEY=...
```

```bash
npm run dev
```

Abre http://localhost:3000

---

## Impacto ambiental

El sistema calcula el CO₂ evitado por material reciclado usando factores reales:

| Material | kg CO₂ evitado por kg reciclado |
|----------|--------------------------------|
| Metal / Aluminio | 9.0 |
| Plástico | 1.5 |
| Cartón / Papel | 0.9 |
| Orgánico | 0.5 |
| Vidrio | 0.3 |

---

## Hackathon UCLA 2026

Proyecto desarrollado en 24 horas para la hackathon de la Universidad Católica Luis Amigó, Medellín 2026.
