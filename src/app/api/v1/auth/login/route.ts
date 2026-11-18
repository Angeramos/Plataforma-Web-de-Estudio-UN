import { login, loginSchema } from "@/server/auth/service";
import { handle } from "@/server/http/errors";
import { parseBody } from "@/server/http/validate";

export const POST = handle(async (req: Request) => {
  return Response.json(await login(await parseBody(req, loginSchema)));
});
