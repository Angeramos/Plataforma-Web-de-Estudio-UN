import { describe, expect, it } from "vitest";
import { toEspacioDto, toFuenteDto } from "./dto";

const fecha = new Date("2026-11-07T15:00:00.000Z");

describe("toEspacioDto", () => {
  it("pasa de snake_case de la BD a camelCase del contrato", () => {
    const dto = toEspacioDto({
      id: "e1",
      user_id: "u1",
      nombre: "Compiladores",
      materia: null,
      created_at: fecha,
      updated_at: fecha,
      _count: { fuentes: 3 },
    });
    expect(dto).toEqual({ id: "e1", nombre: "Compiladores", materia: null, fuentesCount: 3, updatedAt: "2026-11-07T15:00:00.000Z" });
    expect(dto).not.toHaveProperty("user_id");
  });
});

describe("toFuenteDto", () => {
  it("mapea la fuente y deja error en null si no hay", () => {
    expect(
      toFuenteDto({ id: "f1", espacio_id: "e1", nombre_archivo: "tema2.pdf", tipo: "pdf", estado: "listo", error: null, created_at: fecha }),
    ).toEqual({ id: "f1", nombreArchivo: "tema2.pdf", tipo: "pdf", estado: "listo", error: null, createdAt: "2026-11-07T15:00:00.000Z" });
  });
});
