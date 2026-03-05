import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { chatRouter } from "./api/chat.controller.js";
import { healthRouter } from "./api/health.controller.js";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// CORS — allow any origin for the widget (secured by rate limiting)
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  }),
);

app.use(express.json({ limit: "16kb" }));

// Logging
app.use((req, _res, next) => {
  if (req.path.startsWith("/api")) {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  }
  next();
});

// API routes
app.use("/api/v1", chatRouter);
app.use(healthRouter);

// Serve widget static files
const widgetDir = path.resolve(__dirname, "widget");
app.use("/widget", express.static(widgetDir));

// Start server
app.listen(config.PORT, "0.0.0.0", () => {
  console.log(`p2f-chatbot server running on port ${config.PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
});
