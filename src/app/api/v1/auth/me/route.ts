import { me } from "@/server/auth/service";
import { requireUserId } from "@/server/http/auth";
import { handle } from "@/server/http/errors";

export const GET = handle(async (req: Request) => {
  return Response.json(await me(await requireUserId(req)));
});
