import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("el hash no es la contraseña y la verifica", async () => {
    const hash = await hashPassword("clave-segura-1");
    expect(hash).not.toContain("clave-segura-1");
    expect(await verifyPassword("clave-segura-1", hash)).toBe(true);
  });

  it("rechaza una contraseña distinta", async () => {
    const hash = await hashPassword("clave-segura-1");
    expect(await verifyPassword("clave-segura-2", hash)).toBe(false);
  });

  it("sin hash (usuario inexistente) responde false sin lanzar", async () => {
    expect(await verifyPassword("lo-que-sea", null)).toBe(false);
  });
});
