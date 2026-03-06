import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages.js";

const client = new Anthropic();

export interface StreamEvent {
  type: "text" | "done" | "error";
  data: string;
}

export async function* streamChat(
  systemPrompt: string,
  messages: MessageParam[],
  model: string = "claude-haiku-4-5-20251001",
): AsyncGenerator<StreamEvent> {
  try {
    const stream = client.messages.stream({
      model,
      max_tokens: 512,
      system: systemPrompt,
      messages,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield { type: "text", data: event.delta.text };
      }
    }

    const finalMessage = await stream.finalMessage();
    yield {
      type: "done",
      data: JSON.stringify({
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
      }),
    };
  } catch (error) {
    yield {
      type: "error",
      data: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Keywords that indicate simple queries (both EN and ES)
const SIMPLE_PATTERNS =
  /^(hi|hello|hola|hey|thanks|gracias|ok|okay|yes|no|sí|si|sure|claro|dale)\b/i;

const COMPLEX_INDICATORS =
  /\b(how|why|explain|compare|difference|benefit|recommend|suggest|best|cómo|por qué|explica|compara|diferencia|beneficio|recomienda|mejor)\b/i;

export function selectModel(messageCount: number, content: string): string {
  const trimmed = content.trim();

  // Very short greetings/confirmations → Haiku
  if (trimmed.length < 30 && SIMPLE_PATTERNS.test(trimmed)) {
    return "claude-haiku-4-5-20251001";
  }

  // Multiple questions in one message → Sonnet
  const questionMarks = (trimmed.match(/\?/g) || []).length;
  if (questionMarks > 1) {
    return "claude-sonnet-4-6-20250514";
  }

  // Complex question keywords → Sonnet
  if (COMPLEX_INDICATORS.test(trimmed) && trimmed.length > 40) {
    return "claude-sonnet-4-6-20250514";
  }

  // Early in conversation, use Haiku for speed
  if (messageCount <= 3) {
    return "claude-haiku-4-5-20251001";
  }

  // Longer messages later in conversation → Sonnet
  if (trimmed.length > 80) {
    return "claude-sonnet-4-6-20250514";
  }

  // Default to Haiku for cost efficiency
  return "claude-haiku-4-5-20251001";
}
