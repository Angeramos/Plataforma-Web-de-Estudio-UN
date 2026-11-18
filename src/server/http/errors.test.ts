import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError, handle, toResponse } from "./errors";

afterEach(() => vi.restoreAllMocks());

describe("toResponse", () => {
  it("convierte AppError en {error:{codigo,mensaje}} con su status", async () => {
    const res = toResponse(new AppError(404, "NO_ENCONTRADO", "El espacio no existe"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { codigo: "NO_ENCONTRADO", mensaje: "El espacio no existe" } });
  });

  it("un error inesperado da 500 genérico, sin filtrar detalles, y se registra", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = toResponse(new Error("password=secreto en la consulta"));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: { codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" } });
    expect(text).not.toContain("secreto");
    expect(log).toHaveBeenCalledOnce();
  });

  it("también cubre valores lanzados que no son Error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(toResponse("texto suelto").status).toBe(500);
  });
});

describe("handle", () => {
  it("deja pasar la respuesta del handler", async () => {
    const route = handle(async () => Response.json({ ok: true }, { status: 201 }));
    const res = await route();
    expect(res.status).toBe(201);
  });

  it("captura lo que lance el handler y pasa los argumentos", async () => {
    const route = handle(async (_req: Request, id: string) => {
      throw new AppError(409, "EMAIL_YA_REGISTRADO", `repetido ${id}`);
    });
    const res = await route(new Request("http://x"), "a@b.co");
    expect(res.status).toBe(409);
    expect((await res.json()).error.mensaje).toBe("repetido a@b.co");
  });
});
