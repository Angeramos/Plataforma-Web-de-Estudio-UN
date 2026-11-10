import bcrypt from "bcryptjs";

const ROUNDS = 10;
let dummyHash: Promise<string> | undefined;

export const hashPassword = (password: string) => bcrypt.hash(password, ROUNDS);

// Sin hash (correo inexistente) se compara igual contra uno ficticio: mismo tiempo de respuesta, no revela qué correos existen.
export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (hash) return bcrypt.compare(password, hash);
  await bcrypt.compare(password, await (dummyHash ??= hashPassword("contraseña-ficticia")));
  return false;
}
