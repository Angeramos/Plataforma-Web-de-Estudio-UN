import { NextResponse } from "next/server";
import OpenAI from "openai";
import { generateStudyContent } from "@/lib/study-generator"; // función separada
import { getInstitutionalKnowledge } from "@/lib/institutional-knowledge";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let prompt = "";
  let file: File | null = null;

  try {
    const ctype = request.headers.get("content-type") || "";
    if (ctype.includes("application/json")) {
      const body = await request.json();
      prompt = String(body.text ?? "").trim();
    } else {
      const formData = await request.formData();
      prompt = String(formData.get("text") ?? "").trim();
      const f = formData.get("file");
      if (f instanceof File) file = f;
    }
  } catch {
    prompt = "";
  }

  const effectivePrompt = prompt || "Responde de forma clara y académica a la solicitud del usuario.";
  let extractedText = "";
  let sourceLabel = prompt ? "solicitud del usuario" : "tema solicitado";

  if (file && file.size > 0) {
    sourceLabel = file.name;
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const pdfParseModule = (await import("pdf-parse")) as any;
      const parsed = await (typeof pdfParseModule === "function" ? pdfParseModule(buffer) : pdfParseModule.default ? pdfParseModule.default(buffer) : pdfParseModule(buffer));
      extractedText = [prompt, parsed?.text].filter(Boolean).join("\n").trim();
    } else {
      extractedText = await file.text();
    }
  }

  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiApiKey && openaiApiKey.startsWith("sk-")) {
    try {
      const client = new OpenAI({ apiKey: openaiApiKey });

      const messages: OpenAI.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: "Eres Aurora, una asistente académica en español. Responde de forma clara, profesional y pedagógica. Mantén los ejemplos breves y enfocados.",
        },
        {
          role: "user",
          content: `${effectivePrompt}${extractedText ? "\n\nContexto:\n" + extractedText : ""}`,
        },
      ];

      const resp = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages,
      });

      const reply = resp.choices?.[0]?.message?.content ?? "Lo siento, no obtuve respuesta.";
      return NextResponse.json({ reply });
    } catch {
      // fallback
    }
  }

  const institutionalKnowledge = await getInstitutionalKnowledge(effectivePrompt, extractedText);
  const content = await generateStudyContent(effectivePrompt, extractedText, sourceLabel, institutionalKnowledge.context);
  const reply = content.summary || "Lo siento, no pude generar una respuesta en este momento.";

  return NextResponse.json({ reply });
}
