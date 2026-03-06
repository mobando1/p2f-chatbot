const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

const NAME_PATTERNS = [
  // English patterns
  /(?:my name is|i'm|i am|this is|it's|call me)\s+([A-ZÀ-ÖØ-öø-ÿa-z][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-öø-ÿa-z][a-zà-öø-ÿ]+){0,2})/i,
  // Spanish patterns
  /(?:me llamo|soy|mi nombre es)\s+([A-ZÀ-ÖØ-öø-ÿa-z][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-öø-ÿa-z][a-zà-öø-ÿ]+){0,2})/i,
];

// Matches bare name replies: 1-3 capitalized words, nothing else
const BARE_NAME_REGEX = /^([A-ZÀ-ÖØ-öø-ÿ][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-öø-ÿ][a-zà-öø-ÿ]+){0,2})\.?$/;

// Common words that look like names but aren't
const FALSE_POSITIVES = new Set([
  "hello", "hi", "hey", "thanks", "thank", "sure", "yes", "no", "ok", "okay",
  "good", "great", "nice", "cool", "fine", "well", "please", "sorry",
  "hola", "gracias", "bueno", "bien", "claro", "dale", "perfecto",
  "spanish", "english", "classes", "pricing", "price",
]);

function extractName(message: string): string | undefined {
  // Try contextual patterns first
  for (const pattern of NAME_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      return capitalizeName(match[1].trim());
    }
  }

  // Try bare name (short message, 1-3 capitalized words)
  const trimmed = message.trim();
  if (trimmed.length <= 40) {
    const bareMatch = trimmed.match(BARE_NAME_REGEX);
    if (bareMatch) {
      const candidate = bareMatch[1].toLowerCase();
      // Reject common false positives
      if (!FALSE_POSITIVES.has(candidate)) {
        return capitalizeName(bareMatch[1]);
      }
    }
  }

  return undefined;
}

function capitalizeName(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function extractEmail(message: string): string | undefined {
  const match = message.match(EMAIL_REGEX);
  return match ? match[0].toLowerCase() : undefined;
}

export function extractContactInfo(message: string): {
  name?: string;
  email?: string;
} {
  return {
    name: extractName(message),
    email: extractEmail(message),
  };
}
