import { describe, expect, it } from "vitest";
import { armarContexto, type FragCtx } from "./context";

const frags = (fuenteId: string, n: number, largo = 100, nombre = `${fuenteId}.pdf`): FragCtx[] =>
  Array.from({ length: n }, (_, orden) => ({ fuenteId, nombreArchivo: nombre, orden, contenido: `${fuenteId}#${orden}`.padEnd(largo, ".") }));

// Órdenes de los fragmentos que quedaron en el texto, por fuente.
const elegidos = (texto: string, fuenteId: string) => [...texto.matchAll(new RegExp(`${fuenteId}#(\\d+)`, "g"))].map((m) => Number(m[1]));
const caracteres = (texto: string) => texto.split("\n").filter((l) => !l.startsWith("[S")).join("").length;

describe("armarContexto", () => {
  it("si cabe todo: todas las fuentes y fragmentos en orden, rotulados S1, S2… por orden de aparición", () => {
    const { texto, fuentes } = armarContexto([...frags("a", 2, 10, "uno.pdf"), ...frags("b", 1, 10, "dos.txt")], 1000);
    expect(texto).toBe("[S1] uno.pdf\na#0.......\n\na#1.......\n\n[S2] dos.txt\nb#0.......");
    expect(fuentes).toEqual([
      { etiqueta: "S1", fuenteId: "a", nombreArchivo: "uno.pdf" },
      { etiqueta: "S2", fuenteId: "b", nombreArchivo: "dos.txt" },
    ]);
  });

  it("ordena por `orden` dentro de cada fuente aunque lleguen desordenados", () => {
    const [f0, f1, f2] = frags("a", 3);
    expect(elegidos(armarContexto([f2, f0, f1], 10_000).texto, "a")).toEqual([0, 1, 2]);
  });

  it("si no cabe: muestreo uniforme a lo largo de la fuente, sin pasarse del presupuesto", () => {
    const { texto } = armarContexto(frags("a", 10), 500);
    expect(elegidos(texto, "a")).toEqual([0, 2, 4, 6, 8]);
    expect(caracteres(texto)).toBeLessThanOrEqual(500);
  });

  it("reparte el presupuesto: la fuente chica entra completa y lo que sobra va a la grande", () => {
    const { texto, fuentes } = armarContexto([...frags("a", 20), ...frags("b", 2)], 1000);
    expect(fuentes.map((f) => f.etiqueta)).toEqual(["S1", "S2"]);
    expect(elegidos(texto, "b")).toEqual([0, 1]);
    const a = elegidos(texto, "a");
    expect(a).toHaveLength(8);
    expect(a[0]).toBe(0);
    expect(a.at(-1)).toBeGreaterThanOrEqual(15); // llega hasta el final de la fuente, no solo el principio
    expect(caracteres(texto)).toBeLessThanOrEqual(1000);
  });

  it("presupuesto menor que un fragmento: cada fuente aporta al menos un fragmento recortado", () => {
    const { texto, fuentes } = armarContexto([...frags("a", 3, 1000), ...frags("b", 3, 1000)], 600);
    expect(fuentes).toHaveLength(2);
    expect(elegidos(texto, "a")).toEqual([0]);
    expect(elegidos(texto, "b")).toEqual([0]);
    expect(caracteres(texto)).toBeLessThanOrEqual(600);
  });

  it("sin fragmentos → contexto vacío", () => {
    expect(armarContexto([], 1000)).toEqual({ texto: "", fuentes: [] });
  });
});
