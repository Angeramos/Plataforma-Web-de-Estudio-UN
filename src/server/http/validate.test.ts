import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "./errors";
import { parseBody, parseId } from "./validate";

const schema = z.object({ nombre: z.string().min(1), materia: z.string().optional() });

const post = (body: string) => new Request("http://x", { method: "POST", body, headers: { "content-type": "application/json" } });

async function codigoDe(promise: Promise<unknown>) {
  const err = (await promise.catch((e) => e)) as AppError;
  expect(err).toBeInstanceOf(AppError);
  return { status: err.status, codigo: err.codigo, mensaje: err.message };
}

describe("parseBody", () => {
  it("devuelve el cuerpo validado", async () => {
    expect(await parseBody(post('{"nombre":"Compiladores"}'), schema)).toEqual({ nombre: "Compiladores" });
  });

  it("JSON mal formado → 400 VALIDACION", async () => {
    expect(await codigoDe(parseBody(post("{nombre:"), schema))).toMatchObject({ status: 400, codigo: "VALIDACION" });
  });

  it("cuerpo que no cumple el esquema → 400 VALIDACION nombrando el campo", async () => {
    const e = await codigoDe(parseBody(post('{"nombre":""}'), schema));
    expect(e).toMatchObject({ status: 400, codigo: "VALIDACION" });
    expect(e.mensaje).toContain("nombre");
  });

  it("los mensajes de validación salen en español", async () => {
    const e = await codigoDe(parseBody(post('{"nombre":""}'), schema));
    expect(e.mensaje).not.toMatch(/Too small|expected/i);
    expect(e.mensaje).toMatch(/demasiado|esperaba/i);
  });
});

describe("parseId", () => {
  it("acepta un UUID", () => {
    expect(parseId("3f2c1a9e-8b7d-4c6e-9f1a-2b3c4d5e6f70")).toBe("3f2c1a9e-8b7d-4c6e-9f1a-2b3c4d5e6f70");
  });

  it.each(["abc", "", "1", "3f2c1a9e-8b7d-4c6e-9f1a"])("id no-UUID %j → 404 NO_ENCONTRADO", (id) => {
    expect(() => parseId(id)).toThrow(AppError);
    try {
      parseId(id);
    } catch (e) {
      expect(e).toMatchObject({ status: 404, codigo: "NO_ENCONTRADO" });
    }
  });
});
