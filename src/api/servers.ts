import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ServerManager } from "../core/ServerManager";
import { RegisterServerRequest, UpdateServerRequest } from "../core/types";

export async function serverRoutes(
  app: FastifyInstance,
  manager: ServerManager
): Promise<void> {

  // ─── Register ───────────────────────────────────────────────────────────────

  app.post("/servers", async (
    req: FastifyRequest<{ Body: RegisterServerRequest }>,
    reply: FastifyReply
  ) => {
    try {
      const result = await manager.register(req.body);
      return reply.status(201).send(result);
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message });
    }
  });

  // ─── List ───────────────────────────────────────────────────────────────────

  app.get("/servers", async (
    _req: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const results = await manager.list();
      return reply.status(200).send(results);
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // ─── Get ────────────────────────────────────────────────────────────────────

  app.get("/servers/:id", async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const result = await manager.get(req.params.id);
      return reply.status(200).send(result);
    } catch (err) {
      return reply.status(404).send({ error: (err as Error).message });
    }
  });

  app.patch("/servers/:id", async (
    req: FastifyRequest<{ Params: { id: string }; Body: UpdateServerRequest }>,
    reply: FastifyReply
  ) => {
    try {
      const result = await manager.update(req.params.id, req.body);
      return reply.status(200).send(result);
    } catch (err) {
      req.log.error({ err }, "Failed to update server");
      return reply.status(400).send({ error: (err as Error).message });
    }
  });

  app.get("/servers/:id/stats", async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const stats = await manager.getStats(req.params.id);
      return reply.status(200).send(stats);
    } catch (err) {
      req.log.error({ err }, "Failed to get server stats");
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // ─── Start ──────────────────────────────────────────────────────────────────

  app.post("/servers/:id/start", async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const result = await manager.start(req.params.id);
      return reply.status(200).send(result);
    } catch (err) {
      req.log.error({ err }, "Failed to start server");
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // ─── Stop ───────────────────────────────────────────────────────────────────

  app.post("/servers/:id/stop", async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const result = await manager.stop(req.params.id);
      return reply.status(200).send(result);
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // ─── Deregister ─────────────────────────────────────────────────────────────

  app.delete("/servers/:id", async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      await manager.deregister(req.params.id);
      return reply.status(204).send();
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });
}