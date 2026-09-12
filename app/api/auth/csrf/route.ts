import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateCsrfToken } from "@/lib/auth/csrf";
import {
  CSRF_COOKIE_NAME,
  COOKIE_SECURE,
  SESSION_DURATION_SECONDS,
} from "@/lib/constants";

// Double-submit CSRF for the sign-in form. The entry /signin page fetches this
// endpoint on mount; the raw token is returned in the body and echoed back in
// the sign-in POST body, where the handler compares it against the httpOnly
// cookie value it receives on the same request. A cross-site attacker cannot
// read the cookie (httpOnly) nor obtain a token from this endpoint (same-origin
// policy blocks the cross-site fetch), so it cannot forge the pair.
export async function GET(request: NextRequest) {
  const existing = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const token = existing ? existing : generateCsrfToken();

  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });

  return new NextResponse(JSON.stringify({ csrfToken: token }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}