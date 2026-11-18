import { crear, espacioCreateSchema, listar } from "@/server/espacios/service";
import { requireUserId } from "@/server/http/auth";
import { handle } from "@/server/http/errors";
import { parseBody } from "@/server/http/validate";

export const GET = handle(async (req: Request) => {
  return Response.json(await listar(await requireUserId(req)));
});

export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  return Response.json(await crear(userId, await parseBody(req, espacioCreateSchema)), { status: 201 });
});
