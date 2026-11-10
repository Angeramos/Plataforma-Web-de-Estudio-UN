import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnv } from "@/server/env";
import { recuperar, type Consultas, type Recuperado } from "./retrieve";

const frag = (id: string): Recuperado => ({ id, fuenteId: "f1", orden: 0, contenido: id, metadata: {}, nombreArchivo: "a.pdf" });
const vector768 = Array.from({ length: 768 }, () => 0.1);

let deps: { [K in keyof Consultas]: ReturnType<typeof vi.fn> };
beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://x");
  vi.stubEnv("JWT_SECRET", "s".repeat(32));
  resetEnv();
  vi.spyOn(console, "error").mockImplementation(() => {});
  deps = {
    embedQuery: vi.fn(async () => vector768),
    porVector: vi.fn(async () => [frag("v1")]),
    porTexto: vi.fn(async () => [frag("t1")]),
    primeros: vi.fn(async () => [frag("p1")]),
  };
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnv();
  vi.restoreAllMocks();
});
const correr = () => recuperar("esp-1", "¿qué es un token?", deps as unknown as Consultas);

describe("recuperar (orden de respaldo D-025)", () => {
  it("vector con resultados: no consulta FTS ni primeros", async () => {
    expect(await correr()).toEqual({ modo: "vector", fragmentos: [frag("v1")] });
    expect(deps.porVector).toHaveBeenCalledWith("esp-1", expect.stringMatching(/^\[0\.1,/));
    expect(deps.porTexto).not.toHaveBeenCalled();
    expect(deps.primeros).not.toHaveBeenCalled();
  });

  it("si el embedding de la pregunta falla → FTS, sin consulta vectorial, y se registra", async () => {
    deps.embedQuery.mockRejectedValue(new Error("429"));
    expect(await correr()).toEqual({ modo: "fts", fragmentos: [frag("t1")] });
    expect(deps.porVector).not.toHaveBeenCalled();
    expect(deps.porTexto).toHaveBeenCalledWith("esp-1", "¿qué es un token?");
    expect(console.error).toHaveBeenCalled();
  });

  it("si la consulta vectorial falla → FTS", async () => {
    deps.porVector.mockRejectedValue(new Error("sql"));
    expect((await correr()).modo).toBe("fts");
  });

  it("vector sin filas (fuentes sin embeddings) → FTS", async () => {
    deps.porVector.mockResolvedValue([]);
    expect((await correr()).modo).toBe("fts");
  });

  it("FTS sin filas (p. ej. solo palabras vacías) → primeros fragmentos", async () => {
    deps.porVector.mockResolvedValue([]);
    deps.porTexto.mockResolvedValue([]);
    expect(await correr()).toEqual({ modo: "primeros", fragmentos: [frag("p1")] });
    expect(deps.primeros).toHaveBeenCalledWith("esp-1");
  });

  it("un fallo de la BD en FTS no se oculta (lo convierte en 500 el manejador)", async () => {
    deps.porVector.mockResolvedValue([]);
    deps.porTexto.mockRejectedValue(new Error("sql"));
    await expect(correr()).rejects.toThrow("sql");
  });
});
