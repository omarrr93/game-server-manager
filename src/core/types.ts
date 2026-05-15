// ─── Game Types ───────────────────────────────────────────────────────────────

export type GameType = "minecraft" | "steam";

export type ServerStatus =
  | "registered"  // exists in DB, never started
  | "starting"    // container being created
  | "running"     // container confirmed up
  | "stopping"    // stop requested
  | "stopped"     // container exited cleanly
  | "errored";    // something went wrong :(

// ─── Server Definition ────────────────────────────────────────────────────────
// Static config - what you register. Does not change at runtime.

export interface ServerDefinition {
  id: string;
  name: string;
  game: GameType;
  port: number;

  // Optional image override - adapters provide a default
  imageOverride?: string;

  // Game-specific config bag (type-narrowed by game)
  gameConfig: MinecraftConfig | SteamConfig;

  createdAt: string; // ISO timestamp
}

// ─── Game Configs ─────────────────────────────────────────────────────────────

export interface MinecraftConfig {
  game: "minecraft";
  memory: string;          // e.g. "2G"
  serverType: "vanilla" | "paper" | "fabric" | "forge";
  version?: string;        // e.g. "1.21.1", defaults to "LATEST"
  motd?: string;
  maxPlayers?: number;
}

export interface SteamConfig {
  game: "steam";
  appId: number;           // e.g. 730 for CS2
  extraArgs?: string;      // extra launch args passed to srcds / server binary
  steamUsername?: string;  // some servers need auth (anonymous by default)
}

// ─── Server Instance ──────────────────────────────────────────────────────────
// Runtime state — created when a server is first started.

export interface ServerInstance {
  definitionId: string;
  containerId: string;
  status: ServerStatus;
  startedAt?: string;  // ISO timestamp
  stoppedAt?: string;  // ISO timestamp
}

// ─── Adapter Interface ────────────────────────────────────────────────────────

export interface ContainerConfig {
  image: string;
  name: string;             // Docker container name
  env: Record<string, string>;
  portBindings: PortBinding[];
  volumes?: VolumeMount[];
  cmd?: string[];           // override entrypoint args if needed
}

export interface PortBinding {
  containerPort: number;
  hostPort: number;
  protocol?: "tcp" | "udp"; // defaults to tcp
}

export interface VolumeMount {
  hostPath: string;
  containerPath: string;
}

export interface GameAdapter {
  readonly gameType: GameType;
  getDefaultImage(): string;
  buildContainerConfig(definition: ServerDefinition): ContainerConfig;
}

// ─── API Shapes ───────────────────────────────────────────────────────────────
// What the HTTP layer accepts/returns. Kept separate from internal types.

export interface RegisterServerRequest {
  name: string;
  game: GameType;
  port: number;
  imageOverride?: string;
  gameConfig: MinecraftConfig | SteamConfig;
}

export interface ServerResponse {
  definition: ServerDefinition;
  instance: ServerInstance | null;
}

export interface UpdateServerRequest {
  name?: string;
  port?: number;
  gameConfig?: MinecraftConfig | SteamConfig;
}