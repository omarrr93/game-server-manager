import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ServerManager } from "../core/ServerManager";

export async function logRoutes(
  app: FastifyInstance,
  manager: ServerManager
): Promise<void> {

  // ─── Get Logs ───────────────────────────────────────────────────────────────

  app.get("/servers/:id/logs", async (
    req: FastifyRequest<{ Params: { id: string }; Querystring: { tail?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const tail = req.query.tail ? parseInt(req.query.tail, 10) : 100;

      if (isNaN(tail) || tail < 1 || tail > 10000) {
        return reply.status(400).send({ error: "tail must be a number between 1 and 10000" });
      }

      const logs = await manager.getLogs(req.params.id, tail);
      return reply.status(200).send({ logs });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });
}