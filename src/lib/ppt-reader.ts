import fs from "fs";

export async function extractTextFromPpt(filePath: string) {
  const buffer = fs.readFileSync(filePath);

  // Dynamic import and cast to any to avoid differing exports across versions
  const pptxMod = (await import("pptx-parser").catch(() => null)) as any;
  if (!pptxMod) throw new Error("No se pudo cargar el módulo pptx-parser");

  const reader = pptxMod.readPptxFile ?? pptxMod.default ?? pptxMod;

  if (typeof reader !== "function") {
    throw new Error("El módulo pptx-parser no exporta una función de lectura esperada");
  }

  const slides = await reader(buffer);
  if (!slides || !Array.isArray(slides)) {
    return String(slides ?? "");
  }

  return slides.map((s: any) => (s?.text ?? s?.content ?? "")).filter(Boolean).join("\n\n");
}

export default extractTextFromPpt;
