import { describe, expect, it } from "vitest";
import { armarDocumento, detalleCorto, ETIQUETA, nombreArchivo, type Generacion } from "./exportar";

const createdAt = "2026-11-23T15:00:00.000Z"; // mediodía en Colombia: el mismo día en cualquier zona
const FA = "11111111-1111-1111-1111-111111111111";
const FB = "22222222-2222-2222-2222-222222222222";
const fuentes = [
  { id: FA, nombreArchivo: "analisis.pdf" },
  { id: FB, nombreArchivo: "notas.docx" },
];

const resumen: Generacion = {
  id: "r1",
  tipo: "resumen",
  contenido: { texto: "El análisis léxico divide el código en tokens." },
  fuentesCitadas: [
    { fuenteId: FA, nombreArchivo: "analisis.pdf", pagina: 3 },
    { fuenteId: FB, nombreArchivo: "notas.docx", pagina: null },
  ],
  createdAt,
};

const quiz: Generacion = {
  id: "q1",
  tipo: "quiz",
  contenido: {
    preguntas: [
      { pregunta: "¿Qué produce el análisis léxico?", opciones: ["Árboles", "Tokens", "Bytecode", "Errores"], correcta: 1, explicacion: "Agrupa caracteres en tokens.", fuenteId: FA },
      { pregunta: "¿Qué es un lexema?", opciones: ["Una regla", "Un token", "Una secuencia de caracteres", "Un estado"], correcta: 2, explicacion: "Es el texto concreto de un token.", fuenteId: "99999999-9999-9999-9999-999999999999" },
    ],
  },
  fuentesCitadas: [],
  createdAt,
};

const tarjetas: Generacion = {
  id: "f1",
  tipo: "flashcards",
  contenido: { tarjetas: [{ frente: "Token", reverso: "Unidad léxica", fuenteId: FB }] },
  fuentesCitadas: [],
  createdAt,
};

describe("nombreArchivo", () => {
  it("usa tipo, slug del espacio sin tildes ni símbolos y fecha local", () => {
    expect(nombreArchivo(quiz, "Análisis Numérico / 2026", "pdf")).toBe("cuestionario-analisis-numerico-2026-2026-11-23.pdf");
  });

  it("usa 'espacio' si el nombre no deja letras ni números", () => {
    expect(nombreArchivo(resumen, "¿?", "docx")).toBe("resumen-espacio-2026-11-23.docx");
  });

  it("llama 'tarjetas' a las flashcards", () => {
    expect(nombreArchivo(tarjetas, "Compiladores", "pdf")).toBe("tarjetas-compiladores-2026-11-23.pdf");
  });
});

describe("armarDocumento", () => {
  it("resumen: título, subtítulo con fecha, texto y fuentes citadas", () => {
    const doc = armarDocumento(resumen, "Compiladores", fuentes);
    expect(doc.titulo).toBe("Resumen — Compiladores");
    expect(doc.subtitulo).toContain("Compiladores");
    expect(doc.subtitulo).toContain("2026");
    expect(doc.bloques[0]).toEqual({ tipo: "parrafo", texto: "El análisis léxico divide el código en tokens." });
    expect(doc.bloques.at(-1)).toEqual({ tipo: "lista", items: ["analisis.pdf (p. 3)", "notas.docx"] });
  });

  it("resumen: quita las marcas de cita [S1] y [S1, S2] del texto", () => {
    const conMarcas = {
      ...resumen,
      contenido: { texto: "- La fotosíntesis produce glucosa [S1].\n- La clorofila absorbe luz [S1, S2][S3] roja.\n\nOtro párrafo [S2]" },
    };
    expect(armarDocumento(conMarcas, "Biología", fuentes).bloques.slice(0, 2)).toEqual([
      { tipo: "parrafo", texto: "- La fotosíntesis produce glucosa.\n- La clorofila absorbe luz roja." },
      { tipo: "parrafo", texto: "Otro párrafo" },
    ]);
  });

  it("cuestionario: preguntas con opciones a)–d) y respuestas al final", () => {
    const doc = armarDocumento(quiz, "Compiladores", fuentes);
    expect(doc.titulo).toBe("Cuestionario — Compiladores");
    const iPreguntas = doc.bloques.findIndex((b) => b.tipo === "seccion" && b.texto === "Preguntas");
    const iRespuestas = doc.bloques.findIndex((b) => b.tipo === "seccion" && b.texto === "Respuestas");
    expect(iPreguntas).toBeGreaterThanOrEqual(0);
    expect(iRespuestas).toBeGreaterThan(iPreguntas);
    expect(doc.bloques[iPreguntas + 1]).toEqual({
      tipo: "lista",
      titulo: "1. ¿Qué produce el análisis léxico?",
      items: ["a) Árboles", "b) Tokens", "c) Bytecode", "d) Errores"],
    });
    expect(doc.bloques.slice(iRespuestas + 1)).toContainEqual({
      tipo: "lista",
      items: [
        "1. b) Tokens — Agrupa caracteres en tokens. (Fuente: analisis.pdf)",
        "2. c) Una secuencia de caracteres — Es el texto concreto de un token. (Fuente: Fuente eliminada)",
      ],
    });
  });

  it("tarjetas: una tabla Frente/Reverso con la fuente en el reverso", () => {
    const doc = armarDocumento(tarjetas, "Compiladores", fuentes);
    expect(doc.titulo).toBe("Tarjetas — Compiladores");
    expect(doc.bloques).toContainEqual({
      tipo: "tabla",
      encabezados: ["Frente", "Reverso"],
      filas: [["Token", "Unidad léxica (Fuente: notas.docx)"]],
    });
  });

  it.each([
    ["quiz", { ...quiz, contenido: {} }],
    ["flashcards", { ...tarjetas, contenido: {} }],
    ["resumen", { ...resumen, contenido: {} }],
  ])("%s sin contenido: avisa en vez de fallar", (_tipo, g) => {
    expect(armarDocumento(g as Generacion, "Compiladores", fuentes).bloques).toContainEqual({
      tipo: "parrafo",
      texto: "Este material no tiene contenido.",
    });
  });
});

describe("detalleCorto", () => {
  it("cuenta preguntas, tarjetas y fuentes en singular y plural", () => {
    expect(detalleCorto(quiz)).toBe("2 preguntas");
    expect(detalleCorto(tarjetas)).toBe("1 tarjeta");
    expect(detalleCorto({ ...tarjetas, contenido: { tarjetas: [...tarjetas.contenido.tarjetas!, ...tarjetas.contenido.tarjetas!, ...tarjetas.contenido.tarjetas!] } })).toBe("3 tarjetas");
    expect(detalleCorto(resumen)).toBe("Cita 2 fuentes");
    expect(detalleCorto({ ...resumen, fuentesCitadas: resumen.fuentesCitadas.slice(0, 1) })).toBe("Cita 1 fuente");
    expect(detalleCorto({ ...resumen, fuentesCitadas: [] })).toBe("Sin fuentes citadas");
  });

  it("ETIQUETA nombra cada tipo en español", () => {
    expect(ETIQUETA).toEqual({ resumen: "Resumen", quiz: "Cuestionario", flashcards: "Tarjetas" });
  });
});
