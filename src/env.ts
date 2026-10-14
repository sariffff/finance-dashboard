import { z } from "zod";

import { CLAUDE_MODELS, DEFAULT_MODEL } from "@/lib/ai/models";

// Empty values (as copied from .env.example) count as not set.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const model = z.enum(CLAUDE_MODELS, {
  error: `must be one of: ${CLAUDE_MODELS.join(", ")}`,
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
  // Optional: without it, categories and summaries come from rules only,
  // and slip reading is unavailable.
  ANTHROPIC_API_KEY: optional(z.string()),
  // Which Claude model to use, overall and per task.
  AI_MODEL: optional(model).transform((value) => value ?? DEFAULT_MODEL),
  AI_MODEL_CATEGORIZE: optional(model),
  AI_MODEL_SLIP: optional(model),
  AI_MODEL_INSIGHTS: optional(model),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export const env = envSchema.parse(process.env);
