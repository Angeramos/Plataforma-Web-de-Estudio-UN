import { describe, expect, it } from "vitest";
import { citarChat, citarGeneracion } from "./citas";
import type { Recuperado } from "./retrieve";

const fuentes = [
  { etiqueta: "S1", fuenteId: "id-1", nombreArchivo: "uno.pdf" },
  { etiqueta: "S2", fuenteId: "id-2", nombreArchivo: "dos.txt" },
];
const p = (fuente: string, pregunta = "¿?") => ({ pregunta, opciones: ["a", "b", "c", "d"], correcta: 1, explicacion: "e", fuente });
const t = (fuente: string) => ({ frente: "f", reverso: "r", fuente });

describe("citarGeneracion: quiz y flashcards", () => {
  it("traduce la etiqueta a fuenteId y arma fuentesCitadas únicas en orden de aparición", () => {
    expect(citarGeneracion("quiz", { preguntas: [p("S2", "x"), p("S1", "y"), p("S2", "z")] }, fuentes, 10)).toEqual({
      contenido: {
        preguntas: [
          { pregunta: "x", opciones: ["a", "b", "c", "d"], correcta: 1, explicacion: "e", fuenteId: "id-2" },
          { pregunta: "y", opciones: ["a", "b", "c", "d"], correcta: 1, explicacion: "e", fuenteId: "id-1" },
          { pregunta: "z", opciones: ["a", "b", "c", "d"], correcta: 1, explicacion: "e", fuenteId: "id-2" },
        ],
      },
      fuentesCitadas: [
        { fuenteId: "id-2", nombreArchivo: "dos.txt" },
        { fuenteId: "id-1", nombreArchivo: "uno.pdf" },
      ],
    });
  });

  it("descarta ítems con etiqueta que no se entregó y recorta a la cantidad pedida", () => {
    const r = citarGeneracion("flashcards", { tarjetas: [t("S9"), t("S1"), t("S2"), t("S1")] }, fuentes, 2);
    expect(r?.contenido).toEqual({
      tarjetas: [
        { frente: "f", reverso: "r", fuenteId: "id-1" },
        { frente: "f", reverso: "r", fuenteId: "id-2" },
      ],
    });
    expect(r?.fuentesCitadas.map((f) => f.fuenteId)).toEqual(["id-1", "id-2"]);
  });

  it("si no queda ningún ítem válido → null (el servicio responde 502)", () => {
    expect(citarGeneracion("quiz", { preguntas: [p("S7")] }, fuentes, 5)).toBeNull();
  });
});

describe("citarGeneracion: resumen", () => {
  const resumen = (texto: string) => citarGeneracion("resumen", { texto }, fuentes, 0);

  it("fuentesCitadas = etiquetas [Sn] presentes en el texto, únicas", () => {
    const r = resumen("Idea A [S2]. Idea B [S1]. Idea C [S2].");
    expect(r?.contenido).toEqual({ texto: "Idea A [S2]. Idea B [S1]. Idea C [S2]." });
    expect(r?.fuentesCitadas.map((f) => f.fuenteId)).toEqual(["id-2", "id-1"]);
  });

  it("entiende citas agrupadas [S1, S2] y [S1][S2]", () => {
    expect(resumen("A [S1, S2].")?.fuentesCitadas).toHaveLength(2);
    expect(resumen("A [S2][S1].")?.fuentesCitadas.map((f) => f.fuenteId)).toEqual(["id-2", "id-1"]);
  });

  it("quita del texto las etiquetas que no se entregaron (toda cita mostrada debe existir)", () => {
    expect(resumen("A [S9]. B [S1, S9].")).toEqual({ contenido: { texto: "A. B [S1]." }, fuentesCitadas: [{ fuenteId: "id-1", nombreArchivo: "uno.pdf" }] });
  });

  it("sin citas: se acepta con fuentesCitadas vacías", () => {
    expect(resumen("Texto sin citas.")).toEqual({ contenido: { texto: "Texto sin citas." }, fuentesCitadas: [] });
  });
});

describe("citarChat", () => {
  const frag = (id: string, fuenteId: string, pagina?: number): Recuperado => ({
    id,
    fuenteId,
    orden: 0,
    contenido: `contenido ${id}`,
    metadata: pagina ? { pagina } : {},
    nombreArchivo: `${fuenteId}.pdf`,
  });
  const frags = [frag("f1", "a", 3), frag("f2", "b"), frag("f3", "a", 1)];

  it("[Cn] → el fragmento n entregado, con página (o null) y su texto; únicos en orden de aparición", () => {
    expect(citarChat("Un token es un par [C3]. Y más [C2][C3].", frags)).toEqual({
      contenido: "Un token es un par [C3]. Y más [C2][C3].",
      fuentesCitadas: [
        { fuenteId: "a", nombreArchivo: "a.pdf", pagina: 1, fragmento: "contenido f3" },
        { fuenteId: "b", nombreArchivo: "b.pdf", pagina: null, fragmento: "contenido f2" },
      ],
    });
  });

  it("solo cuentan las etiquetas entregadas: las demás salen del texto", () => {
    expect(citarChat("Algo [C9]. Otro [C1, C7].", frags)).toEqual({
      contenido: "Algo. Otro [C1].",
      fuentesCitadas: [{ fuenteId: "a", nombreArchivo: "a.pdf", pagina: 3, fragmento: "contenido f1" }],
    });
  });

  it("'No encontré eso en tus fuentes' → sin citas aunque el modelo haya puesto alguna", () => {
    expect(citarChat("No encontré eso en tus fuentes. [C1]", frags)).toEqual({ contenido: "No encontré eso en tus fuentes.", fuentesCitadas: [] });
    expect(citarChat("no encontre eso en tus fuentes", frags).fuentesCitadas).toEqual([]);
    expect(citarChat("«No encontré eso en tus fuentes.» Pero [C1] dice algo.", frags)).toEqual({ contenido: "No encontré eso en tus fuentes.", fuentesCitadas: [] });
  });

  it("acepta los corchetes de gpt-oss 【C1】 y los normaliza a [C1] (hallado en B5)", () => {
    expect(citarChat("Elimina caracteres【C1】. Y más 【C2, C9】.", frags)).toMatchObject({ contenido: "Elimina caracteres [C1]. Y más [C2]." });
    expect(citarChat("Elimina caracteres【C1】.", frags).fuentesCitadas).toHaveLength(1);
  });

  it("respuesta sin citas: se devuelve tal cual, sin fuentesCitadas", () => {
    expect(citarChat("Respuesta.", frags)).toEqual({ contenido: "Respuesta.", fuentesCitadas: [] });
  });
});
