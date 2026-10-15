import { request, type FullConfig } from "@playwright/test";

// A freshly started server loads each route's code on its first request.
// When the parallel tests all arrive at once — while password hashing and
// PDF parsing compete for the same Node.js thread pool — those first pages
// can take longer than a test is willing to wait. Visit the main pages once
// as the demo user so the tests start against a warm server.
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  const context = await request.newContext({ baseURL });
  try {
    const signIn = await context.post("/api/auth/sign-in/email", {
      headers: { Origin: baseURL },
      data: {
        email: process.env.DEMO_USER_EMAIL ?? "demo@finance.local",
        password: process.env.DEMO_USER_PASSWORD ?? "demo-password-1234",
      },
    });
    if (!signIn.ok()) {
      throw new Error(`Demo sign-in failed (${signIn.status()}) — run \`npm run db:seed\` first`);
    }
    for (const path of ["/", "/sign-in", "/sign-up", "/dashboard", "/dashboard/import", "/dashboard/transactions"]) {
      await context.get(path);
    }
  } finally {
    await context.dispose();
  }
}
