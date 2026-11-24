import { describe, expect, it } from "vitest";
import { AppError } from "@/server/http/errors";
import { validarSeleccion } from "./seleccion";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const AJENA = "99999999-9999-9999-9999-999999999999";

describe("validarSeleccion", () => {
  it("sin selección usa todas las fuentes listas (undefined)", () => {
    expect(validarSeleccion(undefined, [A, B])).toBeUndefined();
  });

  it("devuelve la selección sin repetidos", () => {
    expect(validarSeleccion([B, B, A], [A, B])).toEqual([B, A]);
  });

  it("rechaza con 400 VALIDACION una fuente que no es lista del espacio", () => {
    let error: unknown;
    try {
      validarSeleccion([A, AJENA], [A, B]);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).status).toBe(400);
    expect((error as AppError).codigo).toBe("VALIDACION");
    expect((error as AppError).message).toContain("fuenteIds");
  });
});
