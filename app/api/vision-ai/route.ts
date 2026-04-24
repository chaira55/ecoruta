import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  const { foto_url } = await request.json();

  if (!foto_url) {
    return NextResponse.json({ error: "foto_url requerida" }, { status: 400 });
  }

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "url", url: foto_url },
          },
          {
            type: "text",
            text: `Analiza esta imagen de residuos reciclables. Responde ÚNICAMENTE con un objeto JSON, sin markdown, sin explicaciones, sin texto adicional.

El JSON debe tener exactamente esta estructura:
{"es_residuo":true,"tipo_material":"plastico","confianza":"alta"}

Reglas:
- es_residuo: true si ves cualquier residuo o material reciclable, false si la imagen no tiene residuos
- tipo_material debe ser exactamente una de estas palabras (sin tildes, sin mayúsculas): carton, plastico, vidrio, metal, organico
- Si hay varios tipos, elige el predominante
- confianza: alta, media o baja
- Si no hay residuos: {"es_residuo":false,"tipo_material":null,"confianza":"alta"}`,
          },
        ],
      },
    ],
  });

  try {
    const text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";
    // Extraer JSON aunque venga con texto alrededor
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found");
    const result = JSON.parse(match[0]);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "No se pudo parsear la respuesta de IA" },
      { status: 500 }
    );
  }
}
