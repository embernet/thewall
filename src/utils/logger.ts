// ---------------------------------------------------------------------------
// Structured Logger
//
// Provides leveled, JSON-formatted logging for the renderer process.
// Each log entry includes a timestamp, level, context, and message.
// ---------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let minLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

interface LogEntry {
  ts: string;
  level: LogLevel;
  ctx: string;
  msg: string;
  data?: unknown;
}

const MAX_LOG_BUFFER = 500;
const logBuffer: LogEntry[] = [];

function log(level: LogLevel, ctx: string, msg: string, data?: unknown): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;

  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    ctx,
    msg,
    data,
  };

  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_BUFFER) logBuffer.shift();

  const consoleFn = level === 'error' ? console.error
    : level === 'warn' ? console.warn
    : level === 'debug' ? console.debug
    : console.log;

  consoleFn(`[${entry.ts}] [${level.toUpperCase()}] [${ctx}] ${msg}`, data ?? '');
}

/** Create a scoped logger with a fixed context label. */
export function createLogger(ctx: string) {
  return {
    debug: (msg: string, data?: unknown) => log('debug', ctx, msg, data),
    info: (msg: string, data?: unknown) => log('info', ctx, msg, data),
    warn: (msg: string, data?: unknown) => log('warn', ctx, msg, data),
    error: (msg: string, data?: unknown) => log('error', ctx, msg, data),
  };
}

/** Get recent log entries (for debug/export). */
export function getRecentLogs(): LogEntry[] {
  return [...logBuffer];
}
