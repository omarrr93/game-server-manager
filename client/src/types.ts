export type GameType = "minecraft" | "steam";

export type ServerStatus =
  | "registered"
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "errored";

export interface MinecraftConfig {
  game: "minecraft";
  memory: string;
  serverType: "vanilla" | "paper" | "fabric" | "forge";
  version?: string;
  motd?: string;
  maxPlayers?: number;
}

export interface SteamConfig {
  game: "steam";
  appId: number;
  extraArgs?: string;
}

export interface ServerDefinition {
  id: string;
  name: string;
  game: GameType;
  port: number;
  imageOverride?: string;
  gameConfig: MinecraftConfig | SteamConfig;
  createdAt: string;
}

export interface ServerInstance {
  definitionId: string;
  containerId: string;
  status: ServerStatus;
  startedAt?: string;
  stoppedAt?: string;
}

export interface ServerResponse {
  definition: ServerDefinition;
  instance: ServerInstance | null;
}