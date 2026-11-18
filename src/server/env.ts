import { z } from "zod";

// Sin espacios alrededor (`LLM_MODEL= x`); vacías (`LLM_MODEL=`) cuentan como ausentes.
const opt = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => {
    const s = typeof v === "string" ? v.trim() : v;
    return s === "" ? undefined : s;
  }, schema);

const schema = z.object({
  DATABASE_URL: opt(z.string()),
  JWT_SECRET: opt(z.string().min(32, "debe tener al menos 32 caracteres")),
  // LLM y embeddings se exigen en sus propios módulos (Corte B), no al arrancar.
  LLM_BASE_URL: opt(z.string().default("https://api.groq.com/openai/v1")), // verificado en la doc de Groq (D-040)
  LLM_API_KEY: opt(z.string().optional()),
  LLM_MODEL: opt(z.string().optional()),
  EMBEDDINGS_API_KEY: opt(z.string().optional()),
  EMBEDDINGS_MODEL: opt(z.string().default("gemini-embedding-001")),
  EMBEDDINGS_DIM: opt(z.coerce.number().pipe(z.literal(768)).default(768)),
  // 12000 car. ≈ 3-4k tokens: cabe en los 8000 tokens/min del plan de Groq con la respuesta (D-040).
  CONTEXT_MAX_CHARS: opt(z.coerce.number().int().positive().default(12000)),
  MAX_UPLOAD_MB: opt(z.coerce.number().positive().default(4)),
  GEN_DAILY_LIMIT: opt(z.coerce.number().int().positive().default(30)),
  CHAT_DAILY_LIMIT: opt(z.coerce.number().int().positive().default(100)),
});

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const detalle = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Variables de entorno inválidas o faltantes (ver .env.example): ${detalle}`);
  }
  return result.data;
}

let cached: Env | undefined;

// shortcut: se valida en la primera petición, no al arrancar el servidor; mover a instrumentation.ts si hace falta.
export function env(): Env {
  return (cached ??= parseEnv(process.env));
}

// Solo para pruebas que cambian variables con vi.stubEnv.
export function resetEnv() {
  cached = undefined;
}
