import { useEffect, useRef, useState } from "react";
import { sendCommand } from "../../../api/client";
import type { ServerResponse } from "../../../types";

const MAX_LINES = 5000;

type WsStatus = "idle" | "connecting" | "live" | "disconnected";

interface Props {
  server: ServerResponse;
}

export function ConsoleTab({ server }: Props) {
  const { definition, instance } = server;
  const isRunning = instance?.status === "running";

  const [lines, setLines] = useState<string[]>([]);
  const [wsStatus, setWsStatus] = useState<WsStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [tail, setTail] = useState(200);
  const [command, setCommand] = useState("");
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  // Holds any incomplete log line that arrived mid-chunk and needs the next chunk
  // to complete it before being flushed to state.
  const pendingRef = useRef("");

  useEffect(() => {
    if (!isRunning || !instance?.containerId) {
      setWsStatus("idle");
      return;
    }

    setLines([]);
    pendingRef.current = "";
    setError(null);
    setWsStatus("connecting");

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/api/servers/${definition.id}/logs/stream?tail=${tail}`;
    const ws = new WebSocket(url);

    // Guard flag — set to false in cleanup so events from a superseded WebSocket
    // (e.g. the one React StrictMode cancels on first mount) can never overwrite
    // state that belongs to the newer connection.
    let active = true;

    ws.onopen = () => {
      if (!active) return;
      setWsStatus("live");
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      if (!active) return;
      // Prepend any partial line buffered from the previous chunk.
      const raw = pendingRef.current + (event.data as string);
      const parts = raw.split("\n");

      // The last element may be an incomplete line — hold it for the next chunk.
      pendingRef.current = parts.pop() ?? "";

      if (parts.length === 0) return;

      setLines((prev) => {
        const next = [...prev, ...parts.map((l) => l + "\n")];
        // Cap to MAX_LINES to prevent unbounded memory growth on long-running servers.
        return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
      });
    };

    ws.onclose = () => {
      if (!active) return;
      // Flush any remaining partial line when the stream ends.
      if (pendingRef.current) {
        setLines((prev) => [...prev, pendingRef.current]);
        pendingRef.current = "";
      }
      setWsStatus("disconnected");
    };

    ws.onerror = () => {
      if (!active) return;
      setError("WebSocket connection failed");
      setWsStatus("disconnected");
    };

    return () => {
      active = false;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [definition.id, instance?.containerId, isRunning, tail]);

  useEffect(() => {
    if (autoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines]);

  async function handleCommandSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = command.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setCommand("");

    try {
      await sendCommand(definition.id, trimmed);
    } catch {
      setError(`Failed to send command: ${trimmed}`);
    } finally {
      setSending(false);
    }
  }

  const statusLabel: Record<WsStatus, string> = {
    idle: "Server is not running",
    connecting: "Connecting...",
    live: "Live output",
    disconnected: "Disconnected — refresh the tab to reconnect",
  };

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* Controls */}
      <div className="flex items-center justify-between">
        <p className={`text-sm ${wsStatus === "disconnected" ? "text-yellow-500" : wsStatus === "live" ? "text-green-500" : "text-gray-400"}`}>
          {statusLabel[wsStatus]}
        </p>
        <select
          value={tail}
          onChange={(e) => setTail(Number(e.target.value))}
          className="bg-[#22262e] border border-gray-700 text-gray-400 text-sm rounded-lg px-3 py-1.5"
        >
          <option value={100}>100 lines</option>
          <option value={200}>200 lines</option>
          <option value={500}>500 lines</option>
          <option value={1000}>1000 lines</option>
        </select>
      </div>

      {/* Log output */}
      <div
        className="bg-[#0d0f12] border border-gray-700 rounded-xl flex-1 overflow-y-auto p-4 font-mono text-xs text-green-400 leading-relaxed min-h-[500px] max-h-[600px]"
        onScroll={(e) => {
          const el = e.currentTarget;
          autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
        }}
      >
        {error ? (
          <span className="text-red-400">{error}</span>
        ) : lines.length > 0 ? (
          <pre className="whitespace-pre-wrap">{lines.join("")}</pre>
        ) : (
          <span className="text-gray-600">
            {wsStatus === "connecting"
              ? "Connecting..."
              : isRunning
              ? "Waiting for output..."
              : "No logs available — server is stopped"}
          </span>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Command input */}
      <form onSubmit={handleCommandSubmit} className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-[#22262e] border border-gray-700 rounded-xl px-4 py-3">
          <span className="text-gray-600 font-mono text-sm">{">"}</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder={isRunning ? "Enter command..." : "Server must be running to send commands"}
            disabled={!isRunning}
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none font-mono disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={!isRunning || !command.trim() || sending}
          className="px-4 py-3 text-sm font-medium rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}
