// Contexto para generaciones (spec §4.4 paso 2, D-025). Puro: recibe los fragmentos de las fuentes `listo`.
export type FragCtx = { fuenteId: string; nombreArchivo: string; orden: number; contenido: string };
export type FuenteCtx = { etiqueta: string; fuenteId: string; nombreArchivo: string };

type Grupo = { fuenteId: string; nombreArchivo: string; frags: FragCtx[]; largo: number };

// `maxChars` cuenta el contenido de los fragmentos; las cabeceras `[S1] nombre` son unos pocos caracteres más.
export function armarContexto(frags: FragCtx[], maxChars: number): { texto: string; fuentes: FuenteCtx[] } {
  const grupos = new Map<string, Grupo>();
  for (const f of frags) {
    const g = grupos.get(f.fuenteId) ?? { fuenteId: f.fuenteId, nombreArchivo: f.nombreArchivo, frags: [], largo: 0 };
    g.frags.push(f);
    g.largo += f.contenido.length;
    grupos.set(f.fuenteId, g);
  }
  const lista = [...grupos.values()];
  for (const g of lista) g.frags.sort((a, b) => a.orden - b.orden);

  // Reparto del presupuesto: de la fuente más chica a la más grande; lo que una no usa pasa a las siguientes.
  const presupuesto = new Map<Grupo, number>();
  let restante = maxChars;
  [...lista]
    .sort((a, b) => a.largo - b.largo)
    .forEach((g, i, orden) => {
      const parte = Math.min(g.largo, Math.floor(restante / (orden.length - i)));
      presupuesto.set(g, parte);
      restante -= parte;
    });

  const fuentes = lista.map((g, i) => ({ etiqueta: `S${i + 1}`, fuenteId: g.fuenteId, nombreArchivo: g.nombreArchivo }));
  const bloques = lista.map((g, i) => `[${fuentes[i].etiqueta}] ${g.nombreArchivo}\n${muestrear(g, presupuesto.get(g)!).join("\n\n")}`);
  return { texto: bloques.join("\n\n"), fuentes };
}

// Fragmentos repartidos uniformemente a lo largo de la fuente, en orden, sin pasarse del presupuesto.
// Al menos uno por fuente (recortado si hace falta), para que ninguna fuente quede fuera.
function muestrear(g: Grupo, presupuesto: number): string[] {
  if (g.largo <= presupuesto) return g.frags.map((f) => f.contenido);
  const n = Math.max(1, Math.floor(presupuesto / (g.largo / g.frags.length)));
  const indices = [...new Set(Array.from({ length: n }, (_, j) => Math.floor((j * g.frags.length) / n)))];
  const out: string[] = [];
  let usado = 0;
  for (const i of indices) {
    const c = g.frags[i].contenido;
    if (usado + c.length <= presupuesto) {
      out.push(c);
      usado += c.length;
    }
  }
  return out.length ? out : [g.frags[indices[0]].contenido.slice(0, Math.max(presupuesto, 1))];
}
