import type { MessageParam } from "@anthropic-ai/sdk/resources/messages.js";

interface Conversation {
  id: string;
  projectApiKey: string;
  messages: MessageParam[];
  language: "en" | "es";
  messageCount: number;
  createdAt: number;
  visitorName?: string;
  visitorEmail?: string;
}

// In-memory store for MVP. Migrate to DB later.
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

export function getOrCreateConversation(
  conversationId: string | undefined,
  language: "en" | "es",
  projectApiKey: string,
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
  };
  conversations.set(id, conv);
  return conv;
}

export function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
): void {
  const conv = conversations.get(conversationId);
  if (conv) {
    conv.messages.push({ role, content });
    conv.messageCount++;

    // Keep max 20 messages (10 exchanges) to limit context size
    if (conv.messages.length > 20) {
      conv.messages = conv.messages.slice(-20);
    }
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
}

export function getContactInfo(
  conversationId: string,
): { name?: string; email?: string } {
  const conv = conversations.get(conversationId);
  return { name: conv?.visitorName, email: conv?.visitorEmail };
}
