import { useEffect, useState } from "react";
import { getStats } from "../api/client";
import type { ContainerStats } from "../api/client";

export interface StatPoint {
  time: string;
  cpu: number;
  mem: number;
}

const MAX_POINTS = 30;

export function useServerStats(
  serverId: string,
  isRunning: boolean
): { history: StatPoint[]; latest: ContainerStats | null } {
  const [history, setHistory] = useState<StatPoint[]>([]);
  const [latest, setLatest] = useState<ContainerStats | null>(null);

  useEffect(() => {
    if (!isRunning) return;
    let cancelled = false;

    async function fetchStats() {
      try {
        const data = await getStats(serverId);
        if (cancelled) return;

        const memPct =
          data.memLimitBytes > 0
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
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [serverId, isRunning]);

  return { history, latest };
}
