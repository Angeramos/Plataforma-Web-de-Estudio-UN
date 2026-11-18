import { z } from "zod";
import { Prisma, type users } from "@/generated/prisma/client";
import { db } from "@/server/db/prisma";
import { AppError } from "@/server/http/errors";
import { hashPassword, verifyPassword } from "./password";
import { signToken } from "./token";

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().trim().min(1),
});

export const loginSchema = z.object({ email: z.email(), password: z.string() });

export const toUserDto = (u: users) => ({ id: u.id, email: u.email, name: u.name });

const credencialesInvalidas = () => new AppError(401, "NO_AUTENTICADO", "Correo o contraseña incorrectos");

async function authResponse(user: users) {
  return { user: toUserDto(user), accessToken: await signToken(user.id) };
}

// El correo se guarda tal cual; la unicidad la da el índice users_email_lower_uidx (lower(email)).
export async function register(input: z.infer<typeof registerSchema>) {
  try {
    const user = await db().users.create({
      data: { email: input.email, name: input.name, password_hash: await hashPassword(input.password) },
    });
    return authResponse(user);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AppError(409, "EMAIL_YA_REGISTRADO", "El correo ya está registrado");
    }
    throw err;
  }
}

export async function login(input: z.infer<typeof loginSchema>) {
  // `mode: insensitive` puede usar ILIKE (donde _ y % son comodines): se filtra después por igualdad exacta.
  const email = input.email.toLowerCase();
  const candidatos = await db().users.findMany({ where: { email: { equals: input.email, mode: "insensitive" } } });
  const user = candidatos.find((u) => u.email.toLowerCase() === email) ?? null;
  if (!(await verifyPassword(input.password, user?.password_hash ?? null)) || !user) throw credencialesInvalidas();
  return authResponse(user);
}

export async function me(userId: string) {
  const user = await db().users.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(401, "NO_AUTENTICADO", "Sesión inválida");
  return toUserDto(user);
}
