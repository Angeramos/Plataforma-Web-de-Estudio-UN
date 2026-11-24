// Dibuja un Documento como PDF A4 con jsPDF. Se importa con import() dinámico al hacer clic.
// Helvetica estándar (WinAnsi): cubre tildes, ñ, ¿ y ¡; no símbolos como letras griegas.
import { jsPDF } from "jspdf";
import type { Documento } from "./exportar";

const MARGEN = 20; // mm
const PT_A_MM = 0.3528;

export async function crearPdf(documento: Documento): Promise<Blob> {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const ancho = pdf.internal.pageSize.getWidth() - MARGEN * 2;
  const alto = pdf.internal.pageSize.getHeight();
  let y = MARGEN;

  const alturaLinea = (pt: number) => pt * PT_A_MM * 1.35;
  const asegurar = (necesario: number) => {
    if (y + necesario > alto - MARGEN) {
      pdf.addPage();
      y = MARGEN;
    }
  };
  const escribir = (texto: string, pt: number, estilo: "normal" | "bold", x = MARGEN, anchoTexto = ancho, gris = false) => {
    pdf.setFont("helvetica", estilo);
    pdf.setFontSize(pt);
    pdf.setTextColor(gris ? 110 : 30);
    for (const linea of pdf.splitTextToSize(texto, anchoTexto) as string[]) {
      asegurar(alturaLinea(pt));
      pdf.text(linea, x, y + pt * PT_A_MM);
      y += alturaLinea(pt);
    }
  };

  escribir(documento.titulo, 16, "bold");
  y += 1;
  escribir(documento.subtitulo, 10, "normal", MARGEN, ancho, true);
  y += 6;

  for (const bloque of documento.bloques) {
    if (bloque.tipo === "seccion") {
      y += 3;
      escribir(bloque.texto, 13, "bold");
      y += 2;
    } else if (bloque.tipo === "parrafo") {
      escribir(bloque.texto, 11, "normal");
      y += 3;
    } else if (bloque.tipo === "lista") {
      const sangria = bloque.titulo ? 5 : 0;
      if (bloque.titulo) escribir(bloque.titulo, 11, "bold");
      bloque.items.forEach((item) => escribir(item, 11, "normal", MARGEN + sangria, ancho - sangria));
      y += 4;
    } else {
      dibujarTabla(bloque.encabezados, bloque.filas);
      y += 4;
    }
  }

  function dibujarTabla(encabezados: [string, string], filas: [string, string][]) {
    const col = ancho / 2;
    const pad = 2;
    const fila = (celdas: [string, string], negrita: boolean) => {
      pdf.setFont("helvetica", negrita ? "bold" : "normal");
      pdf.setFontSize(10.5);
      const lineas = celdas.map((c) => pdf.splitTextToSize(c, col - pad * 2) as string[]);
      const h = Math.max(...lineas.map((l) => l.length)) * alturaLinea(10.5) + pad * 2;
      asegurar(h);
      pdf.setDrawColor(190);
      pdf.setTextColor(30);
      lineas.forEach((l, i) => {
        const x = MARGEN + col * i;
        pdf.rect(x, y, col, h);
        l.forEach((linea, j) => pdf.text(linea, x + pad, y + pad + 10.5 * PT_A_MM + j * alturaLinea(10.5)));
      });
      y += h;
    };
    fila(encabezados, true);
    filas.forEach((f) => fila(f, false));
  }

  return pdf.output("blob");
}
