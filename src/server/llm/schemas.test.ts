import { describe, expect, it } from "vitest";
import { salidaFlashcards, salidaQuiz, salidaResumen } from "./schemas";

const pregunta = (cambios: object = {}) => ({
  pregunta: "¿Qué es un token?",
  opciones: ["Un par nombre-atributo", "Un autómata", "Un error", "Una tabla"],
  correcta: 0,
  explicacion: "Lo dice la fuente.",
  fuente: "S1",
  ...cambios,
});
const tarjeta = (cambios: object = {}) => ({ frente: "AFD", reverso: "Autómata finito determinista", fuente: "S2", ...cambios });

// Recorre el esquema JSON y devuelve todos los nodos de tipo objeto.
const objetos = (n: unknown): Record<string, unknown>[] =>
  typeof n !== "object" || n === null
    ? []
    : [...((n as { type?: string }).type === "object" ? [n as Record<string, unknown>] : []), ...Object.values(n).flatMap(objetos)];

describe("esquema JSON estricto para Groq", () => {
  it.each([
    ["quiz", salidaQuiz(["S1", "S2"]).jsonSchema],
    ["flashcards", salidaFlashcards(["S1", "S2"]).jsonSchema],
    ["resumen", salidaResumen().jsonSchema],
  ])("%s: todo objeto con additionalProperties false y todas sus propiedades requeridas", (_, schema) => {
    const objs = objetos(schema);
    expect(objs.length).toBeGreaterThan(0);
    for (const o of objs) {
      expect(o.additionalProperties).toBe(false);
      expect(o.required).toEqual(Object.keys(o.properties as object));
    }
  });

  it("la etiqueta de fuente es un enum con las etiquetas entregadas (el modelo no puede inventar una, D-040)", () => {
    const s = salidaQuiz(["S1", "S2", "S3"]).jsonSchema as { properties: { preguntas: { items: { properties: { fuente: unknown } } } } };
    expect(s.properties.preguntas.items.properties.fuente).toEqual({ type: "string", enum: ["S1", "S2", "S3"] });
    const f = salidaFlashcards(["S1"]).jsonSchema as { properties: { tarjetas: { items: { properties: { fuente: unknown } } } } };
    expect(f.properties.tarjetas.items.properties.fuente).toEqual({ type: "string", enum: ["S1"] });
  });

  it("sin etiquetas no hay esquema posible", () => {
    expect(() => salidaQuiz([])).toThrow();
  });
});

describe("validar quiz", () => {
  const { validar } = salidaQuiz(["S1", "S2"]);

  it("acepta ítems válidos y recorta espacios", () => {
    expect(validar({ preguntas: [pregunta({ pregunta: "  ¿Qué es un token?  " })] })).toEqual({ preguntas: [pregunta()] });
  });

  it.each([
    ["3 opciones", { opciones: ["a", "b", "c"] }],
    ["5 opciones", { opciones: ["a", "b", "c", "d", "e"] }],
    ["opción vacía", { opciones: ["a", "b", " ", "d"] }],
    ["correcta = 4", { correcta: 4 }],
    ["correcta = -1", { correcta: -1 }],
    ["correcta decimal", { correcta: 1.5 }],
    ["etiqueta inexistente", { fuente: "S9" }],
    ["pregunta vacía", { pregunta: "" }],
    ["sin explicación", { explicacion: undefined }],
  ])("descarta el ítem con %s y conserva los demás", (_, cambios) => {
    expect(validar({ preguntas: [pregunta(cambios), pregunta({ fuente: "S2" })] })).toEqual({ preguntas: [pregunta({ fuente: "S2" })] });
  });

  it.each([[{ preguntas: [pregunta({ correcta: 9 })] }], [{ preguntas: [] }], [{ otra: [] }], [null], ["texto"]])(
    "sin ningún ítem válido o con forma equivocada → null",
    (data) => {
      expect(validar(data)).toBeNull();
    },
  );
});

describe("validar flashcards", () => {
  const { validar } = salidaFlashcards(["S1", "S2"]);

  it("conserva las válidas y descarta etiqueta inexistente o reverso vacío", () => {
    expect(validar({ tarjetas: [tarjeta(), tarjeta({ fuente: "S3" }), tarjeta({ reverso: "  " })] })).toEqual({ tarjetas: [tarjeta()] });
  });

  it("ninguna válida → null", () => {
    expect(validar({ tarjetas: [tarjeta({ fuente: "X" })] })).toBeNull();
  });
});

describe("validar resumen", () => {
  const { validar } = salidaResumen();
  it("texto con contenido → {texto} recortado; vacío o ausente → null", () => {
    expect(validar({ texto: " Resumen [S1] " })).toEqual({ texto: "Resumen [S1]" });
    expect(validar({ texto: "   " })).toBeNull();
    expect(validar({})).toBeNull();
  });
});
