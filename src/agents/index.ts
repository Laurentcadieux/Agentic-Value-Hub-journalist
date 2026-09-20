/**
 * Agent instances — one BaseJournalist per AgentConfig.
 *
 * Exports `AGENTS` (array of { config, instance }) and `getAgent(id)` so
 * the CLI / scheduler can run a specific agent or all of them.
 */
import { AGENTS, getAgentConfig } from '../config/agents.js';
import { BaseJournalist } from './base-agent.js';
import type { AgentConfig } from '../types.js';

export interface AgentEntry {
  config: AgentConfig;
  instance: BaseJournalist;
}

export const AGENT_INSTANCES: AgentEntry[] = AGENTS.map((config) => ({
  config,
  instance: new BaseJournalist(config),
}));

/** Look up a single agent entry by id. */
export function getAgent(id: string): AgentEntry | undefined {
  const config = getAgentConfig(id);
  if (!config) return undefined;
  return AGENT_INSTANCES.find((a) => a.config.id === id);
}
