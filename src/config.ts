import { z } from "zod";

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1).optional(),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
});

export const config = envSchema.parse(process.env);
