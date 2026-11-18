import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnv } from "@/server/env";
import { AppError } from "@/server/http/errors";
import { pedirJson, pedirTexto, type Crear } from "./client";
import { salidaFlashcards } from "./schemas";

const salida = salidaFlashcards(["S1"]);
const prompt = { system: "sistema", user: "usuario" };
const tarjetas = { tarjetas: [{ frente: "AFD", reverso: "Autómata finito determinista", fuente: "S1" }] };
const resp = (content: string | null) => ({ choices: [{ message: { content } }] });

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://x");
  vi.stubEnv("JWT_SECRET", "s".repeat(32));
  vi.stubEnv("LLM_MODEL", "modelo-de-prueba");
  resetEnv();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnv();
  vi.restoreAllMocks();
});

const error502 = async (p: Promise<unknown>) => {
  const e = (await p.catch((x) => x)) as AppError;
  expect(e).toBeInstanceOf(AppError);
  expect([e.status, e.codigo]).toEqual([502, "ERROR_LLM"]);
  return e.message;
};

describe("pedirJson", () => {
  it("pide JSON estricto con el esquema de la salida, temperatura baja y razonamiento bajo", async () => {
    const crear = vi.fn<Crear>(async () => resp(JSON.stringify(tarjetas)));
    expect(await pedirJson(prompt, salida, crear)).toEqual(tarjetas);
    expect(crear).toHaveBeenCalledTimes(1);
    expect(crear.mock.calls[0][0]).toMatchObject({
      model: "modelo-de-prueba",
      temperature: 0.2,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: "sistema" },
        { role: "user", content: "usuario" },
      ],
      response_format: { type: "json_schema", json_schema: { name: "flashcards", strict: true, schema: salida.jsonSchema } },
    });
  });

  it.each([["no es JSON"], [JSON.stringify({ tarjetas: [] })], [null]])("salida inválida (%s) → un reintento", async (mala) => {
    const crear = vi.fn<Crear>().mockResolvedValueOnce(resp(mala)).mockResolvedValueOnce(resp(JSON.stringify(tarjetas)));
    expect(await pedirJson(prompt, salida, crear)).toEqual(tarjetas);
    expect(crear).toHaveBeenCalledTimes(2);
  });

  it("Groq rechaza la salida del modelo (400 json_validate_failed) → se trata como salida inválida: un reintento", async () => {
    const rechazo = Object.assign(new Error("400 Failed to validate JSON"), { status: 400, code: "json_validate_failed" });
    const crear = vi.fn<Crear>().mockRejectedValueOnce(rechazo).mockResolvedValueOnce(resp(JSON.stringify(tarjetas)));
    expect(await pedirJson(prompt, salida, crear)).toEqual(tarjetas);
    const siempre = vi.fn<Crear>(async () => Promise.reject(rechazo));
    expect(await error502(pedirJson(prompt, salida, siempre))).toMatch(/respuesta inválida/);
    expect(siempre).toHaveBeenCalledTimes(2);
  });

  it("dos salidas inválidas → 502 con mensaje claro", async () => {
    const crear = vi.fn<Crear>(async () => resp("{}"));
    expect(await error502(pedirJson(prompt, salida, crear))).toMatch(/respuesta inválida/);
    expect(crear).toHaveBeenCalledTimes(2);
  });

  it("429 del proveedor → 502 'saturado' sin reintentar (gastaría más cuota)", async () => {
    const crear = vi.fn<Crear>(async () => Promise.reject(Object.assign(new Error("rate limit"), { status: 429 })));
    expect(await error502(pedirJson(prompt, salida, crear))).toMatch(/saturado/);
    expect(crear).toHaveBeenCalledTimes(1);
  });

  it("otro fallo del proveedor (red, 500, tiempo) → 502 sin reintentar", async () => {
    const crear = vi.fn<Crear>(async () => Promise.reject(new Error("ECONNRESET")));
    expect(await error502(pedirJson(prompt, salida, crear))).toMatch(/no respondió/);
    expect(crear).toHaveBeenCalledTimes(1);
  });

  it("sin modelo configurado → 502 sin llamar al proveedor", async () => {
    vi.stubEnv("LLM_MODEL", "");
    resetEnv();
    const crear = vi.fn<Crear>();
    expect(await error502(pedirJson(prompt, salida, crear))).toMatch(/configurado/);
    expect(crear).not.toHaveBeenCalled();
  });
});

describe("pedirTexto", () => {
  const mensajes = [
    { role: "system" as const, content: "s" },
    { role: "user" as const, content: "u" },
  ];

  it("envía los mensajes sin response_format y devuelve el texto recortado", async () => {
    const crear = vi.fn<Crear>(async () => resp("  Respuesta [C1].  "));
    expect(await pedirTexto(mensajes, crear)).toBe("Respuesta [C1].");
    expect(crear.mock.calls[0][0]).toMatchObject({ model: "modelo-de-prueba", temperature: 0.2, reasoning_effort: "low", messages: mensajes });
    expect(crear.mock.calls[0][0]).not.toHaveProperty("response_format");
  });

  it("respuesta vacía → un reintento; dos vacías → 502", async () => {
    const una = vi.fn<Crear>().mockResolvedValueOnce(resp("  ")).mockResolvedValueOnce(resp("ok"));
    expect(await pedirTexto(mensajes, una)).toBe("ok");
    const dos = vi.fn<Crear>(async () => resp(null));
    expect(await error502(pedirTexto(mensajes, dos))).toMatch(/respuesta inválida/);
    expect(dos).toHaveBeenCalledTimes(2);
  });

  it("429 del proveedor → 502 'saturado' sin reintentar", async () => {
    const crear = vi.fn<Crear>(async () => Promise.reject(Object.assign(new Error("rate"), { status: 429 })));
    expect(await error502(pedirTexto(mensajes, crear))).toMatch(/saturado/);
    expect(crear).toHaveBeenCalledTimes(1);
  });
});
