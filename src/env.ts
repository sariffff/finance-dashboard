import { z } from "zod";

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
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export const env = envSchema.parse(process.env);
