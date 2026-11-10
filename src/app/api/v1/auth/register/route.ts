import { register, registerSchema } from "@/server/auth/service";
import { handle } from "@/server/http/errors";
import { parseBody } from "@/server/http/validate";

export const POST = handle(async (req: Request) => {
  return Response.json(await register(await parseBody(req, registerSchema)), { status: 201 });
});
