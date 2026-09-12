import { NextRequest, NextResponse } from "next/server";
import { signinSchema } from "@/lib/validation/signin";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/hash";
import { createSession } from "@/lib/auth/session";
import { checkRateLimit, recordRateLimit } from "@/lib/rate-limit/limiter";
import { getTrustedIp } from "@/lib/auth/ip";
import { csrfTokensMatch } from "@/lib/auth/csrf";
import { RATE_LIMITS, CSRF_COOKIE_NAME } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const ip = getTrustedIp(request);

  const body = await request.json();
  const parsed = signinSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Invalid email or password." },
      { status: 400 }
    );
  }

  const { email, password, csrfToken } = parsed.data;

  const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (!csrfCookie || !csrfTokensMatch(csrfToken, csrfCookie)) {
    return NextResponse.json(
      { ok: false, message: "Invalid or expired security token. Please refresh and try again." },
      { status: 403 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // PRD §5.2: same generic error for wrong password or non-existent account.
  // A non-existent account has no account id to key the limit on, so it is
  // rate limited by IP only (see the limiter's ipAndAccount handling).
  if (!user) {
    const rateCheck = await checkRateLimit(RATE_LIMITS.signin, ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { ok: false, message: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
    await recordRateLimit(RATE_LIMITS.signin, ip);
    return NextResponse.json(
      { ok: false, message: "Invalid email or password." },
      { status: 401 }
    );
  }

  const rateCheck = await checkRateLimit(RATE_LIMITS.signin, ip, user.id);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  if (!user.isVerified) {
    return NextResponse.json({
      ok: false,
      message: "Please verify your email address.",
      unverified: true,
      email: user.email,
    });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    // PRD §5.2: only failed attempts count toward the sign-in lockout.
    await recordRateLimit(RATE_LIMITS.signin, ip, user.id);
    return NextResponse.json(
      { ok: false, message: "Invalid email or password." },
      { status: 401 }
    );
  }

  await createSession(user.id);

  return NextResponse.json({ ok: true, redirectTo: "/dashboard" });
}
