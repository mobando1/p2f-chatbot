import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages.js";

const client = new Anthropic();

const STREAM_TIMEOUT_MS = 30_000;

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

    // Timeout: abort if no completion within limit
    const timeout = setTimeout(() => stream.abort(), STREAM_TIMEOUT_MS);

    try {
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
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[claude] Stream error:", message);
    yield { type: "error", data: message };
  }
}

export function selectModel(messageCount: number, content: string): string {
  const isSimple =
    content.length < 50 ||
    /^(hi|hello|hola|hey|pricing|price|cost|schedule|hours|how much|cuanto|precio|horario)/i.test(
      content,
    );

  if (messageCount <= 3 || isSimple) {
    return "claude-haiku-4-5-20251001";
  }

  return "claude-sonnet-4-6-20250514";
}
