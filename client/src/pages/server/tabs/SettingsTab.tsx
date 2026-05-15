import { useState } from "react";
import { updateServer } from "../../../api/client";
import type { ServerResponse, MinecraftConfig, SteamConfig } from "../../../types";

interface Props {
  server: ServerResponse;
  onUpdated: (server: ServerResponse) => void;
}

const INPUT = "w-full bg-[#1a1d23] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors";
const LABEL = "text-sm text-gray-400 mb-1.5 block font-medium";

export function SettingsTab({ server, onUpdated }: Props) {
  const { definition } = server;
  const isMinecraft = definition.game === "minecraft";
  const isSteam = definition.game === "steam";
  const mc = isMinecraft ? (definition.gameConfig as MinecraftConfig) : null;
  const steam = isSteam ? (definition.gameConfig as SteamConfig) : null;

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [initialMaxPlayers] = useState(() =>
    mc?.maxPlayers !== undefined ? String(mc.maxPlayers) : "20"
  );

  const [form, setForm] = useState({
    name: definition.name,
    port: String(definition.port),
    memory: mc?.memory ?? "2G",
    motd: mc?.motd ?? "",
    maxPlayers: mc?.maxPlayers !== undefined ? String(mc.maxPlayers) : "20",
    extraArgs: steam?.extraArgs ?? "",
  });

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSuccess(false);
  }

  async function handleSubmit() {
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        port: parseInt(form.port, 10),
      };

      if (isMinecraft && mc) {
        const gameConfig: Record<string, unknown> = {
          ...mc,
          memory: form.memory,
          motd: form.motd || undefined,
        };
        if (form.maxPlayers !== initialMaxPlayers) {
          gameConfig.maxPlayers = parseInt(form.maxPlayers, 10);
        }
        body.gameConfig = gameConfig;
      }

      if (isSteam && steam) {
        body.gameConfig = {
          ...steam,
          extraArgs: form.extraArgs || undefined,
        };
      }

      const updated = await updateServer(definition.id, body);
      onUpdated(updated);
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl flex flex-col gap-6">

      {server.instance?.status === "running" && (
        <div className="bg-yellow-900/30 border border-yellow-700/50 text-yellow-300 text-sm px-4 py-3 rounded-xl">
          ⚠️ Changes will take effect on next restart.
        </div>
      )}

      {/* General */}
      <div className="bg-[#22262e] border border-gray-700 rounded-xl p-5 flex flex-col gap-4">
        <p className="text-sm font-semibold text-gray-200">General</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={LABEL}>Server Name</label>
            <input className={INPUT} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Host Port</label>
            <input className={INPUT} type="number" value={form.port} onChange={(e) => set("port", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Minecraft */}
      {isMinecraft && (
        <div className="bg-[#22262e] border border-gray-700 rounded-xl p-5 flex flex-col gap-4">
          <p className="text-sm font-semibold text-gray-200">Minecraft Settings</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Memory</label>
              <input className={INPUT} placeholder="2G" value={form.memory} onChange={(e) => set("memory", e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Max Players</label>
              <input className={INPUT} type="number" value={form.maxPlayers} onChange={(e) => set("maxPlayers", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={LABEL}>MOTD</label>
              <input className={INPUT} placeholder="A Minecraft Server" value={form.motd} onChange={(e) => set("motd", e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Steam */}
      {isSteam && (
        <div className="bg-[#22262e] border border-gray-700 rounded-xl p-5 flex flex-col gap-4">
          <p className="text-sm font-semibold text-gray-200">Steam Settings</p>
          <div>
            <label className={LABEL}>Extra Launch Args</label>
            <input className={INPUT} placeholder="+map de_dust2" value={form.extraArgs} onChange={(e) => set("extraArgs", e.target.value)} />
          </div>
        </div>
      )}

      {error && (
        <p className="text-red-300 text-sm bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3">{error}</p>
      )}
      {success && (
        <p className="text-green-300 text-sm bg-green-900/30 border border-green-700/50 rounded-xl px-4 py-3">✓ Settings saved successfully</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || !form.name}
        className="px-5 py-2.5 bg-white text-gray-900 rounded-xl text-sm font-semibold hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-start"
      >
        {loading ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}