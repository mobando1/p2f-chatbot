import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { chatRouter } from "./api/chat.controller.js";
import { healthRouter } from "./api/health.controller.js";
import { logger } from "./services/logger.service.js";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// CORS — configurable via ALLOWED_ORIGINS env var, defaults to open for widget embedding
const allowedOrigins = config.ALLOWED_ORIGINS
  ? config.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : null;
app.use(
  cors({
    origin: allowedOrigins || true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "x-api-key"],
  }),
);

// Trust proxy for accurate IP-based rate limiting behind reverse proxies
app.set("trust proxy", 1);

app.use(express.json({ limit: "16kb" }));

// Request logging
app.use((req, _res, next) => {
  if (req.path.startsWith("/api")) {
    logger.info(`${req.method} ${req.path}`, { ip: req.ip });
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
  logger.info("Server started", {
    port: config.PORT,
    environment: config.NODE_ENV,
    corsOrigins: allowedOrigins ? allowedOrigins.join(", ") : "all",
    dbConfigured: !!config.DATABASE_URL,
  });
});
