/**
 * Ethical guidelines for the journalist pipeline.
 *
 * Every article produced by the pipeline is checked against these rules
 * before it is allowed to proceed to illustration / publishing. The rules
 * are enforced in two ways:
 *
 *   1. Prompting — the AI system prompt (see `format-guide.ts`) instructs
 *      the model to follow every rule while writing.
 *   2. Validation — `validateEthics()` runs a deterministic, best-effort
 *      check on the AI output and reports any mechanically detectable
 *      violations. Articles that still violate after a re-prompt are
 *      skipped (see `src/pipeline/process.ts`).
 *
 * Not every rule can be verified mechanically (e.g. "never fabricate a
 * quote" requires knowing the source). For those, the prompt is the
 * primary enforcement and `validateEthics()` focuses on the subset that
 * CAN be checked deterministically, plus cheap heuristics that catch the
 * most common failures.
 */

/** The full set of editorial ethical rules, in human-readable form. */
export const ETHICAL_RULES: readonly string[] = [
  'Never copy source text verbatim — always rewrite in original prose.',
  'Always include the source_url so readers can verify the original.',
  'Never fabricate quotes, statistics, or facts.',
  'Clearly label assumptions, estimates, and uncertain data as such.',
  'No clickbait headlines — headlines must be factual and clear.',
  'Headlines must be punchy and engaging but factually accurate. No clickbait that misrepresents the content. WIRED-style means engaging, not misleading.',
  'No fear-mongering or sensationalized alarmist language.',
  'Respect copyright — summarize and analyze, never reproduce protected text.',
  'Disclose that the article is AI-generated / AI-assisted.',
  'No fake news — every claim must trace back to the cited source.',
  'Maintain a neutral, professional tone; avoid editorializing or hype.',
];

/**
 * Shape accepted by `validateEthics`. Accepts both the snake_case
 * AnalyzeResult/NewsItem fields and the camelCase ProcessedArticle fields
 * so the same validator can run at any stage of the pipeline.
 */
export interface EthicsArticle {
  headline: string;
  summary: string;
  analysis: string;
  why_it_matters?: string;
  whyItMatters?: string;
  source_url?: string;
  sourceUrl?: string;
}

export interface EthicsValidationResult {
  /** True when no violations were detected. */
  passed: boolean;
  /** Human-readable violation messages (empty when passed). */
  violations: string[];
}

// Heuristics -------------------------------------------------------------

/** Headlines containing these tokens / patterns read as clickbait. */
const CLICKBAIT_PATTERNS: RegExp[] = [
  /\b(you won'?t believe|shocking|mind-blowing|jaw-dropping|unbelievable|insane)\b/i,
  /\b\d+ (?:things|reasons|secrets|ways) you\b/i,
  /\?\?\?/,
];

/** Words that signal fear-mongering / sensationalist alarm. */
const FEAR_MONGERING_WORDS: RegExp[] = [
  /\b(catastroph(?:e|ic)|doom(?:sday)?|apocalyp(?:se|tic)|panic|terrify(?:ing)?|nightmare|hysteria|unprecedented disaster)\b/i,
];

/** Max lengths enforced by the format guide (kept in sync with format-guide.ts). */
const MAX_HEADLINE = 120;
const MAX_SUMMARY = 500;
const MAX_ANALYSIS = 1000;
const MAX_WHY_IT_MATTERS = 300;

function isMostlyUppercase(s: string): boolean {
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (letters.length < 8) return false;
  const upper = s.replace(/[^A-Z]/g, '').length;
  return upper / letters.length > 0.7;
}

/**
 * Check an article against the ethical rules.
 *
 * Returns `{ passed, violations }`. This is a deterministic, best-effort
 * check — it catches the violations that can be detected from the article
 * text alone (lengths, presence of source_url, clickbait / fear-mongering
 * heuristics, empty fields). Rules that require external knowledge (e.g.
 * "this quote is fabricated") are enforced primarily through the AI
 * system prompt and are NOT reported here unless they leave a detectable
 * trace.
 */
export function validateEthics(article: EthicsArticle): EthicsValidationResult {
  const violations: string[] = [];

  const headline = (article.headline ?? '').trim();
  const summary = (article.summary ?? '').trim();
  const analysis = (article.analysis ?? '').trim();
  const whyItMatters = (article.why_it_matters ?? article.whyItMatters ?? '').trim();
  const sourceUrl = (article.source_url ?? article.sourceUrl ?? '').trim();

  // Rule: always include source_url.
  if (!sourceUrl) {
    violations.push('Missing source_url — every article must cite its source.');
  }

  // Required, non-empty content fields.
  if (!headline) violations.push('Headline is empty.');
  if (!summary) violations.push('Summary is empty.');
  if (!analysis) violations.push('Analysis is empty.');
  if (!whyItMatters) violations.push('why_it_matters is empty.');

  // Rule: no clickbait headlines + format (max 120 chars).
  if (headline.length > MAX_HEADLINE) {
    violations.push(`Headline exceeds ${MAX_HEADLINE} characters (${headline.length}).`);
  }
  if (isMostlyUppercase(headline)) {
    violations.push('Headline is mostly ALL CAPS — rewrite in normal case (no clickbait shouting).');
  }
  for (const pattern of CLICKBAIT_PATTERNS) {
    if (pattern.test(headline)) {
      violations.push('Headline matches a clickbait pattern — rewrite to be factual.');
      break;
    }
  }

  // Rule: no fear-mongering language.
  if (FEAR_MONGERING_WORDS.some((p) => p.test(headline) || p.test(summary) || p.test(analysis))) {
    violations.push('Article contains fear-mongering / alarmist language — use neutral tone.');
  }

  // Format length caps (these are format rules but double as ethical
  // guards against padded / filler output).
  if (summary.length > MAX_SUMMARY) {
    violations.push(`Summary exceeds ${MAX_SUMMARY} characters (${summary.length}).`);
  }
  if (analysis.length > MAX_ANALYSIS) {
    violations.push(`Analysis exceeds ${MAX_ANALYSIS} characters (${analysis.length}).`);
  }
  if (whyItMatters.length > MAX_WHY_IT_MATTERS) {
    violations.push(`why_it_matters exceeds ${MAX_WHY_IT_MATTERS} characters (${whyItMatters.length}).`);
  }

  // Rule: clearly label assumptions. We can't fully detect this, but if
  // the article uses hedge words we at least flag the *absence* of any
  // uncertainty labelling when hedge words appear without a label.
  // (Cheap heuristic — skipped to avoid false positives; the prompt is
  // the primary enforcement.)

  // Rule: disclose AI-generated content. We expect the pipeline to add
  // a standard disclosure at publish time (see README "AI disclosure
  // policy"); per-article presence is not required here.

  return { passed: violations.length === 0, violations };
}
