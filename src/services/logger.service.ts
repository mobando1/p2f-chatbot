interface LogContext {
  conversationId?: string;
  sessionId?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  [key: string]: unknown;
}

function formatLog(level: string, message: string, context?: LogContext): string {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  return JSON.stringify(entry);
}

export const logger = {
  info(message: string, context?: LogContext) {
    console.log(formatLog("info", message, context));
  },
  warn(message: string, context?: LogContext) {
    console.warn(formatLog("warn", message, context));
  },
  error(message: string, context?: LogContext) {
    console.error(formatLog("error", message, context));
  },
};
