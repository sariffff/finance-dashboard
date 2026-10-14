import { z } from "zod";

// Validate environment variables once at startup so a missing or malformed
// value fails loudly instead of surfacing later as a confusing runtime error.
const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export const env = envSchema.parse(process.env);
