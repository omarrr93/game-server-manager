import { v4 as uuidv4 } from "uuid";
import { DockerClient } from "../docker/DockerClient";
import { GameAdapter, RegisterServerRequest, ServerDefinition, ServerInstance, ServerResponse, ServerStatus, UpdateServerRequest } from "./types";
import { MinecraftAdapter } from "../adapters/MinecraftAdapter";
import { SteamAdapter } from "../adapters/SteamAdapter";
import { ServerRepository } from "../db/repository";

// ─── Adapter Registry ─────────────────────────────────────────────────────────

const ADAPTERS: GameAdapter[] = [
  new MinecraftAdapter(),
  new SteamAdapter(),
];

// ─── ServerManager ────────────────────────────────────────────────────────────

export class ServerManager {
  private docker: DockerClient;
  private repo: ServerRepository;
  private adapterMap: Map<string, GameAdapter>;

  constructor(docker: DockerClient, repo: ServerRepository) {
    this.docker = docker;
    this.repo = repo;
    this.adapterMap = new Map(ADAPTERS.map((a) => [a.gameType, a]));
  }

  // ─── Register ──────────────────────────────────────────────────────────────
  // Creates a ServerDefinition and persists it. Does NOT start a container.

  async register(request: RegisterServerRequest): Promise<ServerResponse> {
    const definition: ServerDefinition = {
      id: uuidv4(),
      name: request.name,
      game: request.game,
      port: request.port,
      imageOverride: request.imageOverride,
      gameConfig: request.gameConfig,
      createdAt: new Date().toISOString(),
    };

    this.repo.saveDefinition(definition);

    return { definition, instance: null };
  }

  async update(serverId: string, request: UpdateServerRequest): Promise<ServerResponse> {
    const existing = this.getDefinitionOrThrow(serverId);

    // Merge top-level fields
    const updatedDefinition: ServerDefinition = {
      ...existing,
      name: request.name ?? existing.name,
      port: request.port ?? existing.port,
    };

    // Merge gameConfig fields shallowly — only override keys that were sent
    if (request.gameConfig) {
      updatedDefinition.gameConfig = {
        ...existing.gameConfig,
        ...request.gameConfig,
      };
    }

    this.repo.saveDefinition(updatedDefinition);

    const instance = this.repo.getInstance(serverId) ?? null;
    return { definition: updatedDefinition, instance };
  }

  // ─── Start ─────────────────────────────────────────────────────────────────

  async start(serverId: string): Promise<ServerResponse> {
    const definition = this.getDefinitionOrThrow(serverId);
    const adapter = this.getAdapterOrThrow(definition.game);

    const existing = this.repo.getInstance(serverId);

    // If already running, return current state without touching Docker
    if (existing?.status === "running") {
      return { definition, instance: existing };
    }

    this.upsertInstance(serverId, { status: "starting" });

    try {
      const containerConfig = adapter.buildContainerConfig(definition);
      const containerId = await this.docker.startContainer(containerConfig);

      const instance = this.upsertInstance(serverId, {
        containerId,
        status: "running",
        startedAt: new Date().toISOString(),
        stoppedAt: undefined,
      });

      return { definition, instance };
    } catch (err) {
      this.upsertInstance(serverId, { status: "errored" });
      throw err;
    }
  }

  // ─── Stop ──────────────────────────────────────────────────────────────────

  async stop(serverId: string): Promise<ServerResponse> {
    const definition = this.getDefinitionOrThrow(serverId);
    const instance = this.getInstanceOrThrow(serverId);

    if (instance.status === "stopped") {
      return { definition, instance };
    }

    this.upsertInstance(serverId, { status: "stopping" });

    try {
      await this.docker.stopContainer(instance.containerId);

      const updated = this.upsertInstance(serverId, {
        status: "stopped",
        stoppedAt: new Date().toISOString(),
      });

      return { definition, instance: updated };
    } catch (err) {
      this.upsertInstance(serverId, { status: "errored" });
      throw err;
    }
  }

  // ─── Get ───────────────────────────────────────────────────────────────────

  async get(serverId: string): Promise<ServerResponse> {
    const definition = this.getDefinitionOrThrow(serverId);
    const instance = this.repo.getInstance(serverId) ?? null;

    // Sync status with actual Docker state if we have a container
    if (instance?.containerId) {
      const liveStatus = await this.docker.getContainerStatus(instance.containerId);

      if (liveStatus !== instance.status) {
        const updated = this.upsertInstance(serverId, { status: liveStatus });
        return { definition, instance: updated };
      }
    }

    return { definition, instance };
  }

  // ─── List ──────────────────────────────────────────────────────────────────

  async list(): Promise<ServerResponse[]> {
    const definitions = this.repo.listDefinitions();
    return definitions.map((definition: ServerDefinition) => ({
      definition,
      instance: this.repo.getInstance(definition.id) ?? null,
    }));
  }

  // ─── Logs ──────────────────────────────────────────────────────────────────

  async getLogs(serverId: string, tail: number = 100): Promise<string> {
    const instance = this.getInstanceOrThrow(serverId);

    if (!instance.containerId) {
      throw new Error(`Server ${serverId} has no associated container`);
    }

    return this.docker.getLogs(instance.containerId, tail);
  }

  async getStats(serverId: string) {
    const instance = this.getInstanceOrThrow(serverId);

    if (!instance.containerId) {
      throw new Error(`Server ${serverId} has no associated container`);
    }

    if (instance.status !== "running") {
      throw new Error(`Server ${serverId} is not running`);
    }

    return this.docker.getStats(instance.containerId);
  }

  // ─── Deregister ────────────────────────────────────────────────────────────
  // Stops the container if running, then removes all records.

  async deregister(serverId: string): Promise<void> {
    const definition = this.getDefinitionOrThrow(serverId);
    const instance = this.repo.getInstance(serverId);

    if (instance?.containerId) {
      if (instance.status === "running") {
        await this.docker.stopContainer(instance.containerId);
      }
      await this.docker.removeContainer(instance.containerId);
    }

    this.repo.deleteServer(serverId);
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private getDefinitionOrThrow(serverId: string): ServerDefinition {
    const definition = this.repo.getDefinition(serverId);
    if (!definition) throw new Error(`Server not found: ${serverId}`);
    return definition;
  }

  private getInstanceOrThrow(serverId: string): ServerInstance {
    const instance = this.repo.getInstance(serverId);
    if (!instance) throw new Error(`No instance found for server: ${serverId}`);
    return instance;
  }

  private getAdapterOrThrow(game: string): GameAdapter {
    const adapter = this.adapterMap.get(game);
    if (!adapter) throw new Error(`No adapter registered for game type: ${game}`);
    return adapter;
  }

  // Merges partial updates into the existing instance record and persists it.
  private upsertInstance(
    serverId: string,
    updates: Partial<Omit<ServerInstance, "definitionId">>
  ): ServerInstance {
    const existing = this.repo.getInstance(serverId);

    const instance: ServerInstance = {
      definitionId: serverId,
      containerId: existing?.containerId ?? "",
      status: existing?.status ?? "registered",
      startedAt: existing?.startedAt,
      stoppedAt: existing?.stoppedAt,
      ...updates,
    };

    this.repo.saveInstance(instance);
    return instance;
  }
}