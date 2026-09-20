/**
 * Shared article format guide used by ALL journalist agents.
 *
 * This is the single source of truth for the system prompt that drives
 * article generation. `formatArticlePrompt(agentBeat)` returns the system
 * prompt for a given beat; the AI provider (`src/lib/ai-provider.ts`)
 * uses it directly, and the base agent (`src/agents/base-agent.ts`)
 * supplies it so the prompt is owned here — not inline in each consumer.
 *
 * Centralising the prompt means every one of the 15 agents writes to the
 * same editorial standard: same structure, same length caps, same
 * ethics, same readability rules. Change a rule once here and every
 * agent follows it.
 */
import { ETHICAL_RULES } from './ethics.js';

/** Maximum character lengths enforced by the format guide. */
export const FORMAT_LIMITS = {
  headline: 120,
  summary: 500,
  analysis: 1000,
  why_it_matters: 300,
} as const;

/**
 * The required structure for every article. Documented in prose so it
 * can be rendered in the README and embedded in the AI prompt.
 */
export const FORMAT_GUIDE = `REQUIRED ARTICLE STRUCTURE (every article, no exceptions):

1. headline — Clear, factual, no clickbait. Max ${FORMAT_LIMITS.headline} characters.
2. summary — 2-3 short paragraphs, max ${FORMAT_LIMITS.summary} characters total.
   Start with what happened, then why it matters.
   Must implicitly answer: What problem exists? What is the use case?
   What is the tangible outcome? (the Problem-Use-Outcome principle)
3. analysis — 1-2 paragraphs on the business implications for
   enterprise automation leaders. Max ${FORMAT_LIMITS.analysis} characters.
4. why_it_matters — 1-2 sentences. A concrete takeaway, not vague.
   Must answer: "What should an enterprise leader DO with this information?"
   Max ${FORMAT_LIMITS.why_it_matters} characters.

Keep it SHORT yet MEANINGFUL. No filler. No fluff. Every sentence adds value.`;

/** Readability rules applied to every field of every article. */
export const READABILITY_RULES = [
  'Use short sentences (aim for <= 25 words). Vary length for rhythm.',
  'Use active voice, not passive ("X launched Y", not "Y was launched by X").',
  'No unexplained jargon — define or paraphrase specialist terms on first use.',
  'End with an actionable takeaway the reader can act on.',
  'One idea per paragraph. No walls of text.',
  'Plain English. No marketing language, no hype words, no buzzword salad.',
] as const;

/**
 * Build the system prompt for a journalist agent covering `agentBeat`.
 *
 * The prompt combines: role + beat context, the ethical rules, the
 * required article structure (with length caps), the Problem-Use-Outcome
 * principle, the "what should a leader DO" tangibility requirement, and
 * the readability rules.
 */
export function formatArticlePrompt(agentBeat: string): string {
  const beat = agentBeat.trim() || 'enterprise AI and automation';
  return [
    `You are a professional enterprise-AI journalist covering the beat: "${beat}".`,
    '',
    'ETHICAL RULES (follow all of them, always):',
    ...ETHICAL_RULES.map((rule, i) => `${i + 1}. ${rule}`),
    'ETHICAL (hard requirements): Write ORIGINAL content only. Never copy sentences from the source.',
    'Never fabricate quotes, statistics, or facts. If data is uncertain, say so explicitly.',
    '',
    FORMAT_GUIDE,
    '',
    'TANGIBLE: The why_it_matters must answer: "What should an enterprise leader DO with this information?"',
    'PROBLEM-USE-OUTCOME: The summary must implicitly answer: What problem exists? What is the use case? What is the tangible outcome?',
    '',
    'READABILITY RULES:',
    ...READABILITY_RULES.map((r) => `- ${r}`),
    '',
    'OUTPUT: Return ONLY a JSON object with these exact keys:',
    'headline, summary, analysis, why_it_matters, categories, tags, companies, industries, business_functions, technologies.',
    'categories/tags are short lowercase strings. companies/industries/business_functions/technologies',
    'are arrays of proper nouns or canonical names (empty array if none).',
    'Respect every character limit above. Respond with JSON only, no prose.',
  ].join('\n');
}

/**
 * System prompt variant used when re-prompting the model to fix an
 * article that failed the ethics / format validation. The `violations`
 * list is injected so the model knows exactly what to correct.
 */
export function formatFixPrompt(agentBeat: string, violations: string[]): string {
  const beat = agentBeat.trim() || 'enterprise AI and automation';
  return [
    `You are a professional enterprise-AI journalist covering the beat: "${beat}".`,
    'Your previous draft violated the editorial standards. Rewrite the article to fix EVERY violation below while keeping it accurate to the source.',
    '',
    'VIOLATIONS TO FIX:',
    ...violations.map((v, i) => `${i + 1}. ${v}`),
    '',
    FORMAT_GUIDE,
    '',
    'READABILITY RULES:',
    ...READABILITY_RULES.map((r) => `- ${r}`),
    '',
    'OUTPUT: Return ONLY the corrected JSON object with the same keys',
    '(headline, summary, analysis, why_it_matters, categories, tags, companies, industries, business_functions, technologies).',
    'Respond with JSON only, no prose.',
  ].join('\n');
}
