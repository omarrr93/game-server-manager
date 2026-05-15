import Fastify from "fastify";
import multipart from "@fastify/multipart";
import Database from "better-sqlite3";
import { initDb } from "./db/schema";
import { ServerRepository } from "./db/repository";
import { DockerClient } from "./docker/DockerClient";
import { ServerManager } from "./core/ServerManager";
import { serverRoutes } from "./api/servers";
import { logRoutes } from "./api/logs";
import { fileRoutes } from "./api/files";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST ?? "0.0.0.0";
const DB_PATH = process.env.DB_PATH ?? "gscp.db";

async function bootstrap(): Promise<void> {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initDb(db);

  const repo = new ServerRepository(db);
  const docker = new DockerClient();
  const manager = new ServerManager(docker, repo);

  const app = Fastify({ logger: true });

  // Register multipart for file uploads (100MB limit)
  await app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024 } });

  await serverRoutes(app, manager);
  await logRoutes(app, manager);
  await fileRoutes(app, repo);

  await app.listen({ port: PORT, host: HOST });
  console.log(`GSCP running on http://${HOST}:${PORT}`);
}

bootstrap().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});