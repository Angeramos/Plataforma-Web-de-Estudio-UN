import { NextResponse } from "next/server";
import { extractTextFromPpt } from "@/lib/ppt-reader";
import { generateStudyContent } from "@/lib/openai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = String(body.text ?? "").trim();

    // Path to pptx inside the project - replace with your actual path
    const pptPath = "src/content/mis-ppt/tema1.pptx";

    let pptText = "";
    try {
      pptText = await extractTextFromPpt(pptPath);
    } catch (pptErr: any) {
      return NextResponse.json({ error: `No se pudo leer el PowerPoint: ${pptErr?.message ?? String(pptErr)}` }, { status: 500 });
    }

    const content = await generateStudyContent(query, pptText, "PowerPoint académico", pptText);

    return NextResponse.json(content);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 });
  }
}
