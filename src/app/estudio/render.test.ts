import { describe, expect, it } from "vitest";
import type { Documento } from "./exportar";
import { crearPdf } from "./pdf";
import { crearWord } from "./word";

const doc: Documento = {
  titulo: "Cuestionario — Compiladores",
  subtitulo: "Compiladores · 23 de noviembre de 2026",
  bloques: [
    { tipo: "seccion", texto: "Preguntas" },
    { tipo: "lista", titulo: "1. ¿Qué produce el análisis léxico?", items: ["a) Árboles", "b) Tokens"] },
    { tipo: "lista", items: ["analisis.pdf (p. 3)", "notas.docx"] },
    { tipo: "parrafo", texto: "Año, señal, ¡listo!" },
    { tipo: "tabla", encabezados: ["Frente", "Reverso"], filas: [["Token", "Unidad léxica"]] },
  ],
};

async function bytes(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

describe("crearPdf", () => {
  it("produce un PDF", async () => {
    const b = await bytes(await crearPdf(doc));
    expect(new TextDecoder().decode(b.slice(0, 4))).toBe("%PDF");
  });

  it("conserva tildes, ñ, ¿ y ¡ en el texto del PDF", async () => {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: await bytes(await crearPdf(doc)) });
    const { text } = await parser.getText();
    await parser.destroy();
    expect(text).toContain("¿Qué produce el análisis léxico?");
    expect(text).toContain("Año, señal, ¡listo!");
    expect(text).toContain("Unidad léxica");
  });

  it("un resumen largo pasa a varias páginas en vez de cortarse", async () => {
    const largo: Documento = {
      ...doc,
      bloques: Array.from({ length: 300 }, (_, i) => ({ tipo: "parrafo" as const, texto: `Párrafo ${i + 1}: ${"texto de estudio ".repeat(12)}` })),
    };
    const texto = new TextDecoder("latin1").decode(await bytes(await crearPdf(largo)));
    expect(texto.match(/\/Type \/Page\b(?!s)/g)?.length ?? 0).toBeGreaterThan(1);
  });
});

describe("crearWord", () => {
  it("convierte los saltos de línea de un párrafo en saltos reales de Word", async () => {
    const JSZip = (await import("jszip")).default;
    const conViñetas: Documento = { ...doc, bloques: [{ tipo: "parrafo", texto: "- Primera idea\n- Segunda idea\n- Tercera idea" }] };
    const zip = await JSZip.loadAsync(await bytes(await crearWord(conViñetas)));
    const xml = await zip.file("word/document.xml")!.async("string");
    const parrafo = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g)!.find((p) => p.includes("Primera idea"))!;
    expect(parrafo).not.toContain("\n");
    expect(parrafo.match(/<w:br\/>/g)?.length).toBe(2);
    expect(parrafo).toContain("Tercera idea");
  });

  it("produce un .docx (ZIP)", async () => {
    const b = await bytes(await crearWord(doc));
    expect(b.length).toBeGreaterThan(0);
    expect(new TextDecoder().decode(b.slice(0, 2))).toBe("PK");
  });
});
