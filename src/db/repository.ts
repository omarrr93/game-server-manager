import Database from "better-sqlite3";
import { ServerDefinition, ServerInstance } from "../core/types";

export class ServerRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // ─── Definitions ────────────────────────────────────────────────────────────

  saveDefinition(definition: ServerDefinition): void {
    const stmt = this.db.prepare(`
      INSERT INTO server_definitions (id, name, game, port, imageOverride, gameConfig, createdAt)
      VALUES (@id, @name, @game, @port, @imageOverride, @gameConfig, @createdAt)
      ON CONFLICT(id) DO UPDATE SET
        name          = excluded.name,
        port          = excluded.port,
        imageOverride = excluded.imageOverride,
        gameConfig    = excluded.gameConfig
    `);

    stmt.run({
      ...definition,
      gameConfig: JSON.stringify(definition.gameConfig),
    });
  }

  getDefinition(id: string): ServerDefinition | null {
    const row = this.db
      .prepare(`SELECT * FROM server_definitions WHERE id = ?`)
      .get(id) as RawDefinitionRow | undefined;

    return row ? this.parseDefinition(row) : null;
  }

  listDefinitions(): ServerDefinition[] {
    const rows = this.db
      .prepare(`SELECT * FROM server_definitions ORDER BY createdAt DESC`)
      .all() as RawDefinitionRow[];

    return rows.map(this.parseDefinition);
  }

  // ─── Instances ──────────────────────────────────────────────────────────────

  saveInstance(instance: ServerInstance): void {
    this.db.prepare(`
      INSERT INTO server_instances (definitionId, containerId, status, startedAt, stoppedAt)
      VALUES (@definitionId, @containerId, @status, @startedAt, @stoppedAt)
      ON CONFLICT(definitionId) DO UPDATE SET
        containerId = excluded.containerId,
        status      = excluded.status,
        startedAt   = excluded.startedAt,
        stoppedAt   = excluded.stoppedAt
    `).run(instance);
  }

  getInstance(definitionId: string): ServerInstance | null {
    const row = this.db
      .prepare(`SELECT * FROM server_instances WHERE definitionId = ?`)
      .get(definitionId) as ServerInstance | undefined;

    return row ?? null;
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────────

  deleteServer(id: string): void {
    // Order matters — instance has FK reference to definition
    this.db.prepare(`DELETE FROM server_instances WHERE definitionId = ?`).run(id);
    this.db.prepare(`DELETE FROM server_definitions WHERE id = ?`).run(id);
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private parseDefinition(row: RawDefinitionRow): ServerDefinition {
    return {
      ...row,
      gameConfig: JSON.parse(row.gameConfig),
    };
  }
}

// ─── Raw Row Types ────────────────────────────────────────────────────────────
// SQLite returns plain objects — gameConfig comes back as a JSON string.

interface RawDefinitionRow extends Omit<ServerDefinition, "gameConfig"> {
  gameConfig: string;
}