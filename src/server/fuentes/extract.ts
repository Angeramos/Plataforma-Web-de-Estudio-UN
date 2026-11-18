import type { Segmento } from "./chunk";
import type { TipoArchivo } from "./tipo";

async function extraerPdf(bytes: Uint8Array): Promise<Segmento[]> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  try {
    const { pages } = await parser.getText();
    return pages.map((p) => ({ texto: p.text, metadata: { pagina: p.num } }));
  } finally {
    await parser.destroy();
  }
}

// Word no tiene páginas fijas: todo el documento es un segmento.
async function extraerDocx(bytes: Uint8Array): Promise<Segmento[]> {
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return [{ texto: value }];
}

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decodificar = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
    e[0] !== "#" ? ENTIDADES[e.toLowerCase()] : String.fromCodePoint(parseInt(e.slice(e[1].toLowerCase() === "x" ? 2 : 1), e[1].toLowerCase() === "x" ? 16 : 10)),
  );

// Una diapositiva por segmento; su número va en `pagina` porque el contrato solo tiene ese campo (D-047).
async function extraerPptx(bytes: Uint8Array): Promise<Segmento[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  const diapositivas = Object.keys(zip.files)
    .map((nombre) => ({ nombre, n: Number(/^ppt\/slides\/slide(\d+)\.xml$/.exec(nombre)?.[1]) }))
    .filter((d) => d.n)
    .sort((a, b) => a.n - b.n);
  const segmentos: Segmento[] = [];
  for (const { nombre, n } of diapositivas) {
    const xml = await zip.file(nombre)!.async("string");
    // Cada <a:p> es un párrafo; sus <a:t> son trozos de texto que van pegados.
    const texto = (xml.match(/<a:p[\s>][\s\S]*?<\/a:p>/g) ?? [])
      .map((p) => decodificar([...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]).join("")).trim())
      .filter(Boolean)
      .join("\n");
    if (texto) segmentos.push({ texto, metadata: { pagina: n } });
  }
  return segmentos;
}

// Texto por segmento (una página en PDF, una diapositiva en PPTX; todo el archivo en TXT y DOCX).
export async function extraerTexto(tipo: TipoArchivo, bytes: Uint8Array): Promise<Segmento[]> {
  switch (tipo) {
    case "txt":
      return [{ texto: new TextDecoder("utf-8").decode(bytes) }]; // quita el BOM si lo hay
    case "pdf":
      return extraerPdf(bytes);
    case "docx":
      return extraerDocx(bytes);
    case "pptx":
      return extraerPptx(bytes);
  }
}
