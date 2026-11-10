import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const base = {
  DATABASE_URL: "postgresql://u:p@host/db?sslmode=require",
  JWT_SECRET: "x".repeat(32),
};

describe("parseEnv", () => {
  it("aplica los valores por defecto de .env.example", () => {
    const env = parseEnv(base);
    expect(env.MAX_UPLOAD_MB).toBe(4);
    expect(env.CONTEXT_MAX_CHARS).toBe(12000);
    expect(env.LLM_BASE_URL).toBe("https://api.groq.com/openai/v1");
    expect(env.GEN_DAILY_LIMIT).toBe(30);
    expect(env.CHAT_DAILY_LIMIT).toBe(100);
    expect(env.EMBEDDINGS_MODEL).toBe("gemini-embedding-001");
    expect(env.EMBEDDINGS_DIM).toBe(768);
  });

  it("convierte números que llegan como texto", () => {
    expect(parseEnv({ ...base, MAX_UPLOAD_MB: "2" }).MAX_UPLOAD_MB).toBe(2);
  });

  it("falla nombrando cada variable obligatoria que falta", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL[\s\S]*JWT_SECRET/);
  });

  it("rechaza un JWT_SECRET corto", () => {
    expect(() => parseEnv({ ...base, JWT_SECRET: "corto" })).toThrow(/JWT_SECRET/);
  });

  it("rechaza una dimensión de embeddings distinta de 768", () => {
    expect(() => parseEnv({ ...base, EMBEDDINGS_DIM: "384" })).toThrow(/EMBEDDINGS_DIM/);
  });

  it("quita espacios alrededor (`LLM_MODEL= openai/gpt-oss-120b`)", () => {
    expect(parseEnv({ ...base, LLM_MODEL: " openai/gpt-oss-120b " }).LLM_MODEL).toBe("openai/gpt-oss-120b");
    expect(() => parseEnv({ ...base, DATABASE_URL: "   " })).toThrow(/DATABASE_URL/);
  });

  it("trata las variables vacías como ausentes", () => {
    expect(() => parseEnv({ ...base, DATABASE_URL: "" })).toThrow(/DATABASE_URL/);
    expect(parseEnv({ ...base, LLM_MODEL: "" }).LLM_MODEL).toBeUndefined();
  });
});
