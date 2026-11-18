import { z } from "zod";

// Salidas que se piden al LLM. El modelo devuelve la etiqueta de fuente (S1, S2…), nunca un UUID;
// la traducción a `fuenteId` es de rag/citas.ts (B4).
export type PreguntaLlm = { pregunta: string; opciones: string[]; correcta: number; explicacion: string; fuente: string };
export type TarjetaLlm = { frente: string; reverso: string; fuente: string };

// `jsonSchema` va a Groq como `response_format` estricto; `validar` revisa de nuevo en el servidor,
// descarta los ítems inválidos y devuelve null si no queda nada (→ reintento, luego 502).
export type Salida<T> = { nombre: string; jsonSchema: Record<string, unknown>; validar: (data: unknown) => T | null };

// Esquema estricto mínimo: solo type/properties/required/items/enum. Las reglas finas (4 opciones,
// `correcta` 0-3) las comprueba zod: el modo estricto de Groq podría no admitir minItems/minimum [Sin verificar].
const objeto = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const str = { type: "string" };
const etiquetaJson = (etiquetas: string[]) => ({ type: "string", enum: etiquetas });

const texto = z.string().trim().min(1);
const etiquetaZod = (etiquetas: string[]) => {
  if (!etiquetas.length) throw new Error("se necesita al menos una etiqueta de fuente");
  return z.enum(etiquetas as [string, ...string[]]);
};

// Valida ítem por ítem: un ítem malo no tumba a los demás.
function lista<T>(clave: string, item: z.ZodType<T>) {
  return (data: unknown) => {
    const arr = (data as Record<string, unknown> | null)?.[clave];
    if (!Array.isArray(arr)) return null;
    const ok = arr.flatMap((x) => {
      const r = item.safeParse(x);
      return r.success ? [r.data] : [];
    });
    return ok.length ? ok : null;
  };
}

export function salidaResumen(): Salida<{ texto: string }> {
  const schema = z.object({ texto });
  return {
    nombre: "resumen",
    jsonSchema: objeto({ texto: str }),
    validar: (data) => {
      const r = schema.safeParse(data);
      return r.success ? r.data : null;
    },
  };
}

export function salidaQuiz(etiquetas: string[]): Salida<{ preguntas: PreguntaLlm[] }> {
  const item = z.object({
    pregunta: texto,
    opciones: z.array(texto).length(4),
    correcta: z.number().int().min(0).max(3),
    explicacion: texto,
    fuente: etiquetaZod(etiquetas),
  });
  const validar = lista("preguntas", item);
  return {
    nombre: "quiz",
    jsonSchema: objeto({
      preguntas: {
        type: "array",
        items: objeto({ pregunta: str, opciones: { type: "array", items: str }, correcta: { type: "integer" }, explicacion: str, fuente: etiquetaJson(etiquetas) }),
      },
    }),
    validar: (data) => {
      const preguntas = validar(data);
      return preguntas && { preguntas };
    },
  };
}

export function salidaFlashcards(etiquetas: string[]): Salida<{ tarjetas: TarjetaLlm[] }> {
  const item = z.object({ frente: texto, reverso: texto, fuente: etiquetaZod(etiquetas) });
  const validar = lista("tarjetas", item);
  return {
    nombre: "flashcards",
    jsonSchema: objeto({ tarjetas: { type: "array", items: objeto({ frente: str, reverso: str, fuente: etiquetaJson(etiquetas) }) } }),
    validar: (data) => {
      const tarjetas = validar(data);
      return tarjetas && { tarjetas };
    },
  };
}
