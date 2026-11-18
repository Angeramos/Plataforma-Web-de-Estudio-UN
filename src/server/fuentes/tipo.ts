import { AppError } from "@/server/http/errors";

export type TipoArchivo = "pdf" | "docx" | "pptx" | "txt";

const TIPOS: readonly TipoArchivo[] = ["pdf", "docx", "pptx", "txt"];
const empiezaCon = (b: Uint8Array, firma: number[]) => firma.every((x, i) => b[i] === x);
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const ZIP = [0x50, 0x4b, 0x03, 0x04]; // docx y pptx son ZIP

const noSoportado = (mensaje: string) => new AppError(415, "TIPO_NO_SOPORTADO", mensaje);

// Puro. El tipo lo da la extensión y se confirma con la firma del contenido (spec §4.3).
export function detectarTipo(nombre: string, bytes: Uint8Array): TipoArchivo {
  const ext = nombre.includes(".") ? nombre.split(".").pop()!.toLowerCase() : "";
  const tipo = TIPOS.find((t) => t === ext);
  if (!tipo) throw noSoportado("Solo se aceptan archivos PDF, DOCX, PPTX o TXT");

  const coincide =
    tipo === "pdf" ? empiezaCon(bytes, PDF) : tipo === "txt" ? !bytes.subarray(0, 8192).includes(0) : empiezaCon(bytes, ZIP);
  if (!coincide) throw noSoportado(`El contenido del archivo no corresponde a un ${tipo.toUpperCase()}`);
  return tipo;
}
