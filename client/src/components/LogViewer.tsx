import { useEffect, useRef, useState } from "react";
import { getLogs } from "../api/client";

interface Props {
  serverId: string;
  serverName: string;
  onClose: () => void;
}

export function LogViewer({ serverId, serverName, onClose }: Props) {
  const [logs, setLogs] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [tail, setTail] = useState(100);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchLogs() {
      try {
        const data = await getLogs(serverId, tail);
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
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [serverId, tail]);

  useEffect(() => {
    if (autoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-4xl flex flex-col max-h-[85vh] shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-200">{serverName}</span>
            <span className="text-gray-600 text-xs font-mono">logs</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Tail selector */}
            <select
              value={tail}
              onChange={(e) => setTail(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 text-gray-400 text-xs rounded-lg px-2 py-1"
            >
              <option value={50}>50 lines</option>
              <option value={100}>100 lines</option>
              <option value={500}>500 lines</option>
              <option value={1000}>1000 lines</option>
            </select>
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-gray-300 transition-colors text-lg leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Log output */}
        <div
          className="overflow-y-auto flex-1 p-4"
          onScroll={(e) => {
            const el = e.currentTarget;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
            autoScrollRef.current = atBottom;
          }}
        >
          {error ? (
            <p className="text-red-400 text-sm">{error}</p>
          ) : logs ? (
            <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap leading-relaxed">
              {logs}
            </pre>
          ) : (
            <p className="text-gray-600 text-sm">Waiting for logs...</p>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-gray-800 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-gray-700">Polling every 3s · press Esc to close</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-gray-600">live</span>
          </div>
        </div>
      </div>
    </div>
  );
}