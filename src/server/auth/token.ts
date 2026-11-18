import { jwtVerify, SignJWT } from "jose";
import { env } from "@/server/env";

const key = (secret: string) => new TextEncoder().encode(secret);

// JWT HS256 de 24 h con sub = id del usuario (D-029). Sin refresh token (D-007).
export function signToken(userId: string, secret = env().JWT_SECRET): Promise<string> {
  return new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setExpirationTime("24h").sign(key(secret));
}

// Devuelve el id del usuario, o null si el token es inválido, ajeno o venció.
export async function verifyToken(token: string, secret = env().JWT_SECRET): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
