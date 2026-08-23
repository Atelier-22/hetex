import "dotenv/config";
import { z } from "zod";

// Fail loudly at boot rather than at the first request. A backend that starts
// without a database URL or JWT secret is not "running" in any useful sense.
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required (a postgres:// connection string)"),

  // Signs the bearer tokens used by both the web and mobile clients.
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("30d"),

  // Optional — the provider layer reports "not configured" rather than faking
  // responses when this is absent.
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),

  // Optional second provider. Absent means its models simply are not offered.
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().default("https://api.deepseek.com"),

  // Comma-separated list of browser origins allowed to call this API.
  // Native mobile clients send no Origin header and are always allowed.
  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  WEB_SEARCH_PROVIDER: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export const isProduction = env.NODE_ENV === "production";
