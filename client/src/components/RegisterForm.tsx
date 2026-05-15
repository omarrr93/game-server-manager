import { useState } from "react";
import { registerServer } from "../api/client";
import type { ServerResponse } from "../types";

interface Props {
  onRegistered: (server: ServerResponse) => void;
}

const INPUT = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors";
const LABEL = "text-xs text-gray-500 mb-1.5 block font-medium";

export function RegisterForm({ onRegistered }: Props) {
  const [open, setOpen] = useState(false);
  const [game, setGame] = useState<"minecraft" | "steam">("minecraft");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    port: "25565",
    memory: "2G",
    serverType: "paper",
    version: "LATEST",
    motd: "",
    maxPlayers: "20",
    appId: "730",
    extraArgs: "",
  });

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleClose() {
    setOpen(false);
    setError(null);
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const gameConfig =
        game === "minecraft"
          ? {
              game: "minecraft",
              memory: form.memory,
              serverType: form.serverType,
              version: form.version || "LATEST",
              motd: form.motd || undefined,
              maxPlayers: parseInt(form.maxPlayers, 10),
            }
          : {
              game: "steam",
              appId: parseInt(form.appId, 10),
              extraArgs: form.extraArgs || undefined,
            };

      const result = await registerServer({
        name: form.name,
        game,
        port: parseInt(form.port, 10),
        gameConfig,
      });

      onRegistered(result);
      handleClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-white text-xs font-semibold transition-colors"
      >
        + New Server
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-100">Register New Server</h2>
          <button onClick={handleClose} className="text-gray-600 hover:text-gray-300 transition-colors">✕</button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">

          {/* Game type tabs */}
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {(["minecraft", "steam"] as const).map((g) => (
              <button
                key={g}
                onClick={() => {
                  setGame(g);
                  set("port", g === "minecraft" ? "25565" : "27015");
                }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  game === g
                    ? "bg-gray-700 text-gray-100"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {g === "minecraft" ? "⛏️ Minecraft" : "🎮 Steam"}
              </button>
            ))}
          </div>

          {/* Common fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={LABEL}>Server Name</label>
              <input
                className={INPUT}
                placeholder="my-server"
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
          {game === "minecraft" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Server Type</label>
                <select
                  className={INPUT}
                  value={form.serverType}
                  onChange={(e) => set("serverType", e.target.value)}
                >
                  <option value="paper">Paper</option>
                  <option value="vanilla">Vanilla</option>
                  <option value="fabric">Fabric</option>
                  <option value="forge">Forge</option>
                </select>
              </div>
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
                <label className={LABEL}>Version</label>
                <input
                  className={INPUT}
                  placeholder="LATEST"
                  value={form.version}
                  onChange={(e) => set("version", e.target.value)}
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
                <label className={LABEL}>MOTD (optional)</label>
                <input
                  className={INPUT}
                  placeholder="A Minecraft Server"
                  value={form.motd}
                  onChange={(e) => set("motd", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Steam fields */}
          {game === "steam" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>App ID</label>
                <input
                  className={INPUT}
                  placeholder="730"
                  value={form.appId}
                  onChange={(e) => set("appId", e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className={LABEL}>Extra Launch Args (optional)</label>
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
            <p className="text-red-400 text-xs bg-red-950 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-3 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !form.name}
            className="px-4 py-2 bg-gray-100 text-gray-900 rounded-lg text-xs font-semibold hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Registering..." : "Register Server"}
          </button>
        </div>
      </div>
    </div>
  );
}