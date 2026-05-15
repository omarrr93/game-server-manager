import { useEffect, useState } from "react";
import { getStats } from "../../../api/client";
import type { ContainerStats } from "../../../api/client";
import type { ServerResponse } from "../../../types";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts";

interface Props {
  server: ServerResponse;
}

interface StatPoint {
  time: string;
  cpu: number;
  mem: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatUptime(startedAt?: string): string {
  if (!startedAt) return "—";
  const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const MAX_POINTS = 30;

export function OverviewTab({ server }: Props) {
  const { definition, instance } = server;
  const isRunning = instance?.status === "running";
  const [history, setHistory] = useState<StatPoint[]>([]);
  const [latest, setLatest] = useState<ContainerStats | null>(null);
  const [uptime, setUptime] = useState(formatUptime(instance?.startedAt));

  // Update uptime every second
  useEffect(() => {
    const interval = setInterval(() => {
      setUptime(formatUptime(instance?.startedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [instance?.startedAt]);

  // Poll stats
  useEffect(() => {
    if (!isRunning) return;
    let cancelled = false;

    async function fetchStats() {
      try {
        const data = await getStats(definition.id);
        if (cancelled) return;

        const memPct = data.memLimitBytes > 0
          ? parseFloat(((data.memUsedBytes / data.memLimitBytes) * 100).toFixed(1))
          : 0;

        const point: StatPoint = {
          time: new Date().toLocaleTimeString(),
          cpu: parseFloat(data.cpuPercent.toFixed(1)),
          mem: memPct,
        };

        setLatest(data);
        setHistory((prev) => [...prev.slice(-(MAX_POINTS - 1)), point]);
      } catch {
        // Server might not be ready yet
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [definition.id, isRunning]);

  const status = instance?.status ?? "registered";

  return (
    <div className="flex flex-col gap-6">

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Status", value: status.charAt(0).toUpperCase() + status.slice(1) },
          { label: "Uptime", value: isRunning ? uptime : "—" },
          { label: "Port", value: String(definition.port) },
          { label: "Game", value: definition.game === "minecraft" ? "Minecraft" : "Steam" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#22262e] border border-gray-700 rounded-xl px-5 py-4">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-lg font-semibold text-white mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Live stats */}
      {latest && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "CPU Usage", value: `${latest.cpuPercent.toFixed(1)}%` },
            { label: "Memory Used", value: formatBytes(latest.memUsedBytes) },
            { label: "Network In", value: formatBytes(latest.netInBytes) },
            { label: "Network Out", value: formatBytes(latest.netOutBytes) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#22262e] border border-gray-700 rounded-xl px-5 py-4">
              <p className="text-sm text-gray-500">{label}</p>
              <p className="text-lg font-semibold text-blue-300 mt-1 font-mono">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Graphs */}
      {isRunning ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* CPU graph */}
          <div className="bg-[#22262e] border border-gray-700 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-300">CPU Usage</p>
              <span className="text-xs text-gray-500 font-mono">
                {latest ? `${latest.cpuPercent.toFixed(1)}%` : "—"}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3139" />
                <XAxis dataKey="time" tick={{ fill: "#6b7280", fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 10 }} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#22262e", border: "1px solid #374151", borderRadius: "8px" }}
                  labelStyle={{ color: "#9ca3af", fontSize: 11 }}
                  itemStyle={{ color: "#60a5fa" }}
                  formatter={(v) => [`${Number(v).toFixed(1)}%`, "CPU"]}
                />
                <Area
                  type="monotone"
                  dataKey="cpu"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  fill="url(#cpuGrad)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Memory graph */}
          <div className="bg-[#22262e] border border-gray-700 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-300">Memory Usage</p>
              <span className="text-xs text-gray-500 font-mono">
                {latest ? `${formatBytes(latest.memUsedBytes)} / ${formatBytes(latest.memLimitBytes)}` : "—"}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3139" />
                <XAxis dataKey="time" tick={{ fill: "#6b7280", fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 10 }} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#22262e", border: "1px solid #374151", borderRadius: "8px" }}
                  labelStyle={{ color: "#9ca3af", fontSize: 11 }}
                  itemStyle={{ color: "#a78bfa" }}
                  formatter={(v) => [`${Number(v).toFixed(1)}%`, "Memory"]}
                />
                <Area
                  type="monotone"
                  dataKey="mem"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  fill="url(#memGrad)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="bg-[#22262e] border border-gray-700 rounded-xl p-10 text-center text-gray-600 text-sm">
          Start the server to view resource graphs
        </div>
      )}
    </div>
  );
}