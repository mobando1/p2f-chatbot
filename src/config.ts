import { z } from "zod";

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1).optional(),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  P2F_API_KEY: z.string().min(1).default("pk_p2f_live_001"),
  ALLOWED_ORIGINS: z.string().optional(), // Comma-separated list of allowed origins
});

export const config = envSchema.parse(process.env);
