import { useState } from "react";
import { updateServer } from "../api/client";
import type { ServerResponse, MinecraftConfig, SteamConfig } from "../types";

interface Props {
  server: ServerResponse;
  onUpdated: (server: ServerResponse) => void;
  onClose: () => void;
}

const INPUT = "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-400 transition-colors";
const LABEL = "text-sm text-gray-400 mb-1.5 block font-medium";

export function EditServerModal({ server, onUpdated, onClose }: Props) {
  const { definition } = server;
  const isMinecraft = definition.game === "minecraft";
  const isSteam = definition.game === "steam";

  const mc = isMinecraft ? (definition.gameConfig as MinecraftConfig) : null;
  const steam = isSteam ? (definition.gameConfig as SteamConfig) : null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: definition.name,
    port: String(definition.port),
    // Minecraft
    memory: mc?.memory ?? "2G",
    motd: mc?.motd ?? "",
    maxPlayers: String(mc?.maxPlayers ?? 20),
    // Steam
    extraArgs: steam?.extraArgs ?? "",
  });

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        port: parseInt(form.port, 10),
      };

      if (isMinecraft && mc) {
        body.gameConfig = {
          ...mc,
          memory: form.memory,
          motd: form.motd || undefined,
          maxPlayers: parseInt(form.maxPlayers, 10),
        };
      }

      if (isSteam && steam) {
        body.gameConfig = {
          ...steam,
          extraArgs: form.extraArgs || undefined,
        };
      }

      const updated = await updateServer(definition.id, body);
      onUpdated(updated);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-white">Edit Server</h2>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">{definition.id.slice(0, 8)}...</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">

          {/* Warning if running */}
          {server.instance?.status === "running" && (
            <div className="bg-yellow-900/30 border border-yellow-700/50 text-yellow-300 text-sm px-4 py-3 rounded-lg">
              ⚠️ Changes will take effect on next restart.
            </div>
          )}

          {/* Common fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={LABEL}>Server Name</label>
              <input
                className={INPUT}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Host Port</label>
              <input
                className={INPUT}
                type="number"
                value={form.port}
                onChange={(e) => set("port", e.target.value)}
              />
            </div>
          </div>

          {/* Minecraft fields */}
          {isMinecraft && (
            <>
              <div className="border-t border-gray-700 pt-4">
                <p className="text-xs text-gray-500 mb-4 font-medium uppercase tracking-wider">Minecraft Settings</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>Memory</label>
                    <input
                      className={INPUT}
                      placeholder="2G"
                      value={form.memory}
                      onChange={(e) => set("memory", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Max Players</label>
                    <input
                      className={INPUT}
                      type="number"
                      value={form.maxPlayers}
                      onChange={(e) => set("maxPlayers", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className={LABEL}>MOTD</label>
                    <input
                      className={INPUT}
                      placeholder="A Minecraft Server"
                      value={form.motd}
                      onChange={(e) => set("motd", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Steam fields */}
          {isSteam && (
            <div className="border-t border-gray-700 pt-4">
              <p className="text-xs text-gray-500 mb-4 font-medium uppercase tracking-wider">Steam Settings</p>
              <div>
                <label className={LABEL}>Extra Launch Args</label>
                <input
                  className={INPUT}
                  placeholder="+map de_dust2"
                  value={form.extraArgs}
                  onChange={(e) => set("extraArgs", e.target.value)}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-300 text-sm bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !form.name}
            className="px-4 py-2 bg-white text-gray-900 rounded-lg text-sm font-semibold hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}