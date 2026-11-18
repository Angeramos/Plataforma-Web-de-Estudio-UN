import { describe, expect, it } from "vitest";
import { fragmentar } from "./chunk";

const palabras = (n: number, prefijo = "p") => Array.from({ length: n }, (_, i) => `${prefijo}${i}`).join(" ");

describe("fragmentar", () => {
  it("texto corto → un solo fragmento con orden 0 y su metadata", () => {
    expect(fragmentar([{ texto: "  Hola   mundo.  ", metadata: { pagina: 1 } }])).toEqual([
      { orden: 0, contenido: "Hola mundo.", metadata: { pagina: 1 } },
    ]);
  });

  it("vacío o solo espacios → sin fragmentos", () => {
    expect(fragmentar([])).toEqual([]);
    expect(fragmentar([{ texto: " \n\n \t " }])).toEqual([]);
  });

  it("sin metadata → metadata vacía", () => {
    expect(fragmentar([{ texto: "algo" }])[0].metadata).toEqual({});
  });

  it("texto largo: fragmentos ≤ 1000, orden consecutivo, nunca vacíos", () => {
    const frags = fragmentar([{ texto: palabras(2000) }]);
    expect(frags.length).toBeGreaterThan(5);
    frags.forEach((f, i) => {
      expect(f.orden).toBe(i);
      expect(f.contenido.length).toBeLessThanOrEqual(1000);
      expect(f.contenido.trim()).not.toBe("");
    });
  });

  it("no pierde texto: cada palabra aparece en algún fragmento", () => {
    const frags = fragmentar([{ texto: palabras(2000) }]);
    const todas = new Set(frags.flatMap((f) => f.contenido.split(" ")));
    for (let i = 0; i < 2000; i++) expect(todas.has(`p${i}`)).toBe(true);
  });

  it("solape ≈150: cada fragmento empieza con texto del final del anterior, en límite de palabra", () => {
    const frags = fragmentar([{ texto: palabras(2000) }]);
    for (let i = 1; i < frags.length; i++) {
      const primera = frags[i].contenido.split(" ")[0];
      expect(primera).toMatch(/^p\d+$/); // palabra completa, no cortada
      const cola = frags[i - 1].contenido.slice(-250);
      expect(cola).toContain(frags[i].contenido.slice(0, 40));
    }
  });

  it("prefiere cortar entre párrafos", () => {
    // ≈600 caracteres cada uno: juntos pasan de 1000, así que hay que cortar entre ellos.
    const p1 = `Primero. ${palabras(150, "a")}.`;
    const p2 = `Segundo. ${palabras(150, "b")}.`;
    const frags = fragmentar([{ texto: `${p1}\n\n${p2}` }]);
    expect(frags[0].contenido).toBe(p1);
    expect(frags.at(-1)!.contenido.endsWith(`${p2.slice(-20)}`)).toBe(true);
  });

  it("un fragmento no cruza páginas y el orden sigue entre páginas", () => {
    const frags = fragmentar([
      { texto: palabras(300, "x"), metadata: { pagina: 1 } },
      { texto: "", metadata: { pagina: 2 } },
      { texto: "Página tres corta.", metadata: { pagina: 3 } },
    ]);
    expect(frags.map((f) => f.orden)).toEqual(frags.map((_, i) => i));
    expect(frags.at(-1)).toEqual({ orden: frags.length - 1, contenido: "Página tres corta.", metadata: { pagina: 3 } });
    expect(frags.filter((f) => f.metadata.pagina === 1).every((f) => !f.contenido.includes("tres"))).toBe(true);
    expect(frags.some((f) => f.metadata.pagina === 2)).toBe(false);
  });

  it("una palabra más larga que el máximo se corta igual (no se cuelga)", () => {
    const frags = fragmentar([{ texto: "z".repeat(2500) }]);
    expect(frags.length).toBeGreaterThanOrEqual(3);
    frags.forEach((f) => expect(f.contenido.length).toBeLessThanOrEqual(1000));
  });
});
