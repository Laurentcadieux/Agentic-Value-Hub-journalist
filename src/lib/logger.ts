/**
 * Structured logger — emits one JSON line per log event to stdout.
 *
 * Each line includes: timestamp (ISO 8601), level, agent name, and message,
 * plus an optional structured `context` object.
 */
import type { LogLevel } from '../types.js';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Minimum level to emit, controlled by the LOG_LEVEL env var. */
function minLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel;
  return LEVEL_PRIORITY[env] !== undefined ? env : 'info';
}

function shouldEmit(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel()];
}

export interface LogContext {
  [key: string]: unknown;
}

/**
 * Logger bound to a particular agent/component name.
 *
 * @example
 * const log = new Logger('enterprise-ai');
 * log.info('ingest complete', { count: 12 });
 * // -> {"ts":"2026-09-20T14:00:00.000Z","level":"info","agent":"enterprise-ai","msg":"ingest complete","context":{"count":12}}
 */
export class Logger {
  constructor(private readonly agent: string) {}

  private write(level: LogLevel, message: string, context?: LogContext): void {
    if (!shouldEmit(level)) return;
    const entry = {
      ts: new Date().toISOString(),
      level,
      agent: this.agent,
      msg: message,
      ...(context && Object.keys(context).length > 0 ? { context } : {}),
    };
    const line = JSON.stringify(entry);
    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }

  debug(message: string, context?: LogContext): void {
    this.write('debug', message, context);
  }
  info(message: string, context?: LogContext): void {
    this.write('info', message, context);
  }
  warn(message: string, context?: LogContext): void {
    this.write('warn', message, context);
  }
  error(message: string, context?: LogContext): void {
    this.write('error', message, context);
  }
}
