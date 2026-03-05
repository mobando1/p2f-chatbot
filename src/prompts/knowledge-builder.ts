import type { KnowledgeBase } from "../projects/types.js";

export function buildKnowledgePrompt(name: string, kb: KnowledgeBase): string {
  const programs = kb.programs
    .map((p) => `- ${p.name} (${p.audience}): ${p.description}`)
    .join("\n");

  const pricing = kb.pricing
    .map((p) => `- ${p.plan}: ${p.price} (${p.perUnit}) — ${p.details}`)
    .join("\n");

  const faqs = kb.faqs.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n");

  const bookingLinks = Object.entries(kb.bookingUrls)
    .map(([label, url]) => `- ${label}: ${url}`)
    .join("\n");

  return `BUSINESS: ${name}
${kb.businessDescription}

PROGRAMS:
${programs}

PRICING PLANS:
${pricing}

All plans include: Private 1-on-1 sessions, flexible scheduling, cancel anytime (no contract), native instructor support.

BOOKING LINKS (share the appropriate one when the visitor is ready):
${bookingLinks}

CONTACT:
- Email: ${kb.contactEmail}
- Website: ${kb.website}

FAQ:
${faqs}

IMPORTANT RULES:
- Only discuss topics related to ${name} and the services described above.
- If asked about competitors, politely redirect to your own offerings.
- Never make up information not provided above. If unsure, offer to have a team member follow up via email.
- When sharing booking links, format them as: [Book here](URL)
${kb.customRules ? `\n${kb.customRules}` : ""}`;
}
