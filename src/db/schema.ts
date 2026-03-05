import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, uuid } from "drizzle-orm/pg-core";

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: varchar("session_id", { length: 128 }).notNull(),
  language: varchar("language", { length: 5 }).notNull().default("en"),
  visitorName: text("visitor_name"),
  visitorEmail: text("visitor_email"),
  pageUrl: text("page_url"),
  status: varchar("status", { length: 20 }).default("active"),
  messageCount: integer("message_count").default(0),
  convertedToBooking: boolean("converted_to_booking").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
  role: varchar("role", { length: 10 }).notNull(),
  content: text("content").notNull(),
  tokensUsed: integer("tokens_used"),
  modelUsed: varchar("model_used", { length: 50 }),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at").defaultNow(),
});
