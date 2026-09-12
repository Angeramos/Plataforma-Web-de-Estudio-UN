import { NextResponse } from "next/server";
import { generateStudyContent } from "@/lib/openai";
import { getInstitutionalKnowledge } from "@/lib/institutional-knowledge";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const prompt = String(formData.get("text") ?? "").trim();
    const file = formData.get("file");
    const effectivePrompt = prompt || "Genera una respuesta académica útil sobre el tema solicitado.";

    let extractedText = "";
    let sourceLabel = prompt ? "solicitud del usuario" : "tema solicitado";

    if (file instanceof File && file.size > 0) {
      sourceLabel = file.name;

      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const pdfParse = await import("pdf-parse");
        const parsed = await (pdfParse.default ? pdfParse.default(buffer) : pdfParse(buffer));
        extractedText = [prompt, parsed?.text].filter(Boolean).join(" \n").trim();
      } else {
        extractedText = await file.text();
      }
    }

    const institutionalKnowledge = await getInstitutionalKnowledge(effectivePrompt, extractedText);
    const content = await generateStudyContent(
      effectivePrompt,
      extractedText,
      sourceLabel,
      institutionalKnowledge.context,
    );

    return NextResponse.json(content);
  } catch (err: any) {
    const message = typeof err === "string" ? err : err?.message ?? "Error interno al procesar la solicitud.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
