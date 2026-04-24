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
            text: `Analiza esta imagen y responde SOLO con JSON válido, sin texto adicional:
{
  "es_residuo": true/false,
  "tipo_material": "carton" | "plastico" | "vidrio" | "metal" | "organico" | null,
  "confianza": "alta" | "media" | "baja"
}
Si no hay residuos visibles, es_residuo debe ser false y tipo_material null.`,
          },
        ],
      },
    ],
  });

  try {
    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    const result = JSON.parse(text);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "No se pudo parsear la respuesta de IA" },
      { status: 500 }
    );
  }
}
