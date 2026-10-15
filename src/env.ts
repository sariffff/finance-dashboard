import { z } from "zod";

import { AI_MODELS } from "@/lib/ai/models";

// Empty values (as copied from .env.example) count as not set.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const model = z.enum(AI_MODELS, {
  error: `must be one of: ${AI_MODELS.join(", ")}`,
});

// Validate environment variables once at startup so a missing or malformed
// value fails loudly instead of surfacing later as a confusing runtime error.
const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  // Shared demo account behind the "ลองใช้ด้วยบัญชีตัวอย่าง" button.
  // Its password is effectively public — it must only ever hold seed data.
  DEMO_USER_EMAIL: z.email(),
  DEMO_USER_PASSWORD: z.string().min(8),
  // Optional AI providers: Claude (claude-* models) and Gemini (gemini-*).
  // Without the key for the chosen model, categories and summaries come
  // from rules only and slip reading is unavailable.
  ANTHROPIC_API_KEY: optional(z.string()),
  GEMINI_API_KEY: optional(z.string()),
  // Which model to use, overall and per task. Unset = the default model of
  // whichever provider has a key (see src/lib/ai/config.ts).
  AI_MODEL: optional(model),
  AI_MODEL_CATEGORIZE: optional(model),
  AI_MODEL_SLIP: optional(model),
  AI_MODEL_INSIGHTS: optional(model),
  // S3-compatible file storage (RustFS locally, Cloudflare R2 in production).
  // Optional: without it, original statement files are not kept.
  S3_ENDPOINT: optional(z.url()),
  S3_REGION: optional(z.string()).transform((value) => value ?? "auto"),
  S3_BUCKET: optional(z.string()),
  S3_ACCESS_KEY_ID: optional(z.string()),
  S3_SECRET_ACCESS_KEY: optional(z.string()),
  S3_FORCE_PATH_STYLE: optional(z.enum(["true", "false"])).transform((value) => value === "true"),
  // Vercel Cron sends it as a bearer token; the demo-reset job refuses
  // every request when it isn't set. Generate with: openssl rand -hex 32
  CRON_SECRET: optional(z.string().min(16)),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

type Env = z.infer<typeof envSchema>;

/**
 * `next build` inside Docker runs without secrets (they are supplied only
 * when the container starts), but the build still imports server modules.
 * SKIP_ENV_VALIDATION=1 — set only in the Dockerfile's build stage — lets
 * the build through with whatever is set; the running app always validates.
 */
export const env: Env =
  process.env.SKIP_ENV_VALIDATION === "1"
    ? (envSchema.partial().parse(process.env) as Env)
    : envSchema.parse(process.env);
