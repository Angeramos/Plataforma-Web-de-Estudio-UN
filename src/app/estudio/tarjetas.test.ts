import { describe, expect, it } from "vitest";
import { mover, nombreFuente } from "./tarjetas";

describe("mover", () => {
  it("avanza y retrocede una tarjeta", () => {
    expect(mover(0, 10, 1)).toBe(1);
    expect(mover(3, 10, -1)).toBe(2);
  });

  it("no pasa de la primera ni de la última", () => {
    expect(mover(0, 10, -1)).toBe(0);
    expect(mover(9, 10, 1)).toBe(9);
  });

  it("con una sola tarjeta se queda en 0", () => {
    expect(mover(0, 1, 1)).toBe(0);
  });
});

describe("nombreFuente", () => {
  const fuentes = [{ id: "a", nombreArchivo: "analisis.pdf" }];

  it("devuelve el nombre del archivo", () => {
    expect(nombreFuente(fuentes, "a")).toBe("analisis.pdf");
  });

  it("si la fuente ya no existe dice 'Fuente eliminada'", () => {
    expect(nombreFuente(fuentes, "zzz")).toBe("Fuente eliminada");
  });
});
