/**
 * Cron-style scheduler using setInterval (no external cron lib needed).
 *
 * Parses each agent's `schedule` field (a simplified cron expression:
 * `minute hour dom month dow`) into an interval in milliseconds and runs
 * the agent on that cadence. Logs start/stop and each tick.
 *
 * For simplicity the scheduler approximates the schedule as a fixed
 * interval derived from the hour-field of the cron expression (e.g.
 * `0 0/6 ...` -> every 6 hours). This avoids pulling in a full cron
 * parser while keeping the common "every N hours" schedules correct.
 */
import 'dotenv/config';
import { AGENT_INSTANCES } from './agents/index.js';
import { Logger } from './lib/logger.js';
import type { AgentConfig } from './types.js';

const log = new Logger('scheduler');

interface ScheduledAgent {
  config: AgentConfig;
  intervalMs: number;
  timer: ReturnType<typeof setInterval> | null;
}

/** Derive a fixed interval (ms) from a cron string's hour field. */
function intervalFromSchedule(schedule: string): number {
  // Supported forms: "0 */6 * * *" -> every 6h ; "0 9 * * *" -> daily@9h (24h)
  const parts = schedule.trim().split(/\s+/);
  const hourField = parts[1] ?? '*';
  if (hourField.startsWith('*/')) {
    const hours = Number(hourField.slice(2));
    if (Number.isFinite(hours) && hours > 0) return hours * 60 * 60 * 1000;
  }
  // Default: run once per day (24h).
  return 24 * 60 * 60 * 1000;
}

const scheduled: ScheduledAgent[] = [];

function startAgent(entry: (typeof AGENT_INSTANCES)[number]): void {
  const intervalMs = intervalFromSchedule(entry.config.schedule);
  log.info('scheduling agent', {
    agent: entry.config.id,
    schedule: entry.config.schedule,
    intervalMs,
  });

  // Run once immediately, then on the interval.
  runOnce(entry);

  const timer = setInterval(() => runOnce(entry), intervalMs);
  scheduled.push({ config: entry.config, intervalMs, timer });
}

async function runOnce(entry: (typeof AGENT_INSTANCES)[number]): Promise<void> {
  const startedAt = new Date().toISOString();
  log.info('tick', { agent: entry.config.id, startedAt });
  try {
    await entry.instance.run();
  } catch (err) {
    log.error('tick failed', {
      agent: entry.config.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Stop all scheduled timers (graceful shutdown). */
export function stopAll(): void {
  for (const s of scheduled) {
    if (s.timer) clearInterval(s.timer);
    log.info('stopped agent', { agent: s.config.id });
  }
  scheduled.length = 0;
  log.info('scheduler stopped');
}

/** Start the scheduler for all agents. */
export function startScheduler(): void {
  log.info('scheduler starting', { agents: AGENT_INSTANCES.map((a) => a.config.id) });
  for (const entry of AGENT_INSTANCES) {
    startAgent(entry);
  }
  // Graceful shutdown on SIGINT/SIGTERM.
  process.on('SIGINT', () => {
    stopAll();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    stopAll();
    process.exit(0);
  });
}

// Run when invoked directly as `npm run schedule`.
if (import.meta.url === `file://${process.argv[1]}`) {
  startScheduler();
  log.info('scheduler running — press Ctrl+C to stop');
}
