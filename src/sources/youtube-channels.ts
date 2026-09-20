/**
 * YouTube channel definitions per agent.
 *
 * Channels are listed by their public @handle (human-readable and
 * verifiable on youtube.com). The monitor resolves @handles to UC...
 * channel ids at runtime by scraping the channel page, then uses the
 * per-channel RSS feed to list new uploads — so no API key is required.
 *
 * Channels are assigned only to agents whose beat a given channel covers.
 */
import type { AgentId } from './rss-feeds.js';

export interface ChannelDefinition {
  /** YouTube channel name (for attribution). */
  name: string;
  /** Channel @handle (e.g. "@TwoMinutePapers") or UC... id. */
  handle: string;
}

/** YouTube channels keyed by agent id. */
export const YOUTUBE_CHANNELS: Partial<Record<AgentId, ChannelDefinition[]>> = {
  'agentic-scout': [
    { name: 'Two Minute Papers', handle: '@TwoMinutePapers' },
    { name: 'AI Explained', handle: '@aiexplained' },
    { name: 'Matthew Berman', handle: '@matthewberman2' },
  ],
  security: [
    { name: 'Hak5', handle: '@hak5' },
    { name: 'John Hammond', handle: '@JohnHammond010' },
    { name: 'LiveOverflow', handle: '@LiveOverflow' },
  ],
  governance: [
    { name: 'European Commission', handle: '@EuropeanCommission' },
    { name: 'Council of the EU', handle: '@EuropeanCouncil' },
  ],
  'governance-policy': [
    { name: 'Brookings Institution', handle: '@BrookingsInstitution' },
    { name: 'OECD', handle: '@OECD' },
  ],
  'canada-focus': [
    { name: 'BetaKit', handle: '@BetaKit' },
    { name: 'IT World Canada', handle: '@ITWorldCanada' },
  ],
  'us-focus': [
    { name: 'NBC News', handle: '@NBCNews' },
    { name: 'CBS News', handle: '@CBSNews' },
  ],
  'enterprise-ai': [
    { name: 'UiPath', handle: '@UiPath' },
    { name: 'Microsoft Mechanics', handle: '@MicrosoftMechanics' },
    { name: 'Google Cloud', handle: '@googlecloud' },
    { name: 'Amazon Web Services', handle: '@amazonwebservices' },
  ],
  research: [
    { name: 'Google DeepMind', handle: '@GoogleDeepMind' },
    { name: 'OpenAI', handle: '@OpenAI' },
    { name: 'Anthropic', handle: '@anthropic' },
  ],
};
