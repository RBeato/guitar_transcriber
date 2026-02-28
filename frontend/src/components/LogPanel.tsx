import { useEffect, useRef } from "react";
import { LogEntry } from "../hooks/useLogs";

const LEVEL_STYLES: Record<LogEntry["level"], string> = {
  info: "text-gray-400",
  success: "text-green-400",
  warn: "text-yellow-400",
  error: "text-red-400",
};

const LEVEL_PREFIX: Record<LogEntry["level"], string> = {
  info: "   ",
  success: " OK",
  warn: "  !",
  error: "ERR",
};

interface LogPanelProps {
  logs: LogEntry[];
}

export default function LogPanel({ logs }: LogPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  if (logs.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        Pipeline Log
      </h3>
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 max-h-60 overflow-y-auto font-mono text-xs leading-relaxed">
        {logs.map((entry) => (
          <div key={entry.id} className="flex gap-2">
            <span className="text-gray-600 shrink-0">{entry.time}</span>
            <span className={`shrink-0 ${LEVEL_STYLES[entry.level]}`}>
              [{LEVEL_PREFIX[entry.level]}]
            </span>
            <span className={LEVEL_STYLES[entry.level]}>{entry.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
