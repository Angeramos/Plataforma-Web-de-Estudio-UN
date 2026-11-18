import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { signToken, verifyToken } from "./token";

const SECRET = "s".repeat(32);
const OTHER = "o".repeat(32);
const USER = "3f2c1a9e-8b7d-4c6e-9f1a-2b3c4d5e6f70";

describe("token", () => {
  it("firma y verifica: devuelve el id del usuario (sub)", async () => {
    const token = await signToken(USER, SECRET);
    expect(await verifyToken(token, SECRET)).toBe(USER);
  });

  it("vence a las 24 h", async () => {
    const token = await signToken(USER, SECRET);
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    expect(payload.exp - payload.iat).toBe(24 * 60 * 60);
  });

  it("rechaza un token firmado con otro secreto", async () => {
    expect(await verifyToken(await signToken(USER, OTHER), SECRET)).toBeNull();
  });

  it("rechaza un token vencido", async () => {
    const vencido = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(USER)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyToken(vencido, SECRET)).toBeNull();
  });

  it("rechaza un token sin sub", async () => {
    const sinSub = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode(SECRET));
    expect(await verifyToken(sinSub, SECRET)).toBeNull();
  });

  it.each(["", "basura", "a.b.c"])("rechaza texto que no es un token: %j", async (t) => {
    expect(await verifyToken(t, SECRET)).toBeNull();
  });
});
