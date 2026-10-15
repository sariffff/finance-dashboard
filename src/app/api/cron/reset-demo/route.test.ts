import { describe, expect, it, vi } from "vitest";

const SECRET = vi.hoisted(() => "test-cron-secret-0123456789");

vi.mock("@/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/env")>();
  return { env: { ...actual.env, CRON_SECRET: SECRET } };
});
// connection() needs a Next.js request scope, which a unit test doesn't have.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

import { GET } from "./route";

const request = (authorization?: string) =>
  new Request("http://localhost/api/cron/reset-demo", {
    headers: authorization ? { authorization } : {},
  });

describe("GET /api/cron/reset-demo", () => {
  it("refuses requests without the cron secret", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer wrong-secret"))).status).toBe(401);
    expect((await GET(request(SECRET))).status).toBe(401); // missing "Bearer "
  });

  // Integration: resets the seeded demo account in the Docker database.
  it("resets the demo account with the right secret", async () => {
    const response = await GET(request(`Bearer ${SECRET}`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ status: "ok", months: 12 });
    expect(body.transactions).toBeGreaterThan(500);
  }, 60_000);
});
