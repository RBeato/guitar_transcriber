import { useState, useCallback, useRef } from "react";

export interface LogEntry {
  id: number;
  time: string;
  level: "info" | "success" | "warn" | "error";
  message: string;
}

export function useLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const idRef = useRef(0);

  const log = useCallback((level: LogEntry["level"], message: string) => {
    const entry: LogEntry = {
      id: idRef.current++,
      time: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      level,
      message,
    };
    setLogs((prev) => [...prev, entry]);
  }, []);

  const info = useCallback((msg: string) => log("info", msg), [log]);
  const success = useCallback((msg: string) => log("success", msg), [log]);
  const warn = useCallback((msg: string) => log("warn", msg), [log]);
  const error = useCallback((msg: string) => log("error", msg), [log]);

  const clear = useCallback(() => {
    setLogs([]);
    idRef.current = 0;
  }, []);

  return { logs, info, success, warn, error, clear };
}
