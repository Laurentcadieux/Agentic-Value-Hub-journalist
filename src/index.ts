/**
 * CLI entry point.
 *
 * Usage:
 *   npx tsx src/index.ts                          # run all agents
 *   npx tsx src/index.ts --agent enterprise-ai    # run one agent
 *   npx tsx src/index.ts --dry-run                 # process without publishing
 *   npx tsx src/index.ts --all --dry-run           # all agents, no publish
 */
import 'dotenv/config';
import { AGENT_INSTANCES, getAgent } from './agents/index.js';
import { Logger } from './lib/logger.js';

const log = new Logger('cli');

function parseArgs(argv: string[]): { agent?: string; all: boolean; dryRun: boolean } {
  const out: { agent?: string; all: boolean; dryRun: boolean } = { all: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--agent' || a === '-a') out.agent = argv[++i];
    else if (a === '--all') out.all = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a?.startsWith('--agent=')) out.agent = a.slice('--agent='.length);
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  log.info('starting', { agent: args.agent ?? 'all', dryRun: args.dryRun });

  if (args.agent) {
    const entry = getAgent(args.agent);
    if (!entry) {
      log.error('unknown agent', { agent: args.agent });
      log.info('available agents', { agents: AGENT_INSTANCES.map((a) => a.config.id) });
      process.exit(1);
    }
    const result = await entry.instance.run({ dryRun: args.dryRun });
    log.info('agent finished', { agent: entry.config.id, result });
    return;
  }

  // Run all agents sequentially.
  for (const entry of AGENT_INSTANCES) {
    try {
      log.info('running agent', { agent: entry.config.id, name: entry.config.name });
      const result = await entry.instance.run({ dryRun: args.dryRun });
      log.info('agent done', { agent: entry.config.id, result });
    } catch (err) {
      log.error('agent crashed', {
        agent: entry.config.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  log.info('all agents finished');
}

main().catch((err) => {
  log.error('fatal', { error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined });
  process.exit(1);
});
