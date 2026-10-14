import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: it looks for the session cookie without hitting the
// database. The real check is requireUser() in src/lib/dal.ts, which runs on
// every protected page and server action.
//
// It deliberately does not bounce signed-in users away from /sign-in: an
// expired cookie still "looks" signed in here, and the dashboard would send
// it straight back, causing a redirect loop.

export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
