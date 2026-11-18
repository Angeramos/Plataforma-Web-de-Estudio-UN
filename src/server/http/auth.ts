import { verifyToken } from "@/server/auth/token";
import { AppError } from "./errors";

// Id del usuario del header `Authorization: Bearer <token>`, o 401 NO_AUTENTICADO.
export async function requireUserId(req: Request): Promise<string> {
  const [scheme, token] = req.headers.get("authorization")?.split(" ") ?? [];
  const userId = scheme?.toLowerCase() === "bearer" && token ? await verifyToken(token) : null;
  if (!userId) throw new AppError(401, "NO_AUTENTICADO", "Token ausente o inválido");
  return userId;
}
