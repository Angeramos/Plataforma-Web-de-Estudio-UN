// Dibuja un Documento como .docx con la librería docx. Se importa con import() dinámico al hacer clic.
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import type { Bloque, Documento } from "./exportar";

function celda(texto: string, negrita = false) {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ children: [new TextRun({ text: texto, bold: negrita })] })],
  });
}

// Word muestra un "\n" dentro del texto como espacio: cada línea va en su propio run con un salto real (<w:br/>).
function lineas(texto: string) {
  return texto.split("\n").map((linea, i) => new TextRun({ text: linea, break: i > 0 ? 1 : undefined }));
}

function convertir(bloque: Bloque): Array<Paragraph | Table> {
  if (bloque.tipo === "seccion") return [new Paragraph({ text: bloque.texto, heading: HeadingLevel.HEADING_2 })];
  if (bloque.tipo === "parrafo") return [new Paragraph({ children: lineas(bloque.texto), spacing: { after: 160 } })];
  if (bloque.tipo === "lista") {
    const titulo = bloque.titulo ? [new Paragraph({ children: [new TextRun({ text: bloque.titulo, bold: true })], spacing: { after: 40 } })] : [];
    return [
      ...titulo,
      ...bloque.items.map(
        (item, i) =>
          new Paragraph({
            text: item,
            indent: bloque.titulo ? { left: 360 } : undefined,
            spacing: { after: i === bloque.items.length - 1 ? 200 : 40 },
          }),
      ),
    ];
  }
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ tableHeader: true, children: bloque.encabezados.map((e) => celda(e, true)) }),
        ...bloque.filas.map((f) => new TableRow({ children: f.map((c) => celda(c)) })),
      ],
    }),
  ];
}

export async function crearWord(documento: Documento): Promise<Blob> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: documento.titulo, heading: HeadingLevel.TITLE }),
          new Paragraph({ children: [new TextRun({ text: documento.subtitulo, color: "6E6E6E" })], spacing: { after: 240 } }),
          ...documento.bloques.flatMap(convertir),
        ],
      },
    ],
  });
  return Packer.toBlob(doc);
}
