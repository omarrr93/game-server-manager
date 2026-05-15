import { PassThrough } from "stream";
import Dockerode from "dockerode";
import { ContainerConfig, ServerStatus } from "../core/types";

// ─── Internal Types ───────────────────────────────────────────────────────────

export interface RunningContainerInfo {
  containerId: string;
  status: ServerStatus;
}

// ─── DockerClient ─────────────────────────────────────────────────────────────

export class DockerClient {
  private docker: Dockerode;

  constructor() {
    // Connects via /var/run/docker.sock by default - works on Linux/macOS.
    // On Windows use: new Dockerode({ socketPath: '//./pipe/docker_engine' })
    this.docker = new Dockerode();
  }

  // ─── Start ──────────────────────────────────────────────────────────────────

async startContainer(config: ContainerConfig): Promise<string> {
  await this.pullImageIfMissing(config.image);

  // Clean up any stale container with the same name before creating a new one.
  // This handles errored/crashed containers from previous runs.
  try {
    const existing = await this.docker.listContainers({
      all: true,
      filters: JSON.stringify({ name: [`^/${config.name}$`] }),
    });
    if (existing.length > 0) {
      await this.docker.getContainer(existing[0].Id).remove({ force: true });
      console.log(`[DockerClient] Removed stale container: ${config.name}`);
    }
  } catch {
    // Non-fatal — if cleanup fails, createContainer below will surface the real error
  }

  const portBindings: Record<string, Array<{ HostPort: string }>> = {};
  const exposedPorts: Record<string, object> = {};

  for (const binding of config.portBindings) {
    const proto = binding.protocol ?? "tcp";
    const key = `${binding.containerPort}/${proto}`;
    exposedPorts[key] = {};
    portBindings[key] = [{ HostPort: String(binding.hostPort) }];
  }

  const binds: string[] = (config.volumes ?? []).map(
    (v) => `${v.hostPath}:${v.containerPath}`
  );

  const container = await this.docker.createContainer({
    Image: config.image,
    name: config.name,
    Env: this.formatEnv(config.env),
    ExposedPorts: exposedPorts,
    Cmd: config.cmd,
    HostConfig: {
      PortBindings: portBindings,
      Binds: binds,
      RestartPolicy: { Name: "unless-stopped" },
    },
  });

  await container.start();
  return container.id;
}

  // ─── Stop ───────────────────────────────────────────────────────────────────

