import { ContainerConfig, GameAdapter, GameType, ServerDefinition } from "../core/types";

export abstract class BaseAdapter implements GameAdapter {
  abstract readonly gameType: GameType;

  abstract getDefaultImage(): string;
  abstract buildContainerConfig(definition: ServerDefinition): ContainerConfig;

  // ─── Shared Helpers ─────────────────────────────────────────────────────────

  // Subclasses call this to get the final image — respects user overrides
  protected resolveImage(definition: ServerDefinition): string {
    return definition.imageOverride ?? this.getDefaultImage();
  }

  // Produces a safe, unique Docker container name from the server's id + name
  protected buildContainerName(definition: ServerDefinition): string {
    const safeName = definition.name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-") // Docker container names are strict
      .slice(0, 40);                 // keep it reasonable
    return `gscp-${safeName}-${definition.id.slice(0, 8)}`;
  }

  // Merges any extra env vars on top of the adapter's defaults.
  // Explicit values in extraEnv always win.
  protected mergeEnv(
    base: Record<string, string>,
    extraEnv?: Record<string, string>
  ): Record<string, string> {
    return { ...base, ...(extraEnv ?? {}) };
  }
}