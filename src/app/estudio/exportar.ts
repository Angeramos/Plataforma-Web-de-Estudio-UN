// Convierte una generación del Estudio en un documento neutro que luego se dibuja como PDF o Word.
// Funciones puras: sin DOM ni librerías, para poder probarlas con vitest.

export type Generacion = {
  id: string;
  tipo: "resumen" | "quiz" | "flashcards";
  contenido: {
    texto?: string;
    preguntas?: Array<{ pregunta: string; opciones: string[]; correcta: number; explicacion: string; fuenteId: string }>;
    tarjetas?: Array<{ frente: string; reverso: string; fuenteId: string }>;
  };
  fuentesCitadas: Array<{ fuenteId: string; nombreArchivo: string; pagina?: number | null }>;
  createdAt: string;
};

export type Bloque =
  | { tipo: "seccion"; texto: string }
  | { tipo: "parrafo"; texto: string }
  | { tipo: "lista"; titulo?: string; items: string[] } // con título: el título en negrita y los ítems con sangría
  | { tipo: "tabla"; encabezados: [string, string]; filas: [string, string][] };

export type Documento = { titulo: string; subtitulo: string; bloques: Bloque[] };

export type FuenteRef = { id: string; nombreArchivo: string };

export const ETIQUETA: Record<Generacion["tipo"], string> = {
  resumen: "Resumen",
  quiz: "Cuestionario",
  flashcards: "Tarjetas",
};

export function nombreFuente(fuentes: FuenteRef[], id: string): string {
  return fuentes.find((f) => f.id === id)?.nombreArchivo ?? "Fuente eliminada";
}

const SIN_CONTENIDO: Bloque = { tipo: "parrafo", texto: "Este material no tiene contenido." };
const LETRAS = "abcd";

function slug(texto: string) {
  const limpio = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return limpio || "espacio";
}

export function nombreArchivo(g: Generacion, espacio: string, ext: "pdf" | "docx"): string {
  const fecha = new Date(g.createdAt).toLocaleDateString("en-CA"); // AAAA-MM-DD en la zona local
  return `${slug(ETIQUETA[g.tipo])}-${slug(espacio)}-${fecha}.${ext}`;
}

function plural(n: number, singular: string, varios: string) {
  return `${n} ${n === 1 ? singular : varios}`;
}

export function detalleCorto(g: Generacion): string {
  if (g.tipo === "quiz") return plural(g.contenido.preguntas?.length ?? 0, "pregunta", "preguntas");
  if (g.tipo === "flashcards") return plural(g.contenido.tarjetas?.length ?? 0, "tarjeta", "tarjetas");
  const n = g.fuentesCitadas.length;
  return n ? `Cita ${plural(n, "fuente", "fuentes")}` : "Sin fuentes citadas";
}

export function armarDocumento(g: Generacion, espacio: string, fuentes: FuenteRef[]): Documento {
  const fecha = new Date(g.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
  const fuente = (id: string) => nombreFuente(fuentes, id);
  return {
    titulo: `${ETIQUETA[g.tipo]} — ${espacio}`,
    subtitulo: `${espacio} · ${fecha}`,
    bloques: g.tipo === "resumen" ? bloquesResumen(g) : g.tipo === "quiz" ? bloquesQuiz(g, fuente) : bloquesTarjetas(g, fuente),
  };
}

// Las marcas [S1] / [S1, S2] sirven en la app; en el archivo sobran (las fuentes van listadas al final).
function sinMarcas(texto: string) {
  return texto.replace(/\s*\[S\d+(?:\s*,\s*S\d+)*\]/g, "");
}

function bloquesResumen(g: Generacion): Bloque[] {
  const parrafos = sinMarcas(g.contenido.texto ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parrafos.length) return [SIN_CONTENIDO];
  const bloques: Bloque[] = parrafos.map((texto) => ({ tipo: "parrafo", texto }));
  if (g.fuentesCitadas.length) {
    bloques.push({ tipo: "seccion", texto: "Fuentes citadas" });
    bloques.push({
      tipo: "lista",
      items: g.fuentesCitadas.map((c) => (c.pagina ? `${c.nombreArchivo} (p. ${c.pagina})` : c.nombreArchivo)),
    });
  }
  return bloques;
}

function bloquesQuiz(g: Generacion, fuente: (id: string) => string): Bloque[] {
  const preguntas = g.contenido.preguntas ?? [];
  if (!preguntas.length) return [SIN_CONTENIDO];
  return [
    { tipo: "seccion", texto: "Preguntas" },
    ...preguntas.map((p, i): Bloque => ({
      tipo: "lista",
      titulo: `${i + 1}. ${p.pregunta}`,
      items: p.opciones.map((o, j) => `${LETRAS[j]}) ${o}`),
    })),
    { tipo: "seccion", texto: "Respuestas" },
    {
      tipo: "lista",
      items: preguntas.map(
        (p, i) => `${i + 1}. ${LETRAS[p.correcta]}) ${p.opciones[p.correcta]} — ${p.explicacion} (Fuente: ${fuente(p.fuenteId)})`,
      ),
    },
  ];
}

function bloquesTarjetas(g: Generacion, fuente: (id: string) => string): Bloque[] {
  const tarjetas = g.contenido.tarjetas ?? [];
  if (!tarjetas.length) return [SIN_CONTENIDO];
  return [
    {
      tipo: "tabla",
      encabezados: ["Frente", "Reverso"],
      filas: tarjetas.map((t): [string, string] => [t.frente, `${t.reverso} (Fuente: ${fuente(t.fuenteId)})`]),
    },
  ];
}
