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
  model: string = "claude-haiku-4-5-20241022",
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

export function selectModel(messageCount: number, content: string): string {
  const isSimple =
    content.length < 50 ||
    /^(hi|hello|hola|hey|pricing|price|cost|schedule|hours|how much|cuanto|precio|horario)/i.test(
      content,
    );

  if (messageCount <= 3 || isSimple) {
    return "claude-haiku-4-5-20241022";
  }

  return "claude-sonnet-4-5-20241022";
}
