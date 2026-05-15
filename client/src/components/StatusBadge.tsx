import type { ServerStatus } from "../types";

interface Props {
  status: ServerStatus;
}

const STYLES: Record<ServerStatus, string> = {
  registered: "bg-gray-700 text-gray-300 border-gray-600",
  starting:   "bg-yellow-900/50 text-yellow-300 border-yellow-700",
  running:    "bg-green-900/50 text-green-300 border-green-700",
  stopping:   "bg-orange-900/50 text-orange-300 border-orange-700",
  stopped:    "bg-gray-700/50 text-gray-400 border-gray-600",
  errored:    "bg-red-900/50 text-red-300 border-red-700",
};

const DOTS: Record<ServerStatus, string> = {
  registered: "bg-gray-400",
  starting:   "bg-yellow-300 animate-pulse",
  running:    "bg-green-400",
  stopping:   "bg-orange-300 animate-pulse",
  stopped:    "bg-gray-500",
  errored:    "bg-red-400",
};

export function StatusBadge({ status }: Props) {
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border ${STYLES[status]}`}>
      <span className={`w-2 h-2 rounded-full ${DOTS[status]}`} />
      {status}
    </span>
  );
}