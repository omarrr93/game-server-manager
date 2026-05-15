import { useState } from "react";
import type { ServerResponse } from "../types";
import { StatusBadge } from "./StatusBadge";
import { EditServerModal } from "./EditServerModal";
import { ServerStats } from "./ServerStats";

interface Props {
  server: ServerResponse;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDeregister: (id: string) => void;
  onViewLogs: (id: string) => void;
  onUpdated: (server: ServerResponse) => void;
  loading: boolean;
}

export function ServerCard({ server, onStart, onStop, onDeregister, onViewLogs, onUpdated, loading }: Props) {
  const { definition, instance } = server;
  const status = instance?.status ?? "registered";
  const isRunning = status === "running";
  const isBusy = status === "starting" || status === "stopping" || loading;
  const [editOpen, setEditOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  return (
    <>
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 flex flex-col gap-5 hover:border-gray-600 transition-colors">

        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gray-700 border border-gray-600 flex items-center justify-center text-xl flex-shrink-0">
              {definition.game === "minecraft" ? "⛏️" : "🎮"}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white truncate">{definition.name}</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {definition.game === "minecraft" ? "Minecraft" : "Steam"} · port {definition.port}
              </p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-5 text-sm text-gray-500 font-mono">
          <span>{definition.id.slice(0, 8)}...</span>
          {instance?.startedAt && (
            <span>↑ {new Date(instance.startedAt).toLocaleTimeString()}</span>
          )}
          {instance?.stoppedAt && (
            <span>↓ {new Date(instance.stoppedAt).toLocaleTimeString()}</span>
          )}
        </div>

        {/* Stats expandable section */}
        {isRunning && statsOpen && (
          <>
            <div className="border-t border-gray-700" />
            <ServerStats serverId={definition.id} />
          </>
        )}

        <div className="border-t border-gray-700" />

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {!isRunning ? (
            <button
              onClick={() => onStart(definition.id)}
              disabled={isBusy}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isBusy ? "Starting..." : "Start"}
            </button>
          ) : (
            <button
              onClick={() => onStop(definition.id)}
              disabled={isBusy}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isBusy ? "Stopping..." : "Stop"}
            </button>
          )}

          <button
            onClick={() => onViewLogs(definition.id)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600 hover:text-white transition-colors"
          >
            Logs
          </button>

          <button
            onClick={() => setEditOpen(true)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600 hover:text-white transition-colors"
          >
            Edit
          </button>

          {/* Stats toggle — only shown when running */}
          {isRunning && (
            <button
              onClick={() => setStatsOpen((o) => !o)}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                statsOpen
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20"
                  : "bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600 hover:text-white"
              }`}
            >
              {statsOpen ? "Hide Stats" : "Stats"}
            </button>
          )}

          <div className="ml-auto">
            <button
              onClick={() => onDeregister(definition.id)}
              disabled={isBusy}
              className="px-4 py-2 text-sm font-medium rounded-lg text-gray-500 border border-gray-700 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      {editOpen && (
        <EditServerModal
          server={server}
          onUpdated={(updated) => {
            onUpdated(updated);
            setEditOpen(false);
          }}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  );
}