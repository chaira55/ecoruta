import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { base64, media_type } = body;

  if (!base64) {
    return NextResponse.json({ error: "base64 requerido" }, { status: 400 });
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
            source: {
              type: "base64",
              media_type: (media_type as "image/jpeg" | "image/png" | "image/gif" | "image/webp") ?? "image/jpeg",
              data: base64,
            },
          },
          {
            type: "text",
            text: `Analiza esta imagen de residuos reciclables. Responde ÚNICAMENTE con un objeto JSON, sin markdown, sin explicaciones.

Estructura exacta:
{"es_residuo":true,"tipo_material":"plastico","confianza":"alta"}

Reglas:
- es_residuo: true si ves cualquier residuo o material reciclable
- tipo_material (sin tildes, minúsculas): carton, plastico, vidrio, metal, organico
- Si hay varios tipos, elige el predominante
- confianza: alta, media o baja
- Sin residuos: {"es_residuo":false,"tipo_material":null,"confianza":"alta"}`,
          },
        ],
      },
    ],
  });

  try {
    const text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";
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
