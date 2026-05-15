import path from "path";
import { SteamConfig, ContainerConfig, ServerDefinition, PortBinding } from "../core/types";
import { BaseAdapter } from "./BaseAdapter";

// ─── Per-game Steam profiles ───────────────────────────────────────────────────
// Add a new entry here to support additional Steam dedicated servers.

interface SteamGameProfile {
  name: string;
  appId: number;
  portBindings: Omit<PortBinding, "hostPort">[];  // container-side ports only
  launchArgs: string;                              // passed to the server binary
}

const STEAM_GAME_PROFILES: Record<number, SteamGameProfile> = {
  730: {
    name: "cs2",
    appId: 730,
    portBindings: [
      { containerPort: 27015, protocol: "udp" }, // game traffic
      { containerPort: 27015, protocol: "tcp" }, // RCON
      { containerPort: 27020, protocol: "udp" }, // SourceTV
    ],
    launchArgs: "-dedicated +map de_dust2",
  },
  896660: {
    name: "valheim",
    appId: 896660,
    portBindings: [
      { containerPort: 2456, protocol: "udp" },
      { containerPort: 2457, protocol: "udp" },
    ],
    launchArgs: "-nographics -batchmode",
  },
};

const FALLBACK_PROFILE: Omit<SteamGameProfile, "appId"> = {
  name: "steam-server",
  portBindings: [{ containerPort: 27015, protocol: "udp" }],
  launchArgs: "",
};

// ─── SteamAdapter ─────────────────────────────────────────────────────────────

export class SteamAdapter extends BaseAdapter {
  readonly gameType = "steam" as const;

  // cm2network/steamcmd is the most maintained minimal SteamCMD base image.
  // It handles anonymous + authenticated Steam logins and app installs.
  getDefaultImage(): string {
    return "cm2network/steamcmd:latest";
  }

  buildContainerConfig(definition: ServerDefinition): ContainerConfig {
    const gameConfig = definition.gameConfig as SteamConfig;
    const profile = STEAM_GAME_PROFILES[gameConfig.appId] ?? {
      ...FALLBACK_PROFILE,
      appId: gameConfig.appId,
      name: `steam-${gameConfig.appId}`,
    };

    const image = this.resolveImage(definition);
    const name = this.buildContainerName(definition);
    const env = this.buildEnv(gameConfig);
    const portBindings = this.buildPortBindings(profile, definition.port);
    const cmd = this.buildCmd(gameConfig, profile);

    return {
      image,
      name,
      env,
      portBindings,
      volumes: [
        {
          // Game files are large — persist them so reinstall isn't needed on restart.
          hostPath: path.resolve("data", "steam", definition.id),
          containerPath: "/home/steam/servers",
        },
      ],
      cmd,
    };
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private buildEnv(config: SteamConfig): Record<string, string> {
    const env: Record<string, string> = {
      STEAM_APP_ID: String(config.appId),
    };

    // Most servers support anonymous login — only set creds if provided
    if (config.steamUsername) {
      env["STEAM_USERNAME"] = config.steamUsername;
    }

    return env;
  }

  // The primary port from ServerDefinition maps to the first port in the profile.
  // Any additional ports are offset sequentially from there.
  private buildPortBindings(
    profile: Pick<SteamGameProfile, "portBindings">,
    baseHostPort: number
  ): PortBinding[] {
    return profile.portBindings.map((binding, index) => ({
      containerPort: binding.containerPort,
      hostPort: baseHostPort + index,
      protocol: binding.protocol,
    }));
  }

  // Builds the SteamCMD install + launch command sequence.
  // SteamCMD runs the install first, then hands off to the game server binary.
  private buildCmd(config: SteamConfig, profile: SteamGameProfile): string[] {
    const installDir = "/home/steam/servers";
    const username = config.steamUsername ?? "anonymous";
    const extraArgs = config.extraArgs ?? "";
    const launchArgs = [profile.launchArgs, extraArgs].filter(Boolean).join(" ");

    return [
      "bash",
      "-c",
      [
        // 1. Install/update the game via SteamCMD
        `/home/steam/steamcmd/steamcmd.sh`,
        `+login ${username}`,
        `+force_install_dir ${installDir}`,
        `+app_update ${config.appId} validate`,
        `+quit`,
        // 2. Launch the server binary
        `&& ${installDir}/srcds_run ${launchArgs}`,
      ].join(" "),
    ];
  }
}