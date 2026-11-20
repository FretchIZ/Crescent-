import { z } from "zod";

/**
 * Runtime environment validation. Fails fast on invalid configuration instead
 * of surfacing confusing errors later. Optional integrations (OpenAI, email)
 * are only activated when their credentials are present.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32).optional(),
  OPENAI_API_KEY: z.string().min(10).optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Brandmark <no-reply@brandmark.local>"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

if (env.NODE_ENV === "production" && !env.SESSION_SECRET) {
  // Session tokens themselves are random + hashed at rest; the secret salts
  // derived identifiers (IP hashes). Require it in production for defence in depth.
  throw new Error("SESSION_SECRET must be set in production");
}

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
export const aiEnabled = Boolean(env.OPENAI_API_KEY);
export const emailEnabled = Boolean(env.RESEND_API_KEY);
