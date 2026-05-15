import Database from "better-sqlite3";

export function initDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS server_definitions (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      game         TEXT NOT NULL,
      port         INTEGER NOT NULL,
      imageOverride TEXT,
      gameConfig   TEXT NOT NULL,
      createdAt    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS server_instances (
      definitionId TEXT PRIMARY KEY,
      containerId  TEXT NOT NULL DEFAULT '',
      status       TEXT NOT NULL DEFAULT 'registered',
      startedAt    TEXT,
      stoppedAt    TEXT,
      FOREIGN KEY (definitionId) REFERENCES server_definitions(id)
    );
  `);
}