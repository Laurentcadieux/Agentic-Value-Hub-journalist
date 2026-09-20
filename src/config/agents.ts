/**
 * Configuration for all 10 journalist agents.
 *
 * Each agent has: id, name, beat, description, cron-style schedule, RSS feeds,
 * default categories, default tags, and permitted source types. Exported as
 * a single `AGENTS` array of AgentConfig for the CLI + scheduler to consume.
 */
import type { AgentConfig } from '../types.js';
import { RSS_FEEDS, type AgentId } from '../sources/rss-feeds.js';

function feedUrlsFor(id: AgentId): string[] {
  return RSS_FEEDS[id].map((f) => f.url);
}

export const AGENTS: AgentConfig[] = [
  {
    id: 'enterprise-ai',
    name: 'Enterprise AI Watcher',
    beat: 'Enterprise AI platforms, vendor announcements',
    description:
      'Tracks enterprise AI platform launches, vendor announcements, and platform strategy from Gartner, Forrester, and major vendor blogs.',
    schedule: '0 */6 * * *',
    rssFeeds: feedUrlsFor('enterprise-ai'),
    categories: ['Enterprise AI'],
    defaultTags: ['enterprise', 'platform', 'vendor'],
    sourceTypes: ['rss'],
  },
  {
    id: 'agentic-scout',
    name: 'Agentic AI Scout',
    beat: 'AI agents, agentic frameworks, agent platforms',
    description:
      'Scouts news on AI agents, agentic frameworks, and agent platforms from OpenAI, Anthropic, LangChain, and CrewAI.',
    schedule: '30 */6 * * *',
    rssFeeds: feedUrlsFor('agentic-scout'),
    categories: ['Agentic AI'],
    defaultTags: ['agents', 'framework', 'autonomy'],
    sourceTypes: ['rss'],
  },
  {
    id: 'automation',
    name: 'Automation Tracker',
    beat: 'RPA, workflow automation, process mining',
    description:
      'Tracks RPA, workflow automation, and process-mining developments from UiPath, Automation Anywhere, and Blue Prism.',
    schedule: '0 */8 * * *',
    rssFeeds: feedUrlsFor('automation'),
    categories: ['Automation'],
    defaultTags: ['rpa', 'workflow', 'automation'],
    sourceTypes: ['rss'],
  },
  {
    id: 'boat',
    name: 'BOAT Observer',
    beat: 'Business Orchestration & Automation Technologies',
    description:
      'Observes Business Orchestration & Automation Technologies (BOAT) coverage from analyst reports and industry publications.',
    schedule: '30 */8 * * *',
    rssFeeds: feedUrlsFor('boat'),
    categories: ['BOAT'],
    defaultTags: ['orchestration', 'automation', 'platform'],
    sourceTypes: ['rss'],
  },
  {
    id: 'investment',
    name: 'Investment Monitor',
    beat: 'AI funding, M&A, venture capital',
    description:
      'Monitors AI funding rounds, M&A activity, and venture capital flows from TechCrunch, Crunchbase, and SEC filings.',
    schedule: '0 */4 * * *',
    rssFeeds: feedUrlsFor('investment'),
    categories: ['Investment'],
    defaultTags: ['funding', 'ma', 'venture'],
    sourceTypes: ['rss'],
  },
  {
    id: 'research',
    name: 'Research Digest',
    beat: 'Academic papers, research breakthroughs',
    description:
      'Digests academic AI papers and research breakthroughs from arXiv, Google Scholar, and major research labs.',
    schedule: '0 9 * * *',
    rssFeeds: feedUrlsFor('research'),
    categories: ['Research'],
    defaultTags: ['paper', 'research', 'breakthrough'],
    sourceTypes: ['rss'],
  },
  {
    id: 'governance',
    name: 'Governance Reporter',
    beat: 'AI governance, regulation, compliance',
    description:
      'Reports on AI governance, regulation, and compliance developments from the EU AI Act, NIST, and government publications.',
    schedule: '0 12 * * *',
    rssFeeds: feedUrlsFor('governance'),
    categories: ['Governance'],
    defaultTags: ['regulation', 'compliance', 'policy'],
    sourceTypes: ['rss'],
  },
  {
    id: 'industry',
    name: 'Industry Vertical',
    beat: 'Industry-specific AI use cases (finance, healthcare, etc.)',
    description:
      'Covers industry-specific AI use cases across finance, healthcare, and other verticals via industry publications and case studies.',
    schedule: '30 12 * * *',
    rssFeeds: feedUrlsFor('industry'),
    categories: ['Industry'],
    defaultTags: ['vertical', 'use-case', 'industry'],
    sourceTypes: ['rss'],
  },
  {
    id: 'integration',
    name: 'Integration Intel',
    beat: 'MCP, APIs, integration platforms, connectors',
    description:
      'Intelligence on Model Context Protocol, APIs, integration platforms, and connectors from MCP and API providers.',
    schedule: '0 15 * * *',
    rssFeeds: feedUrlsFor('integration'),
    categories: ['Integration'],
    defaultTags: ['mcp', 'api', 'connectors'],
    sourceTypes: ['rss'],
  },
  {
    id: 'market-pulse',
    name: 'Market Pulse',
    beat: 'Market trends, vendor comparisons, buyer guides',
    description:
      'Pulse on market trends, vendor comparisons, and buyer guides from Gartner Magic Quadrant and Forrester Wave reports.',
    schedule: '30 15 * * *',
    rssFeeds: feedUrlsFor('market-pulse'),
    categories: ['Market'],
    defaultTags: ['market', 'comparison', 'buyer-guide'],
    sourceTypes: ['rss'],
  },
  {
    id: 'canada-focus',
    name: 'Canada Focus',
    beat: 'Canadian AI and automation market, government AI initiatives, startups',
    description:
      'Covers Canadian AI and automation market developments, Canadian enterprise AI adoption, Canadian government AI initiatives, and Canadian startups via Canadian tech publications and government feeds.',
    schedule: '0 10 * * *',
    rssFeeds: feedUrlsFor('canada-focus'),
    categories: ['Regional', 'Canada'],
    defaultTags: ['canada', 'regional', 'enterprise'],
    sourceTypes: ['rss'],
  },
  {
    id: 'eu-focus',
    name: 'EU Focus',
    beat: 'European AI market, EU AI Act, GDPR/AI intersection',
    description:
      'Covers the European AI market, EU AI Act developments, European enterprise AI, European Commission AI policy, and the GDPR/AI intersection via EU publications and European tech media.',
    schedule: '0 11 * * *',
    rssFeeds: feedUrlsFor('eu-focus'),
    categories: ['Regional', 'EU'],
    defaultTags: ['eu', 'regional', 'regulation'],
    sourceTypes: ['rss'],
  },
  {
    id: 'security',
    name: 'Security',
    beat: 'AI security, agentic AI risks, prompt injection, zero-trust AI',
    description:
      'Covers AI security, agentic AI security risks, prompt injection, AI model security, the enterprise AI threat landscape, and zero-trust AI via security publications, NIST, CISA, and security vendor blogs.',
    schedule: '0 13 * * *',
    rssFeeds: feedUrlsFor('security'),
    categories: ['Security'],
    defaultTags: ['security', 'ai-security', 'threats'],
    sourceTypes: ['rss'],
  },
  {
    id: 'governance-policy',
    name: 'Governance & Policy',
    beat: 'Global AI governance, regulation, ethics, AI standards',
    description:
      'Covers global AI governance, regulation, compliance frameworks, AI ethics, AI standards (ISO, NIST, EU AI Act), and policy announcements via government publications, regulatory bodies, and policy think tanks.',
    schedule: '30 13 * * *',
    rssFeeds: feedUrlsFor('governance-policy'),
    categories: ['Governance', 'Policy'],
    defaultTags: ['governance', 'ethics', 'standards'],
    sourceTypes: ['rss'],
  },
  {
    id: 'us-focus',
    name: 'US Focus',
    beat: 'US AI market, enterprise adoption, US government AI policy',
    description:
      'Covers the US AI market, US enterprise AI adoption, US government AI policy, US AI executive orders, and the US startup ecosystem via US tech publications, White House AI feeds, and US government publications.',
    schedule: '0 14 * * *',
    rssFeeds: feedUrlsFor('us-focus'),
    categories: ['Regional', 'US'],
    defaultTags: ['us', 'regional', 'enterprise'],
    sourceTypes: ['rss'],
  },
];

/** Look up a single agent config by id. */
export function getAgentConfig(id: string): AgentConfig | undefined {
  return AGENTS.find((a) => a.id === id);
}
