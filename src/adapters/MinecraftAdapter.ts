import path from "path";
import { MinecraftConfig, ContainerConfig, ServerDefinition } from "../core/types";
import { BaseAdapter } from "./BaseAdapter";

export class MinecraftAdapter extends BaseAdapter {
  readonly gameType = "minecraft" as const;

  // itzg/minecraft-server handles vanilla, paper, fabric, forge —
  // all driven by environment variables, no image switching needed.
  getDefaultImage(): string {
    return "itzg/minecraft-server:latest";
  }

  buildContainerConfig(definition: ServerDefinition): ContainerConfig {
    const gameConfig = definition.gameConfig as MinecraftConfig;

    const env = this.buildEnv(gameConfig);
    const image = this.resolveImage(definition);
    const name = this.buildContainerName(definition);

    return {
      image,
      name,
      env,
      portBindings: [
        {
          containerPort: 25565,
          hostPort: definition.port,
          protocol: "tcp",
        },
      ],
      volumes: [
        {
          // Persist world data + config to a named host directory.
          // Path is scoped per-server so instances don't collide.
          hostPath: path.resolve("data", "minecraft", definition.id),
          containerPath: "/data",
        },
      ],
    };
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private buildEnv(config: MinecraftConfig): Record<string, string> {
    const env: Record<string, string> = {
      EULA: "TRUE",
      TYPE: config.serverType.toUpperCase(), // itzg expects "PAPER", "FABRIC" etc.
      MEMORY: config.memory,
      VERSION: config.version ?? "LATEST",
    };

    if (config.motd) {
      env["MOTD"] = config.motd;
    }

    if (config.maxPlayers !== undefined) {
      env["MAX_PLAYERS"] = String(config.maxPlayers);
    }

    return env;
  }
}