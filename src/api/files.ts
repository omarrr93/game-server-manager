import fs from "fs";
import path from "path";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ServerRepository } from "../db/repository";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getServerDataPath(serverId: string, repo: ServerRepository): string {
  const definition = repo.getDefinition(serverId);
  if (!definition) throw new Error(`Server not found: ${serverId}`);

  const base = definition.game === "minecraft"
    ? path.resolve("data", "minecraft", serverId)
    : path.resolve("data", "steam", serverId);

  return base;
}

// Prevent path traversal — ensure resolved path stays within base
function safePath(base: string, userPath: string): string {
  const resolved = path.resolve(base, userPath.replace(/^\/+/, ""));
  if (!resolved.startsWith(base)) {
    throw new Error("Access denied: path outside server directory");
  }
  return resolved;
}

function getFileType(filePath: string): "text" | "binary" {
  const textExtensions = [
    ".txt", ".log", ".json", ".yaml", ".yml", ".toml",
    ".properties", ".cfg", ".conf", ".ini", ".sh",
    ".md", ".xml", ".html", ".css", ".js", ".ts",
  ];
  return textExtensions.includes(path.extname(filePath).toLowerCase())
    ? "text"
    : "binary";
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  type: "text" | "binary" | "directory";
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function fileRoutes(
  app: FastifyInstance,
  repo: ServerRepository
): Promise<void> {

  // ─── List directory ─────────────────────────────────────────────────────────
  app.get("/servers/:id/files", async (
    req: FastifyRequest<{ Params: { id: string }; Querystring: { path?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const base = getServerDataPath(req.params.id, repo);
      const dirPath = safePath(base, req.query.path ?? "/");

      if (!fs.existsSync(dirPath)) {
        return reply.status(200).send({ path: req.query.path ?? "/", entries: [] });
      }

      const entries = fs.readdirSync(dirPath);
      const result: FileEntry[] = entries.map((name): FileEntry => {
        const fullPath = path.join(dirPath, name);
        const stat = fs.statSync(fullPath);
        const relativePath = path.join(req.query.path ?? "/", name);

        return {
          name,
          path: relativePath,
          isDirectory: stat.isDirectory(),
          size: stat.isDirectory() ? 0 : stat.size,
          modifiedAt: stat.mtime.toISOString(),
          type: stat.isDirectory() ? "directory" : getFileType(name),
        };
      }).sort((a, b) => {
        // Directories first, then alphabetical
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return reply.status(200).send({ path: req.query.path ?? "/", entries: result });
    } catch (err) {
      req.log.error({ err }, "Failed to list files");
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // ─── Read file ──────────────────────────────────────────────────────────────
  app.get("/servers/:id/files/content", async (
    req: FastifyRequest<{ Params: { id: string }; Querystring: { path: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const base = getServerDataPath(req.params.id, repo);
      const filePath = safePath(base, req.query.path);

      if (!fs.existsSync(filePath)) {
        return reply.status(404).send({ error: "File not found" });
      }

      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        return reply.status(400).send({ error: "Path is a directory" });
      }

      if (getFileType(filePath) === "binary") {
        return reply.status(400).send({ error: "Binary files cannot be edited" });
      }

      const content = fs.readFileSync(filePath, "utf8");
      return reply.status(200).send({ content, path: req.query.path });
    } catch (err) {
      req.log.error({ err }, "Failed to read file");
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // ─── Write file ─────────────────────────────────────────────────────────────
  app.put("/servers/:id/files/content", async (
    req: FastifyRequest<{ Params: { id: string }; Body: { path: string; content: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const base = getServerDataPath(req.params.id, repo);
      const filePath = safePath(base, req.body.path);

      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, req.body.content, "utf8");

      return reply.status(200).send({ success: true });
    } catch (err) {
      req.log.error({ err }, "Failed to write file");
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // ─── Delete ─────────────────────────────────────────────────────────────────
  app.delete("/servers/:id/files", async (
    req: FastifyRequest<{ Params: { id: string }; Querystring: { path: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const base = getServerDataPath(req.params.id, repo);
      const filePath = safePath(base, req.query.path);

      if (!fs.existsSync(filePath)) {
        return reply.status(404).send({ error: "File not found" });
      }

      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }

      return reply.status(200).send({ success: true });
    } catch (err) {
      req.log.error({ err }, "Failed to delete file");
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // ─── Rename / move ──────────────────────────────────────────────────────────
  app.patch("/servers/:id/files/rename", async (
    req: FastifyRequest<{ Params: { id: string }; Body: { path: string; newName: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const base = getServerDataPath(req.params.id, repo);
      const oldPath = safePath(base, req.body.path);
      const newPath = safePath(base, path.join(path.dirname(req.body.path), req.body.newName));

      if (!fs.existsSync(oldPath)) {
        return reply.status(404).send({ error: "File not found" });
      }

      fs.renameSync(oldPath, newPath);
      return reply.status(200).send({ success: true });
    } catch (err) {
      req.log.error({ err }, "Failed to rename file");
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // ─── Create folder ──────────────────────────────────────────────────────────
  app.post("/servers/:id/files/mkdir", async (
    req: FastifyRequest<{ Params: { id: string }; Body: { path: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const base = getServerDataPath(req.params.id, repo);
      const dirPath = safePath(base, req.body.path);

      fs.mkdirSync(dirPath, { recursive: true });
      return reply.status(200).send({ success: true });
    } catch (err) {
      req.log.error({ err }, "Failed to create directory");
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // ─── Upload file ────────────────────────────────────────────────────────────
  app.post("/servers/:id/files/upload", async (
    req: FastifyRequest<{ Params: { id: string }; Querystring: { path?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const base = getServerDataPath(req.params.id, repo);
      const uploadDir = safePath(base, req.query.path ?? "/");

      fs.mkdirSync(uploadDir, { recursive: true });

      const parts = req.parts();
      const savedFiles: string[] = [];

      for await (const part of parts) {
        if (part.type === "file") {
          const destPath = path.join(uploadDir, part.filename);
          const buffer = await part.toBuffer();
          fs.writeFileSync(destPath, buffer);
          savedFiles.push(part.filename);
        }
      }

      return reply.status(200).send({ uploaded: savedFiles });
    } catch (err) {
      req.log.error({ err }, "Failed to upload file");
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // ─── Download file ──────────────────────────────────────────────────────────
  app.get("/servers/:id/files/download", async (
    req: FastifyRequest<{ Params: { id: string }; Querystring: { path: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const base = getServerDataPath(req.params.id, repo);
      const filePath = safePath(base, req.query.path);

      if (!fs.existsSync(filePath)) {
        return reply.status(404).send({ error: "File not found" });
      }

      const fileName = path.basename(filePath);
      const stream = fs.createReadStream(filePath);

      return reply
        .header("Content-Disposition", `attachment; filename="${fileName}"`)
        .header("Content-Type", "application/octet-stream")
        .send(stream);
    } catch (err) {
      req.log.error({ err }, "Failed to download file");
      return reply.status(500).send({ error: (err as Error).message });
    }
  });
}