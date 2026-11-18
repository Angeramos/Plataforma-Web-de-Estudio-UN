import { describe, expect, it } from "vitest";
import { AppError } from "@/server/http/errors";
import { detectarTipo } from "./tipo";

const bytes = (s: string) => new TextEncoder().encode(s);
const PDF = bytes("%PDF-1.7\n...");
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);

function falla(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    return e as AppError;
  }
  throw new Error("no lanzó");
}

describe("detectarTipo", () => {
  it.each([
    ["apuntes.txt", bytes("hola"), "txt"],
    ["Tema2.PDF", PDF, "pdf"],
    ["informe.docx", ZIP, "docx"],
    ["clase.pptx", ZIP, "pptx"],
  ])("%s → %s", (nombre, contenido, tipo) => {
    expect(detectarTipo(nombre, contenido)).toBe(tipo);
  });

  it.each(["virus.exe", "sin-extension", "foto.png", "viejo.doc", "notas.md"])("extensión no soportada %s → 415", (nombre) => {
    expect(falla(() => detectarTipo(nombre, bytes("x")))).toMatchObject({ status: 415, codigo: "TIPO_NO_SOPORTADO" });
  });

  it("un .pdf que no empieza con %PDF → 415", () => {
    expect(falla(() => detectarTipo("falso.pdf", bytes("no soy pdf")))).toMatchObject({ status: 415 });
  });

  it("un .docx/.pptx que no es ZIP → 415", () => {
    expect(falla(() => detectarTipo("falso.docx", PDF))).toMatchObject({ status: 415 });
    expect(falla(() => detectarTipo("falso.pptx", bytes("texto")))).toMatchObject({ status: 415 });
  });

  it("un .txt binario (con bytes nulos) → 415", () => {
    expect(falla(() => detectarTipo("raro.txt", new Uint8Array([0x68, 0x00, 0x69])))).toMatchObject({ status: 415 });
  });
});
