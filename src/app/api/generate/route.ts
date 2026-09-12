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

    const isFileLike = file && (typeof (file as any).arrayBuffer === "function" || typeof (file as any).size === "number");
    if (isFileLike) {
      const f = file as any;
      sourceLabel = f.name ?? sourceLabel;

      try {
        if ((f.type === "application/pdf") || (f.name && String(f.name).toLowerCase().endsWith(".pdf"))) {
          const buffer = Buffer.from(await f.arrayBuffer());
          const pdfParseModule = (await import("pdf-parse")) as any;
          const parsed = await (typeof pdfParseModule === "function" ? pdfParseModule(buffer) : pdfParseModule.default ? pdfParseModule.default(buffer) : pdfParseModule(buffer));
          extractedText = [prompt, parsed?.text].filter(Boolean).join(" \n").trim();
        } else {
          // try to read as text if it's not a PDF
          extractedText = await f.text();
        }
      } catch (pdfErr: any) {
        const msg = pdfErr?.message ?? String(pdfErr ?? "Error al leer el archivo");
        return NextResponse.json({ error: `Error al procesar el archivo ${sourceLabel}: ${msg}` }, { status: 500 });
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
