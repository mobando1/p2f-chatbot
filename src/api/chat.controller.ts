import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { streamChat, selectModel } from "../services/claude.service.js";
import { assembleSystemPrompt } from "../services/prompt.service.js";
import {
  getOrCreateConversation,
  addMessage,
  updateContactInfo,
  getContactInfo,
  loadContactFromDb,
} from "../services/conversation.service.js";
import { extractContactInfo } from "../services/contact-extractor.service.js";
import { checkRateLimit } from "../services/rate-limiter.service.js";
import { getProjectByApiKey } from "../projects/registry.js";
import { logger } from "../services/logger.service.js";

const chatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
  sessionId: z.string().min(1).max(128),
  language: z.enum(["en", "es"]).default("en"),
  pageUrl: z.string().optional(),
});

export const chatRouter = Router();

// Middleware: extract and validate project from API key
function getProject(req: Request, res: Response) {
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (!apiKey) {
    res.status(401).json({ error: "Missing x-api-key header" });
    return null;
  }

  const project = getProjectByApiKey(apiKey);
  if (!project) {
    res.status(401).json({ error: "Invalid API key" });
    return null;
  }

  return project;
}

chatRouter.post("/chat", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const project = getProject(req, res);
    if (!project) return;

    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
      return;
    }

    const { message, conversationId, sessionId, language } = parsed.data;

    // Rate limit check (session + IP)
    if (!checkRateLimit(sessionId, req.ip)) {
      logger.warn("Rate limited", { sessionId, ip: req.ip });
      res.status(429).json({ error: "Too many messages. Please wait a moment." });
      return;
    }

    // Get or create conversation (scoped to project, with sessionId for DB persistence)
    const conversation = getOrCreateConversation(conversationId, language, project.apiKey, sessionId);

    // If this is a resumed conversation (has conversationId but fresh in memory), try loading contact from DB
    if (conversationId && conversation.messageCount === 0) {
      const dbContact = await loadContactFromDb(conversationId);
      if (dbContact) {
        updateContactInfo(conversation.id, dbContact);
        logger.info("Contact info restored from DB", {
          conversationId: conversation.id,
          hasName: !!dbContact.name,
          hasEmail: !!dbContact.email,
        });
      }
    }

    // Add user message
    addMessage(conversation.id, "user", message);

    // Extract and store contact info from user message
    const extracted = extractContactInfo(message);
    if (extracted.name || extracted.email) {
      updateContactInfo(conversation.id, extracted);
      logger.info("Contact info extracted", {
        conversationId: conversation.id,
        hasName: !!extracted.name,
        hasEmail: !!extracted.email,
      });
    }

    // Select model based on conversation state
    const model = selectModel(conversation.messageCount, message);

    // Build system prompt dynamically from project config (with contact personalization)
    const contactInfo = getContactInfo(conversation.id);
    const systemPrompt = assembleSystemPrompt(language, project, contactInfo);

    // Set up SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    let fullResponse = "";

    // Stream the response
    for await (const event of streamChat(
      systemPrompt,
      conversation.messages,
      model,
    )) {
      if (event.type === "text") {
        fullResponse += event.data;
        res.write(`event: token\ndata: ${JSON.stringify({ text: event.data })}\n\n`);
      } else if (event.type === "done") {
        const usage = JSON.parse(event.data);
        const latencyMs = Date.now() - startTime;

        // Save assistant message with metadata
        addMessage(conversation.id, "assistant", fullResponse, {
          model,
          tokens: usage.outputTokens,
        });

        logger.info("Chat response completed", {
          conversationId: conversation.id,
          sessionId,
          model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          latencyMs,
          messageCount: conversation.messageCount,
        });

        res.write(
          `event: done\ndata: ${JSON.stringify({
            conversationId: conversation.id,
            model,
            usage,
            contactInfo: getContactInfo(conversation.id),
          })}\n\n`,
        );
      } else if (event.type === "error") {
        logger.error("Stream error", {
          conversationId: conversation.id,
          error: event.data,
        });
        res.write(`event: error\ndata: ${JSON.stringify({ message: event.data })}\n\n`);
      }
    }

    res.end();
  } catch (error) {
    logger.error("Chat error", {
      error: error instanceof Error ? error.message : "unknown",
    });
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    } else {
      res.write(
        `event: error\ndata: ${JSON.stringify({ message: "Internal server error" })}\n\n`,
      );
      res.end();
    }
  }
});

chatRouter.get("/widget-config", (req: Request, res: Response) => {
  const project = getProject(req, res);
  if (!project) return;

  const wc = project.widgetConfig;
  res.json({
    primaryColor: wc.primaryColor,
    accentColor: wc.accentColor,
    position: "bottom-right",
    companyName: wc.headerTitle,
    greeting: wc.greeting,
    quickReplies: wc.quickReplies,
  });
});
