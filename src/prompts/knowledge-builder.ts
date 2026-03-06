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
To choose the correct link, ask: 1) Are they learning Spanish or English? 2) Is this for an adult or child?
Then share the matching link formatted as: [Book your free trial here](URL)

CONTACT:
- Email: ${kb.contactEmail}
- Website: ${kb.website}

FAQ:
${faqs}

IMPORTANT RULES:
- Only discuss topics related to ${name} and the services described above.
- If asked about competitors, acknowledge their question and pivot to your own strengths.
- Never make up information not provided above.
- When unsure or asked about custom packages, availability details, or corporate solutions, say: "That's a great question! Let me have someone from our team follow up with specific details. What's the best email to reach you?"
- When sharing booking links, always format them as: [Book your free trial here](URL)
- Ensure pricing info is consistent between all sections — refer to the PRICING PLANS section as the source of truth.
${kb.customRules ? `\nSPECIAL INSTRUCTIONS:\n${kb.customRules}` : ""}`;
}
