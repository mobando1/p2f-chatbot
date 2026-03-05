import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { streamChat, selectModel } from "../services/claude.service.js";
import { assembleSystemPrompt } from "../services/prompt.service.js";
import {
  getOrCreateConversation,
  addMessage,
} from "../services/conversation.service.js";
import { checkRateLimit } from "../services/rate-limiter.service.js";
import { getProjectByApiKey } from "../projects/registry.js";

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
  try {
    const project = getProject(req, res);
    if (!project) return;

    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
      return;
    }

    const { message, conversationId, sessionId, language } = parsed.data;

    // Rate limit check
    if (!checkRateLimit(sessionId)) {
      res.status(429).json({ error: "Too many messages. Please wait a moment." });
      return;
    }

    // Get or create conversation (scoped to project)
    const conversation = getOrCreateConversation(conversationId, language, project.apiKey);

    // Add user message
    addMessage(conversation.id, "user", message);

    // Select model based on conversation state
    const model = selectModel(conversation.messageCount, message);

    // Build system prompt dynamically from project config
    const systemPrompt = assembleSystemPrompt(language, project);

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
        // Save assistant message
        addMessage(conversation.id, "assistant", fullResponse);

        res.write(
          `event: done\ndata: ${JSON.stringify({
            conversationId: conversation.id,
            model,
            usage: JSON.parse(event.data),
          })}\n\n`,
        );
      } else if (event.type === "error") {
        res.write(`event: error\ndata: ${JSON.stringify({ message: event.data })}\n\n`);
      }
    }

    res.end();
  } catch (error) {
    console.error("Chat error:", error);
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