  async stopContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    try {
      await container.stop({ t: 10 }); // 10s graceful shutdown before SIGKILL
    } catch (err: any) {
      // 304 = container already stopped - not an error we care about
      if (err?.statusCode !== 304) throw err;
    }
  }

  // ─── Remove ─────────────────────────────────────────────────────────────────

  async removeContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.remove({ force: true });
  }

  // ─── Logs ───────────────────────────────────────────────────────────────────

  async getLogs(containerId: string, tail: number = 100): Promise<string> {
    const container = this.docker.getContainer(containerId);
    const logBuffer = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    });

    // dockerode returns a Buffer with Docker's multiplexed stream format.
    // demuxStream parses it into clean stdout/stderr strings.
    return this.demuxStream(logBuffer as unknown as Buffer);
  }

  // Streams live log output for a running container. Returns a cleanup function
  // that should be called when the consumer disconnects. onEnd fires when Docker
  // closes the log stream (e.g. the container stops).
  async streamLogs(
    containerId: string,
    tail: number,
    onData: (chunk: string) => void,
    onEnd: () => void
  ): Promise<() => void> {
    const container = this.docker.getContainer(containerId);

    // follow: true returns a multiplexed Node.js stream via callback, not a Buffer.
    const logStream = await new Promise<NodeJS.ReadableStream>((resolve, reject) => {
      container.logs(
        { follow: true, stdout: true, stderr: true, tail, timestamps: true },
        (err: Error | null, stream: any) => {
          if (err) reject(err);
          else resolve(stream);
        }
      );
    });

    // Route both stdout and stderr to the same PassThrough — game consoles mix them.
    const combined = new PassThrough();
    this.docker.modem.demuxStream(logStream, combined, combined);

    // Propagate stream close to the PassThrough so consumers get the 'end' event.
    logStream.on("end", () => combined.end());
    logStream.on("error", (err: Error) => combined.destroy(err));

    combined.on("data", (chunk: Buffer) => onData(chunk.toString("utf8")));
    combined.on("end", onEnd);

    return () => {
      (logStream as any).destroy?.();
      combined.destroy();
    };
  }

  async getStats(containerId: string): Promise<ContainerStats> {
    const container = this.docker.getContainer(containerId);

    // stream: false gives us a single snapshot instead of a continuous stream
    const raw = await container.stats({ stream: false }) as DockerRawStats;

    const cpuDelta = raw.cpu_stats.cpu_usage.total_usage - raw.precpu_stats.cpu_usage.total_usage;
    const systemDelta = raw.cpu_stats.system_cpu_usage - raw.precpu_stats.system_cpu_usage;
    const cpuCount = raw.cpu_stats.online_cpus ?? raw.cpu_stats.cpu_usage.percpu_usage?.length ?? 1;
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * cpuCount * 100 : 0;

    const memUsed = raw.memory_stats.usage - (raw.memory_stats.stats?.cache ?? 0);
    const memLimit = raw.memory_stats.limit;

    const networks = raw.networks ?? {};
    const netIn = Object.values(networks).reduce((acc, n) => acc + n.rx_bytes, 0);
    const netOut = Object.values(networks).reduce((acc, n) => acc + n.tx_bytes, 0);

    return {
      cpuPercent: parseFloat(cpuPercent.toFixed(2)),
      memUsedBytes: memUsed,
      memLimitBytes: memLimit,
      netInBytes: netIn,
      netOutBytes: netOut,
    };
  }

  // ─── Exec ───────────────────────────────────────────────────────────────────

  // Runs a command inside a running container via docker exec and returns its
  // combined stdout+stderr output. Intended for sending console commands to
  // game servers (e.g. `rcon-cli say Hello` for Minecraft).
  async execCommand(
    containerId: string,
    command: string,
    mode: "rcon" | "shell" = "shell"
  ): Promise<string> {
    const container = this.docker.getContainer(containerId);

    const cmd =
      mode === "rcon"
        ? ["rcon-cli", ...command.split(" ")]
        : ["sh", "-c", command];

    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({ hijack: true, stdin: false });

    return new Promise<string>((resolve, reject) => {
      const combined = new PassThrough();
      this.docker.modem.demuxStream(stream, combined, combined);

      const chunks: Buffer[] = [];
      combined.on("data", (chunk: Buffer) => chunks.push(chunk));
      combined.on("end", () => resolve(Buffer.concat(chunks).toString("utf8").trim()));
      combined.on("error", reject);

      // End the PassThrough when the exec stream finishes.
      (stream as any).on("end", () => combined.end());
    });
  }

  // ─── Status ─────────────────────────────────────────────────────────────────

  async getContainerStatus(containerId: string): Promise<ServerStatus> {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();
      return this.mapDockerStatus(info.State.Status);
    } catch (err: any) {
      // 404 = container doesn't exist on Docker
      if (err?.statusCode === 404) return "stopped";
      throw err;
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async pullImageIfMissing(image: string): Promise<void> {
    try {
      await this.docker.getImage(image).inspect();
    } catch (err: any) {
      if (err?.statusCode !== 404) throw err;

      console.log(`[DockerClient] Pulling image: ${image}`);
      await new Promise<void>((resolve, reject) => {
        this.docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
          if (err) return reject(err);
          this.docker.modem.followProgress(stream, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
      console.log(`[DockerClient] Pull complete: ${image}`);
    }
  }

  private formatEnv(env: Record<string, string>): string[] {
    return Object.entries(env).map(([k, v]) => `${k}=${v}`);
  }

  private mapDockerStatus(dockerStatus: string): ServerStatus {
    switch (dockerStatus) {
      case "running":    return "running";
      case "created":    return "starting";
      case "paused":     return "stopped";
      case "restarting": return "starting";
      case "removing":   return "stopping";
      case "exited":     return "stopped";
      case "dead":       return "errored";
      default:           return "errored";
    }
  }

  // Docker multiplexes stdout/stderr into a single binary stream.
  // Each frame has an 8-byte header: [stream_type, 0, 0, 0, size(4 bytes)]
  // We strip the headers and decode the rest as UTF-8 text.
  private demuxStream(buffer: Buffer): string {
    const chunks: string[] = [];
    let offset = 0;

    while (offset < buffer.length) {
      if (offset + 8 > buffer.length) break; // incomplete header

      const frameSize = buffer.readUInt32BE(offset + 4);
      const frameEnd = offset + 8 + frameSize;

      if (frameEnd > buffer.length) break; // incomplete frame

      chunks.push(buffer.subarray(offset + 8, frameEnd).toString("utf8"));
      offset = frameEnd;
    }

    return chunks.join("");
  }
}

// ─── Stats Types ──────────────────────────────────────────────────────────────

export interface ContainerStats {
  cpuPercent: number;
  memUsedBytes: number;
  memLimitBytes: number;
  netInBytes: number;
  netOutBytes: number;
}

interface DockerRawStats {
  cpu_stats: {
    cpu_usage: {
      total_usage: number;
      percpu_usage?: number[];
    };
    system_cpu_usage: number;
    online_cpus?: number;
  };
  precpu_stats: {
    cpu_usage: {
      total_usage: number;
    };
    system_cpu_usage: number;
  };
  memory_stats: {
    usage: number;
    limit: number;
    stats?: { cache: number };
  };
  networks?: Record<string, { rx_bytes: number; tx_bytes: number }>;
}