import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation, Route, Routes } from "react-router-dom";
import { getServer, startServer, stopServer } from "../../api/client";
import type { ServerResponse } from "../../types";
import { StatusBadge } from "../../components/StatusBadge";
import { Spinner } from "../../components/Spinner";
import { OverviewTab } from "./tabs/OverviewTab";
import { ConsoleTab } from "./tabs/ConsoleTab";
import { FileManagerTab } from "./tabs/FileManagerTab";
import { SettingsTab } from "./tabs/SettingsTab";

const TABS = [
  { label: "Overview", path: "" },
  { label: "Console", path: "console" },
  { label: "File Manager", path: "files" },
  { label: "Settings", path: "settings" },
];

export function ServerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [server, setServer] = useState<ServerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function fetchServer() {
      try {
        const data = await getServer(id!);
        if (!cancelled) {
          setServer(data);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Failed to load server");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchServer();
    const interval = setInterval(fetchServer, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [id]);

  async function handleStart() {
    if (!id) return;
    setActionLoading(true);
    try {
      const updated = await startServer(id);
      setServer(updated);
    } catch {
      setError("Failed to start server");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStop() {
    if (!id) return;
    setActionLoading(true);
    try {
      const updated = await stopServer(id);
      setServer(updated);
    } catch {
      setError("Failed to stop server");
    } finally {
      setActionLoading(false);
    }
  }

  // Determine active tab from URL
  const basePath = `/servers/${id}`;
  const suffix = location.pathname.replace(basePath, "").replace(/^\//, "");
  const activeTab = suffix === "" ? "" : suffix;

  if (loading) return <Spinner />;
  if (!server) return (
    <div className="flex items-center justify-center min-h-screen text-gray-500">
      Server not found
    </div>
  );

  const { definition, instance } = server;
  const status = instance?.status ?? "registered";
  const isRunning = status === "running";
  const isBusy = status === "starting" || status === "stopping" || actionLoading;

  return (
    <div className="min-h-screen bg-[#1a1d23] flex flex-col">

      {/* Top bar */}
      <div className="bg-[#22262e] border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-4">

          {/* Breadcrumb + actions */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/")}
                className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
              >
                ← Servers
              </button>
              <span className="text-gray-700">/</span>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#2d3139] border border-gray-600 flex items-center justify-center text-base">
                  {definition.game === "minecraft" ? "⛏️" : "🎮"}
                </div>
                <div>
                  <h1 className="text-base font-semibold text-white">{definition.name}</h1>
                  <p className="text-xs text-gray-500">
                    {definition.game === "minecraft" ? "Minecraft" : "Steam"} · port {definition.port}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <StatusBadge status={status} />
              {!isRunning ? (
                <button
                  onClick={handleStart}
                  disabled={isBusy}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isBusy ? "Starting..." : "Start Server"}
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  disabled={isBusy}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isBusy ? "Stopping..." : "Stop Server"}
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.path;
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path === "" ? basePath : `${basePath}/${tab.path}`)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? "bg-[#2d3139] text-white"
                      : "text-gray-500 hover:text-gray-300 hover:bg-[#2d3139]/50"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="max-w-6xl mx-auto w-full px-6 pt-4">
          <div className="bg-red-900/40 border border-red-600 text-red-300 text-sm px-4 py-3 rounded-xl flex justify-between">
            {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        <Routes>
          <Route index element={<OverviewTab server={server} />} />
          <Route path="console" element={<ConsoleTab server={server} />} />
          <Route path="files" element={<FileManagerTab server={server} />} />
          <Route path="settings" element={
            <SettingsTab
              server={server}
              onUpdated={(updated) => setServer(updated)}
            />}
          />
        </Routes>
      </div>
    </div>
  );
}