import { useEffect, useState } from "react";
import { getStats } from "../api/client";
import type { ContainerStats } from "../api/client";

interface Props {
  serverId: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function StatBar({ label, value, max, display }: {
  label: string;
  value: number;
  max: number;
  display: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color = pct > 80 ? "bg-red-500" : pct > 60 ? "bg-yellow-500" : "bg-green-500";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-200 font-mono">{display}</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm text-gray-200 font-mono">{value}</span>
    </div>
  );
}

export function ServerStats({ serverId }: Props) {
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        const data = await getStats(serverId);
        if (!cancelled) {
          setStats(data);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Stats unavailable");
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [serverId]);

  if (error) {
    return (
      <p className="text-xs text-gray-600 py-2">{error}</p>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-pulse" />
        <span className="text-xs text-gray-600">Loading stats...</span>
      </div>
    );
  }

  const memPct = stats.memLimitBytes > 0
    ? (stats.memUsedBytes / stats.memLimitBytes) * 100
    : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* CPU + Memory bars */}
      <div className="flex flex-col gap-3">
        <StatBar
          label="CPU"
          value={stats.cpuPercent}
          max={100}
          display={`${stats.cpuPercent.toFixed(1)}%`}
        />
        <StatBar
          label="Memory"
          value={stats.memUsedBytes}
          max={stats.memLimitBytes}
          display={`${formatBytes(stats.memUsedBytes)} / ${formatBytes(stats.memLimitBytes)} (${memPct.toFixed(1)}%)`}
        />
      </div>

      {/* Network + Disk pills */}
      <div className="grid grid-cols-2 gap-2">
        <StatPill label="Network In" value={formatBytes(stats.netInBytes)} />
        <StatPill label="Network Out" value={formatBytes(stats.netOutBytes)} />
      </div>

      <p className="text-xs text-gray-600">Refreshing every 2s</p>
    </div>
  );
}