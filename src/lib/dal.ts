import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";

// Data Access Layer: the single place that turns the request's session into
// a user. Every page, server action and route handler that touches user data
// must go through `requireUser()` and pass `user.id` into the queries in
// src/db/queries — never trust a userId sent by the client.

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
};

/** Current user, or null when signed out. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const { id, name, email } = session.user;
  return { id, name, email };
});

/** Current user; redirects to sign-in when there is no valid session. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}
