import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next.js, so load .env ourselves.
config({ quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
