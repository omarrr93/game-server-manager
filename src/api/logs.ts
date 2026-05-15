import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { WebSocket } from "ws";
import { ServerManager } from "../core/ServerManager";

export async function logRoutes(
  app: FastifyInstance,
  manager: ServerManager
): Promise<void> {

  // ─── GET /servers/:id/logs — snapshot (HTTP) ────────────────────────────────

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

  // ─── POST /servers/:id/exec — send a console command via docker exec ─────────

  app.post("/servers/:id/exec", async (
    req: FastifyRequest<{ Params: { id: string }; Body: { command: string } }>,
    reply: FastifyReply
  ) => {
    const { command } = req.body ?? {};

    if (typeof command !== "string" || !command.trim()) {
      return reply.status(400).send({ error: "command must be a non-empty string" });
    }

    try {
      const output = await manager.sendCommand(req.params.id, command.trim());
      return reply.status(200).send({ output });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // ─── GET /servers/:id/logs/stream — live stream (WebSocket) ─────────────────
  // Query param: tail (default 200) — number of historical lines sent on connect.

  app.get(
    "/servers/:id/logs/stream",
    { websocket: true },
    async (
      socket: WebSocket,
      req: FastifyRequest<{ Params: { id: string }; Querystring: { tail?: string } }>
    ) => {
      const { id } = req.params;
      const tailRaw = req.query.tail ? parseInt(req.query.tail, 10) : 200;
      const tail = isNaN(tailRaw) || tailRaw < 1 ? 200 : Math.min(tailRaw, 10000);

      let cleanup: (() => void) | null = null;

      try {
        cleanup = await manager.streamLogs(
          id,
          tail,
          (chunk) => {
            if (socket.readyState === socket.OPEN) {
              socket.send(chunk);
            }
          },
          () => {
            if (socket.readyState === socket.OPEN) {
              socket.close(1000, "container stopped");
            }
          }
        );
      } catch (err) {
        // Close with Internal Error; reason is capped at 123 bytes by the WS spec.
        socket.close(1011, (err as Error).message.slice(0, 123));
        return;
      }

      socket.on("close", () => cleanup?.());
      socket.on("error", () => cleanup?.());
    }
  );
}