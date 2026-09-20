/**
 * WIRED-inspired example articles.
 *
 * These show what a perfect pipeline output looks like under the WIRED
 * editorial voice: punchy headline, hook-first nut graf, authoritative
 * analysis, and a direct actionable takeaway. Used as a reference for the
 * AI system prompt (via the format guide) and documented in the README.
 *
 * Each example covers a different beat to show the voice adapts: enterprise
 * AI, security, and governance.
 */

/** The canonical example article (enterprise AI beat). */
export const EXAMPLE_ARTICLE = {
  headline: "AI Agents Are Quietly Taking Over Enterprise Support",
  summary:
    "The boring truth about AI agents: they're not replacing workers. They're handling the 80% of support tickets nobody wants to touch.\n\n" +
    "Companies deploying agentic AI for customer support report 40-60% reduction in tier-1 ticket volume.\n\n" +
    "That's not a headline-grabbing layoff story. It's a quiet reassignment of grunt work — and it's reshaping how support teams hire.",
  analysis:
    "Companies deploying agentic AI for customer support report 40-60% reduction in tier-1 ticket volume. The agents handle password resets, status checks, and simple refunds — the grunt work that burns out human agents.\n\n" +
    "The pattern repeats across the enterprise: AI takes the high-volume, low-judgment work, and humans handle the escalations that actually need judgment. Support teams stop hiring for ticket throughput and start hiring for problem-solving.",
  why_it_matters:
    "If you run a support team over 20 people, pilot agentic AI on your lowest-complexity tickets this quarter. The ROI is measurable within 90 days.",
};

/** Example article for the security beat. */
export const EXAMPLE_ARTICLE_SECURITY = {
  headline: "Prompt Injection Just Became an Enterprise IT Problem",
  summary:
    "Your AI agent will do exactly what it's told — even by someone who isn't you.\n\n" +
    "A wave of proof-of-concept attacks shows agentic AI systems executing hidden instructions buried in emails, documents, and web pages they're asked to process.\n\n" +
    "The fix isn't a patch. It's a rethink of how agents are allowed to act.",
  analysis:
    "Prompt injection turns every input an agent reads into a potential attack surface. Unlike traditional software bugs, there's no clean signature to block — the malicious instruction looks like normal text. Vendors are racing toward sandboxed tool access and human-in-the-loop checkpoints, but no standard exists yet.\n\n" +
    "For now, the defense is operational, not technical: limit what agents can do, log every action, and treat any agent with write access to production systems as a privileged user.",
  why_it_matters:
    "Before you give an AI agent access to your email, files, or production tools, audit what it can actually do. An agent that can send a payment is an agent that can be robbed.",
};

/** Example article for the governance beat. */
export const EXAMPLE_ARTICLE_GOVERNANCE = {
  headline: "The EU's New AI Rules Are Forcing a Paperwork Revolution",
  summary:
    "Compliance teams spent years building GDPR playbooks. AI regulation is asking them to start over.\n\n" +
    "The EU AI Act's risk-tier framework now requires companies to document, test, and log any high-risk AI system before it ships.\n\n" +
    "That sounds bureaucratic. In practice it's the first time 'we use AI' comes with a legal paper trail.",
  analysis:
    "The EU AI Act splits AI systems into risk tiers, and the high-risk bucket — hiring tools, credit scoring, critical infrastructure — now carries documentation, testing, and logging obligations that resemble medical device certification more than software release notes.\n\n" +
    "US and Canadian firms aren't exempt: any system touching EU users falls in scope. The practical effect is that 'AI governance' moves from a policy slide deck to a procurement and engineering requirement. Vendors who can't supply model cards and audit logs start losing deals.",
  why_it_matters:
    "If you build or buy AI tools that touch EU users, map them against the AI Act's risk tiers this quarter. The documentation burden is real, and it starts on day one of deployment — not when a regulator asks.",
};

/** All WIRED-inspired example articles keyed by beat. */
export const EXAMPLE_ARTICLES = {
  enterprise_ai: EXAMPLE_ARTICLE,
  security: EXAMPLE_ARTICLE_SECURITY,
  governance: EXAMPLE_ARTICLE_GOVERNANCE,
} as const;
