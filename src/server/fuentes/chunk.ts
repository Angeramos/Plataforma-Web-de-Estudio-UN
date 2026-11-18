export interface Segmento {
  texto: string;
  metadata?: Record<string, unknown>; // p. ej. { pagina: 3 }
}

export interface Fragmento {
  orden: number;
  contenido: string;
  metadata: Record<string, unknown>;
}

// Espacios internos a uno; párrafos separados por una línea en blanco.
const normalizar = (texto: string) =>
  texto
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");

function cortar(texto: string, max: number, solape: number): string[] {
  const pedazos: string[] = [];
  let inicio = 0;
  while (inicio < texto.length) {
    let fin = Math.min(inicio + max, texto.length);
    if (fin < texto.length) {
      // Mejor corte en la segunda mitad de la ventana: párrafo, luego oración, luego espacio.
      const ventana = texto.slice(inicio, fin);
      const corte = [ventana.lastIndexOf("\n\n"), ventana.lastIndexOf(". ") + 1, ventana.lastIndexOf(" ")].find((i) => i >= max / 2);
      if (corte !== undefined) fin = inicio + corte;
    }
    const pedazo = texto.slice(inicio, fin).trim();
    if (pedazo) pedazos.push(pedazo);
    if (fin >= texto.length) break;

    // El siguiente empieza ≈`solape` caracteres antes, en el inicio de una palabra.
    let siguiente = Math.max(fin - solape, inicio + 1);
    if (!/\s/.test(texto[siguiente - 1])) {
      const espacio = texto.slice(siguiente, fin).search(/\s/);
      siguiente = espacio >= 0 ? siguiente + espacio : fin;
    }
    while (siguiente < texto.length && /\s/.test(texto[siguiente])) siguiente++;
    inicio = siguiente;
  }
  return pedazos;
}

// Puro. Cada segmento (p. ej. una página) se fragmenta por separado para que la cita conserve su página.
export function fragmentar(segmentos: Segmento[], { max = 1000, solape = 150 } = {}): Fragmento[] {
  let orden = 0;
  return segmentos.flatMap(({ texto, metadata = {} }) =>
    cortar(normalizar(texto), max, solape).map((contenido) => ({ orden: orden++, contenido, metadata })),
  );
}
