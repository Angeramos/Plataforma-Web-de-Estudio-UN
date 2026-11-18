import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { env } from "@/server/env";
import { AppError } from "@/server/http/errors";
import type { Salida } from "./schemas";

// Única puerta al LLM (regla 5): Groq con el SDK `openai` y `baseURL` de entorno (D-040).
export type Prompt = { system: string; user: string };
export type Crear = (body: ChatCompletionCreateParamsNonStreaming) => Promise<{ choices: { message: { content: string | null } }[] }>;

const errorLlm = (mensaje: string) => new AppError(502, "ERROR_LLM", mensaje);
const noConfigurado = () => errorLlm("El servicio de IA no está configurado");

let cliente: OpenAI | undefined;
// Sin reintentos del SDK y 25 s por llamada: dos intentos caben en los 60 s de la función.
const crearReal: Crear = (body) => {
  const { LLM_API_KEY, LLM_BASE_URL } = env();
  if (!LLM_API_KEY) throw noConfigurado();
  cliente ??= new OpenAI({ apiKey: LLM_API_KEY, baseURL: LLM_BASE_URL, maxRetries: 0, timeout: 25_000 });
  return cliente.chat.completions.create(body);
};

function parsear(content: string | null): unknown {
  try {
    return JSON.parse(content ?? "");
  } catch {
    return null;
  }
}

type Mensajes = ChatCompletionCreateParamsNonStreaming["messages"];

// Un fallo del proveedor → 502 de inmediato (reintentar un 429 solo gasta más cuota).
// Una salida que no valida → un reintento; si vuelve a fallar → 502.
async function pedir<T>(
  nombre: string,
  messages: Mensajes,
  extra: Partial<ChatCompletionCreateParamsNonStreaming>,
  validar: (content: string | null) => T | null,
  crear: Crear,
): Promise<T> {
  const model = env().LLM_MODEL;
  if (!model) throw noConfigurado();
  const body: ChatCompletionCreateParamsNonStreaming = { model, temperature: 0.2, reasoning_effort: "low", messages, ...extra };

  for (let intento = 1; intento <= 2; intento++) {
    let res;
    try {
      res = await crear(body);
    } catch (err) {
      if (err instanceof AppError) throw err;
      // Con JSON estricto, Groq valida la salida del modelo y si no cumple responde 400 json_validate_failed (D-047):
      // es una salida inválida, no una caída del proveedor.
      const { status, code } = err as { status?: number; code?: string };
      if (status === 400 && code === "json_validate_failed") {
        console.error(`[llm] Groq rechazó la salida del modelo (${nombre}, intento ${intento})`);
        continue;
      }
      console.error("[llm] el proveedor falló", err);
      if ((err as { status?: number }).status === 429) throw errorLlm("El servicio de IA está saturado; intenta de nuevo en un minuto");
      throw errorLlm("El servicio de IA no respondió; intenta de nuevo");
    }
    const valido = validar(res.choices[0]?.message.content ?? null);
    if (valido !== null) return valido;
    console.error(`[llm] salida inválida (${nombre}, intento ${intento})`);
  }
  throw errorLlm("La IA devolvió una respuesta inválida; intenta de nuevo");
}

export function pedirJson<T>(prompt: Prompt, salida: Salida<T>, crear: Crear = crearReal): Promise<T> {
  const messages: Mensajes = [
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user },
  ];
  const response_format = { type: "json_schema" as const, json_schema: { name: salida.nombre, strict: true, schema: salida.jsonSchema } };
  return pedir(salida.nombre, messages, { response_format }, (c) => salida.validar(parsear(c)), crear);
}

// Texto libre (chat): vale cualquier respuesta no vacía.
export function pedirTexto(messages: Mensajes, crear: Crear = crearReal): Promise<string> {
  return pedir("texto", messages, {}, (c) => c?.trim() || null, crear);
}
