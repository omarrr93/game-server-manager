import { useEffect, useRef, useState } from "react";
import { getLogs } from "../../../api/client";
import type { ServerResponse } from "../../../types";

interface Props {
  server: ServerResponse;
}

export function ConsoleTab({ server }: Props) {
  const { definition, instance } = server;
  const isRunning = instance?.status === "running";
  const [logs, setLogs] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [tail, setTail] = useState(200);
  const [command, setCommand] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    if (!instance?.containerId) return;
    let cancelled = false;

    async function fetchLogs() {
      try {
        const data = await getLogs(definition.id, tail);
        if (!cancelled) {
          setLogs(data);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Failed to fetch logs");
      }
    }

    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [definition.id, instance?.containerId, tail]);

  useEffect(() => {
    if (autoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  function handleCommandSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!command.trim()) return;
    // TODO: implement send command to container
    console.log("Send command:", command);
    setCommand("");
  }

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* Controls */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {isRunning ? "Live output · polling every 3s" : "Server is not running"}
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
        ) : logs ? (
          <pre className="whitespace-pre-wrap">{logs}</pre>
        ) : (
          <span className="text-gray-600">
            {isRunning ? "Waiting for output..." : "No logs available — server is stopped"}
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
          disabled={!isRunning || !command.trim()}
          className="px-4 py-3 text-sm font-medium rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}