import { NextResponse } from "next/server";
import OpenAI from "openai";

type ChatMsg = { role: "system" | "user" | "assistant" | "function"; content: string; name?: string };
import { generateStudyContent } from "@/lib/openai";
import { getInstitutionalKnowledge } from "@/lib/institutional-knowledge";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const prompt = String(formData.get("text") ?? "").trim();
  const file = formData.get("file");
  const effectivePrompt = prompt || "Responde de forma clara y académica a la solicitud del usuario.";

  let extractedText = "";
  let sourceLabel = prompt ? "solicitud del usuario" : "tema solicitado";

  if (file instanceof File && file.size > 0) {
    sourceLabel = file.name;

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { PDFParse } = await import("pdf-parse");
      const parsed = await new PDFParse({ data: buffer }).getText();
      extractedText = [prompt, parsed.text].filter(Boolean).join(" \n").trim();
    } else {
      extractedText = await file.text();
    }
  }

  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiApiKey && openaiApiKey.startsWith("sk-")) {
    try {
      const client = new OpenAI({ apiKey: openaiApiKey });
      const messages: ChatMsg[] = [
        {
          role: "system",
          content:
            "Eres Aurora, una asistente académica en español. Responde de forma clara, profesional y pedagógica. Mantén los ejemplos breves y enfocados.",
        },
        {
          role: "user",
          content: `${effectivePrompt}${extractedText ? "\n\nContexto:\n" + extractedText : ""}`,
        },
      ];

      const resp = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: messages as any,
      });

      const reply = resp.choices?.[0]?.message?.content ?? "Lo siento, no obtuve respuesta.";
      return NextResponse.json({ reply });
    } catch (e) {
      // fallthrough to local fallback
    }
  }

  // Fallback: use existing generator and return the summary as a conversational reply
  const institutionalKnowledge = await getInstitutionalKnowledge(effectivePrompt, extractedText);
  const content = await generateStudyContent(effectivePrompt, extractedText, sourceLabel, institutionalKnowledge.context);
  const reply = content.summary || "Lo siento, no pude generar una respuesta en este momento.";

  return NextResponse.json({ reply });
}
