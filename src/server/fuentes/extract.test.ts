import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { extraerTexto } from "./extract";

// Archivos mínimos válidos armados en memoria (los mismos que usa scripts/fixtures.mjs).
async function docx(parrafos: string[]) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  const cuerpo = parrafos.map((p) => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`).join("");
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${cuerpo}</w:body></w:document>`);
  return new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
}

async function pptx(diapositivas: Record<number, string[][]>) {
  const zip = new JSZip();
  for (const [n, parrafos] of Object.entries(diapositivas)) {
    const ps = parrafos.map((runs) => `<a:p>${runs.map((r) => `<a:r><a:t>${r}</a:t></a:r>`).join("")}</a:p>`).join("");
    zip.file(
      `ppt/slides/slide${n}.xml`,
      `<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody>${ps}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
    );
  }
  zip.file("ppt/slides/_rels/slide1.xml.rels", "<x/>"); // no es una diapositiva: se ignora
  return new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
}

describe("extraerTexto docx", () => {
  it("texto de todos los párrafos en un solo segmento sin página", async () => {
    const seg = await extraerTexto("docx", await docx(["Gramáticas libres de contexto", "Un analizador LL(1) es descendente &amp; predictivo."]));
    expect(seg).toHaveLength(1);
    expect(seg[0].metadata).toBeUndefined();
    expect(seg[0].texto).toContain("Gramáticas libres de contexto");
    expect(seg[0].texto).toContain("descendente & predictivo");
  });
});

describe("extraerTexto pptx", () => {
  it("un segmento por diapositiva en orden numérico, con su número en `pagina` y párrafos separados", async () => {
    const seg = await extraerTexto(
      "pptx",
      await pptx({
        10: [["Diez"]],
        2: [["Autómatas"], ["AFN ", "y AFD"]],
        1: [["Título &amp; tema"], ["a &lt; b"]],
      }),
    );
    expect(seg).toEqual([
      { texto: "Título & tema\na < b", metadata: { pagina: 1 } },
      { texto: "Autómatas\nAFN y AFD", metadata: { pagina: 2 } },
      { texto: "Diez", metadata: { pagina: 10 } },
    ]);
  });

  it("omite las diapositivas sin texto", async () => {
    expect(await extraerTexto("pptx", await pptx({ 1: [], 2: [["Hola"]] }))).toEqual([{ texto: "Hola", metadata: { pagina: 2 } }]);
  });

  it("decodifica entidades numéricas", async () => {
    expect((await extraerTexto("pptx", await pptx({ 1: [["&#233;l &#x41;"]] })))[0].texto).toBe("él A");
  });

  it("un ZIP roto lanza (el servicio deja la fuente en `error`)", async () => {
    await expect(extraerTexto("pptx", new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]))).rejects.toThrow();
    await expect(extraerTexto("docx", new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]))).rejects.toThrow();
  });
});
