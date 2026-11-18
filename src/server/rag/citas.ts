import type { PreguntaLlm, TarjetaLlm } from "@/server/llm/schemas";
import type { FuenteCtx } from "./context";
import type { Recuperado } from "./retrieve";

// Regla 4: toda cita devuelta corresponde a una fuente que realmente se entregó al modelo.
export type FuenteCitada = { fuenteId: string; nombreArchivo: string };
type Salidas = { resumen: { texto: string }; quiz: { preguntas: PreguntaLlm[] }; flashcards: { tarjetas: TarjetaLlm[] } };

const unicas = (ids: string[], porId: Map<string, FuenteCtx>): FuenteCitada[] =>
  [...new Set(ids)].map((id) => ({ fuenteId: id, nombreArchivo: porId.get(id)!.nombreArchivo }));

// Deja en el texto solo las etiquetas entregadas (`[S1]`, `[S1, S2]`; `[S1][S2]` son dos grupos);
// un grupo sin ninguna válida desaparece. Devuelve también las etiquetas usadas, en orden de aparición.
// gpt-oss cita con corchetes lenticulares 【C1】 (D-045): se aceptan y se normalizan a [C1].
function filtrarEtiquetas(texto: string, letra: "S" | "C", validas: Set<string>) {
  const usadas: string[] = [];
  const grupo = new RegExp(`(\\s*)([\\[【])(${letra}\\d+(?:\\s*,\\s*${letra}\\d+)*)[\\]】]`, "g");
  const limpio = texto.replace(grupo, (_, espacio: string, abre: string, dentro: string) => {
    const ok = dentro.split(",").map((s) => s.trim()).filter((e) => validas.has(e));
    usadas.push(...ok);
    // 【C1】 suele ir pegado a la palabra; [C1] se deja con el espacio que traía.
    return ok.length ? `${abre === "【" && !espacio ? " " : espacio}[${ok.join(", ")}]` : "";
  });
  return { texto: limpio, usadas };
}

// null = no quedó nada válido (el servicio responde 502).
export function citarGeneracion<T extends keyof Salidas>(
  tipo: T,
  salida: Salidas[T],
  fuentes: FuenteCtx[],
  cantidad: number,
): { contenido: unknown; fuentesCitadas: FuenteCitada[] } | null {
  const porEtiqueta = new Map(fuentes.map((f) => [f.etiqueta, f]));
  const porId = new Map(fuentes.map((f) => [f.fuenteId, f]));

  if (tipo === "resumen") {
    const { texto, usadas } = filtrarEtiquetas((salida as Salidas["resumen"]).texto, "S", new Set(porEtiqueta.keys()));
    return { contenido: { texto }, fuentesCitadas: unicas(usadas.map((e) => porEtiqueta.get(e)!.fuenteId), porId) };
  }

  const clave = tipo === "quiz" ? "preguntas" : "tarjetas";
  const items = ((salida as Record<string, { fuente: string }[]>)[clave] ?? [])
    .filter((it) => porEtiqueta.has(it.fuente))
    .slice(0, cantidad)
    .map(({ fuente, ...resto }) => ({ ...resto, fuenteId: porEtiqueta.get(fuente)!.fuenteId }));
  if (!items.length) return null;
  return { contenido: { [clave]: items }, fuentesCitadas: unicas(items.map((i) => i.fuenteId), porId) };
}

export const NO_ENCONTRE = "No encontré eso en tus fuentes.";
export type CitaChat = FuenteCitada & { pagina: number | null; fragmento: string };

const sinTildes = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Chat (spec §4.5 paso 5): `[Cn]` = el fragmento n entregado. Si el modelo dice que no lo encontró, no hay citas.
export function citarChat(respuesta: string, frags: Recuperado[]): { contenido: string; fuentesCitadas: CitaChat[] } {
  // El modelo a veces la envuelve en comillas («…», "…") o en negritas.
  if (sinTildes(respuesta.replace(/^[\s«»"“”'*_]+/, "")).startsWith("no encontre")) return { contenido: NO_ENCONTRE, fuentesCitadas: [] };
  const etiquetas = new Map(frags.map((f, i) => [`C${i + 1}`, f]));
  const { texto, usadas } = filtrarEtiquetas(respuesta, "C", new Set(etiquetas.keys()));
  const fuentesCitadas = [...new Set(usadas)].map((e) => {
    const f = etiquetas.get(e)!;
    return { fuenteId: f.fuenteId, nombreArchivo: f.nombreArchivo, pagina: f.metadata.pagina ?? null, fragmento: f.contenido };
  });
  return { contenido: texto.trim(), fuentesCitadas };
}
