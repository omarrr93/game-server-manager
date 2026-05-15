import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { listServers, startServer, stopServer, deregisterServer } from "../api/client";
import type { ServerResponse } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { RegisterForm } from "../components/RegisterForm";
import { Spinner } from "../components/Spinner";

export function ServerList() {
  const navigate = useNavigate();
  const [servers, setServers] = useState<ServerResponse[]>([]);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await listServers();
      setServers(data);
      setError(null);
    } catch {
      setError("Failed to load servers");
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  function setLoading(id: string, value: boolean) {
    setLoadingIds((prev) => {
      const next = new Set(prev);
      value ? next.add(id) : next.delete(id);
      return next;
    });
  }

  async function handleStart(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setLoading(id, true);
    try {
      const updated = await startServer(id);
      setServers((prev) => prev.map((s) => s.definition.id === id ? updated : s));
    } catch {
      setError("Failed to start server");
    } finally {
      setLoading(id, false);
    }
  }

  async function handleStop(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setLoading(id, true);
    try {
      const updated = await stopServer(id);
      setServers((prev) => prev.map((s) => s.definition.id === id ? updated : s));
    } catch {
      setError("Failed to stop server");
    } finally {
      setLoading(id, false);
    }
  }

  async function handleDeregister(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Remove this server? This cannot be undone.")) return;
    setLoading(id, true);
    try {
      await deregisterServer(id);
      setServers((prev) => prev.filter((s) => s.definition.id !== id));
    } catch {
      setError("Failed to remove server");
    } finally {
      setLoading(id, false);
    }
  }

  const runningCount = servers.filter((s) => s.instance?.status === "running").length;

  return (
    <div className="min-h-screen bg-[#1a1d23]">
      <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              Game Servers
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {servers.length} server{servers.length !== 1 ? "s" : ""} · {runningCount} running
            </p>
          </div>
          <RegisterForm onRegistered={(s) => setServers((prev) => [s, ...prev])} />
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-900/40 border border-red-600 text-red-300 text-sm px-4 py-3 rounded-xl flex justify-between items-center">
            {error}
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300 ml-4">✕</button>
          </div>
        )}

        {/* Stats bar */}
        {servers.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Servers", value: servers.length },
              { label: "Running", value: runningCount },
              { label: "Stopped", value: servers.filter((s) => !s.instance || s.instance.status === "stopped" || s.instance.status === "registered").length },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#22262e] border border-gray-700 rounded-xl px-5 py-4">
                <p className="text-sm text-gray-400">{label}</p>
                <p className="text-3xl font-semibold text-white mt-1">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Server list */}
        {initialLoading ? (
          <Spinner />
        ) : servers.length === 0 ? (
          <div className="text-center py-24 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#22262e] border border-gray-700 flex items-center justify-center text-3xl">
              🎮
            </div>
            <p className="text-base text-gray-400">No servers yet</p>
            <p className="text-sm text-gray-600">
              Click <strong className="text-gray-400">+ New Server</strong> to get started
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {servers.map((server) => {
              const { definition, instance } = server;
              const status = instance?.status ?? "registered";
              const isRunning = status === "running";
              const isBusy = status === "starting" || status === "stopping" || loadingIds.has(definition.id);

              return (
                <div
                  key={definition.id}
                  onClick={() => navigate(`/servers/${definition.id}`)}
                  className="bg-[#22262e] border border-gray-700 rounded-xl p-5 flex items-center gap-4 hover:border-gray-500 hover:bg-[#272b33] cursor-pointer transition-all"
                >
                  {/* Icon */}
                  <div className="w-11 h-11 rounded-xl bg-[#2d3139] border border-gray-600 flex items-center justify-center text-xl flex-shrink-0">
                    {definition.game === "minecraft" ? "⛏️" : "🎮"}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-white truncate">{definition.name}</p>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {definition.game === "minecraft" ? "Minecraft" : "Steam"} · port {definition.port}
                    </p>
                  </div>

                  {/* Status */}
                  <StatusBadge status={status} />

                  {/* Quick actions */}
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {!isRunning ? (
                      <button
                        onClick={(e) => handleStart(e, definition.id)}
                        disabled={isBusy}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {isBusy ? "..." : "Start"}
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleStop(e, definition.id)}
                        disabled={isBusy}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {isBusy ? "..." : "Stop"}
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDeregister(e, definition.id)}
                      disabled={isBusy}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg text-gray-500 border border-gray-700 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 disabled:opacity-40 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}