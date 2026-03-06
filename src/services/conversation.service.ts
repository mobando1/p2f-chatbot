import type { MessageParam } from "@anthropic-ai/sdk/resources/messages.js";
import { logger } from "./logger.service.js";

interface Conversation {
  id: string;
  projectApiKey: string;
  messages: MessageParam[];
  language: "en" | "es";
  messageCount: number;
  createdAt: number;
  sessionId?: string;
  visitorName?: string;
  visitorEmail?: string;
}

// In-memory store (primary), with optional DB persistence when DATABASE_URL is set
const conversations = new Map<string, Conversation>();

// Clean up conversations older than 2 hours
setInterval(() => {
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, conv] of conversations) {
    if (conv.createdAt < twoHoursAgo) {
      conversations.delete(id);
    }
  }
}, 10 * 60 * 1000);

/** Fire-and-forget DB persistence (only if DATABASE_URL is configured) */
async function persistToDb(action: string, data: Record<string, unknown>) {
  try {
    if (!process.env.DATABASE_URL) return;
    const { getDb } = await import("../db/index.js");
    const { conversations: convTable, messages: msgTable } = await import("../db/schema.js");
    const db = getDb();

    if (action === "upsert_conversation") {
      await db.insert(convTable).values({
        id: data.id as string,
        sessionId: data.sessionId as string,
        language: data.language as string,
        visitorName: data.visitorName as string | undefined,
        visitorEmail: data.visitorEmail as string | undefined,
        messageCount: data.messageCount as number,
        status: "active",
      }).onConflictDoUpdate({
        target: convTable.id,
        set: {
          visitorName: data.visitorName as string | undefined,
          visitorEmail: data.visitorEmail as string | undefined,
          messageCount: data.messageCount as number,
          lastMessageAt: new Date(),
        },
      });
    } else if (action === "insert_message") {
      await db.insert(msgTable).values({
        conversationId: data.conversationId as string,
        role: data.role as string,
        content: data.content as string,
        modelUsed: data.modelUsed as string | undefined,
        tokensUsed: data.tokensUsed as number | undefined,
      });
    }
  } catch (err) {
    logger.warn("DB persistence failed (non-blocking)", {
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

export function getOrCreateConversation(
  conversationId: string | undefined,
  language: "en" | "es",
  projectApiKey: string,
  sessionId?: string,
): Conversation {
  if (conversationId && conversations.has(conversationId)) {
    return conversations.get(conversationId)!;
  }

  const id = conversationId || crypto.randomUUID();
  const conv: Conversation = {
    id,
    projectApiKey,
    messages: [],
    language,
    messageCount: 0,
    createdAt: Date.now(),
    sessionId,
  };
  conversations.set(id, conv);

  // Persist new conversation (fire-and-forget)
  persistToDb("upsert_conversation", {
    id,
    sessionId: sessionId || "unknown",
    language,
    messageCount: 0,
  });

  return conv;
}

export function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  metadata?: { model?: string; tokens?: number },
): void {
  const conv = conversations.get(conversationId);
  if (conv) {
    conv.messages.push({ role, content });
    conv.messageCount++;

    // Keep max 20 messages (10 exchanges) to limit context size
    if (conv.messages.length > 20) {
      conv.messages = conv.messages.slice(-20);
    }

    // Persist message (fire-and-forget)
    persistToDb("insert_message", {
      conversationId,
      role,
      content,
      modelUsed: metadata?.model,
      tokensUsed: metadata?.tokens,
    });
  }
}

export function getConversation(id: string): Conversation | undefined {
  return conversations.get(id);
}

export function updateContactInfo(
  conversationId: string,
  info: { name?: string; email?: string },
): void {
  const conv = conversations.get(conversationId);
  if (!conv) return;
  if (info.name && !conv.visitorName) conv.visitorName = info.name;
  if (info.email && !conv.visitorEmail) conv.visitorEmail = info.email;

  // Persist contact update (fire-and-forget)
  persistToDb("upsert_conversation", {
    id: conversationId,
    sessionId: conv.sessionId || "unknown",
    language: conv.language,
    visitorName: conv.visitorName,
    visitorEmail: conv.visitorEmail,
    messageCount: conv.messageCount,
  });
}

export function getContactInfo(
  conversationId: string,
): { name?: string; email?: string } {
  const conv = conversations.get(conversationId);
  return { name: conv?.visitorName, email: conv?.visitorEmail };
}
