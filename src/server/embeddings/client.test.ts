import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnv } from "@/server/env";
import { embedDocuments, embedQuery, normalizar, toVectorLiteral } from "./client";

const vec = (n = 768, x = 0.5) => Array.from({ length: n }, () => x);

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://x");
  vi.stubEnv("JWT_SECRET", "s".repeat(32));
  vi.stubEnv("EMBEDDINGS_API_KEY", "clave-de-prueba");
  resetEnv();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetEnv();
  vi.restoreAllMocks();
});

// fetch falso: responde a cada lote según `responder(n° de llamada, cuerpo)`
function fakeFetch(responder: (llamada: number, body: { requests?: unknown[] }) => Response) {
  let llamada = 0;
  const fn = vi.fn(async (_url: string, init: RequestInit) => responder(llamada++, JSON.parse(String(init.body))));
  vi.stubGlobal("fetch", fn);
  return fn;
}
const okLote = (body: { requests?: unknown[] }) => Response.json({ embeddings: body.requests!.map(() => ({ values: vec() })) });

describe("toVectorLiteral", () => {
  it("da el literal de pgvector '[n1,n2,…]'", () => {
    const lit = toVectorLiteral(vec(768, 0.25));
    expect(lit.startsWith("[0.25,0.25")).toBe(true);
    expect(lit.endsWith("]")).toBe(true);
    expect(lit.slice(1, -1).split(",")).toHaveLength(768);
  });

  it.each([[vec(767)], [vec(769)], [[...vec(767), NaN]], [[...vec(767), Infinity]]])("rechaza longitud ≠ 768 o valores no finitos", (v) => {
    expect(() => toVectorLiteral(v)).toThrow();
  });
});

describe("normalizar", () => {
  it("deja la norma en 1 sin cambiar la dirección", () => {
    const n = normalizar([3, 4]);
    expect(n).toEqual([0.6, 0.8]);
  });

  it("rechaza el vector cero", () => {
    expect(() => normalizar([0, 0])).toThrow();
  });
});

describe("embedDocuments", () => {
  it("parte en lotes de 100, tipo documento, 768 dimensiones, y normaliza", async () => {
    const fetch = fakeFetch((_, body) => okLote(body));
    const out = await embedDocuments(Array.from({ length: 250 }, (_, i) => `texto ${i}`));
    expect(fetch).toHaveBeenCalledTimes(3);
    const bodies = fetch.mock.calls.map(([, init]) => JSON.parse(String(init.body)));
    expect(bodies.map((b) => b.requests.length)).toEqual([100, 100, 50]);
    expect(bodies[0].requests[0]).toMatchObject({ taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: 768, content: { parts: [{ text: "texto 0" }] } });
    expect(String(fetch.mock.calls[0][0])).toContain(":batchEmbedContents");
    expect(out).toHaveLength(250);
    expect(Math.hypot(...out[0]!)).toBeCloseTo(1, 6);
  });

  it("si un lote falla, solo ese lote queda en null (D-033) y se registra", async () => {
    fakeFetch((n, body) => (n === 1 ? new Response("cuota", { status: 429 }) : okLote(body)));
    const out = await embedDocuments(Array.from({ length: 250 }, (_, i) => `t${i}`));
    expect(out.slice(0, 100).every((v) => v !== null)).toBe(true);
    expect(out.slice(100, 200).every((v) => v === null)).toBe(true);
    expect(out.slice(200).every((v) => v !== null)).toBe(true);
    expect(console.error).toHaveBeenCalled();
  });

  it("un lote con dimensión equivocada o con menos vectores queda en null", async () => {
    fakeFetch((n, body) =>
      n === 0 ? Response.json({ embeddings: body.requests!.map(() => ({ values: vec(3072) })) }) : Response.json({ embeddings: [] }),
    );
    expect(await embedDocuments(["a"])).toEqual([null]);
    expect(await embedDocuments(["b"])).toEqual([null]);
  });

  it("si la red falla, todo queda en null sin lanzar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("sin red"))));
    expect(await embedDocuments(["a", "b"])).toEqual([null, null]);
  });

  it("sin clave configurada: null sin llamar al proveedor", async () => {
    vi.stubEnv("EMBEDDINGS_API_KEY", "");
    resetEnv();
    const fetch = fakeFetch((_, body) => okLote(body));
    expect(await embedDocuments(["a"])).toEqual([null]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("lista vacía → sin llamadas", async () => {
    const fetch = fakeFetch((_, body) => okLote(body));
    expect(await embedDocuments([])).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("embedQuery", () => {
  it("usa tipo consulta y devuelve el vector normalizado", async () => {
    const fetch = fakeFetch(() => Response.json({ embedding: { values: vec() } }));
    const v = await embedQuery("¿qué es un token?");
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toContain(":embedContent");
    expect(JSON.parse(String(init.body))).toMatchObject({ taskType: "RETRIEVAL_QUERY", outputDimensionality: 768 });
    expect(Math.hypot(...v)).toBeCloseTo(1, 6);
  });

  it("si el proveedor falla, lanza (el RAG cae a FTS)", async () => {
    fakeFetch(() => new Response("error", { status: 500 }));
    await expect(embedQuery("x")).rejects.toThrow();
  });
});
