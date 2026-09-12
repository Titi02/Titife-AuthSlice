import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { resetCodeSchema } from "@/lib/validation/reset-code";
import { prisma } from "@/lib/db/prisma";
import { hashToken } from "@/lib/auth/tokens";
import { checkRateLimit, recordRateLimit } from "@/lib/rate-limit/limiter";
import { getTrustedIp } from "@/lib/auth/ip";
import { RATE_LIMITS } from "@/lib/constants";

function hashesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(request: NextRequest) {
  const ip = getTrustedIp(request);

  const body = await request.json();
  const parsed = resetCodeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Invalid or expired code." },
      { status: 400 }
    );
  }

  const { email, code } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "Invalid or expired code." },
      { status: 400 }
    );
  }

  const rateCheck = await checkRateLimit(
    RATE_LIMITS.resetCodeSubmit,
    ip,
    user.id
  );
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (
    !resetToken ||
    resetToken.expiresAt < new Date() ||
    !hashesMatch(resetToken.tokenHash, hashToken(code))
  ) {
    await recordRateLimit(RATE_LIMITS.resetCodeSubmit, ip, user.id);
    return NextResponse.json(
      { ok: false, message: "Invalid or expired code." },
      { status: 400 }
    );
  }

  await recordRateLimit(RATE_LIMITS.resetCodeSubmit, ip, user.id);

  return NextResponse.json({ ok: true });
}
