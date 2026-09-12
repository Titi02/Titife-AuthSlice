import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { resetPasswordSchema } from "@/lib/validation/reset-password";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/hash";
import { hashToken } from "@/lib/auth/tokens";
import { deleteAllUserSessions } from "@/lib/auth/session";
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
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      },
      { status: 400 }
    );
  }

  const { email, code, password } = parsed.data;

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

  const passwordHash = await hashPassword(password);

  // PRD §7.7: mark the token used in the same transaction as the password
  // update. The conditional updateMany returns 0 if a concurrent request already
  // consumed it, so a single-use token can never be redeemed twice.
  const consumed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.passwordResetToken.updateMany({
      where: { id: resetToken.id, userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    if (count === 0) {
      return false;
    }

    await tx.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        id: { not: resetToken.id },
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return true;
  });

  if (!consumed) {
    await recordRateLimit(RATE_LIMITS.resetCodeSubmit, ip, user.id);
    return NextResponse.json(
      { ok: false, message: "Invalid or expired code." },
      { status: 400 }
    );
  }

  // PRD §5.4: a successful reset invalidates every other session.
  await deleteAllUserSessions(user.id);
  await recordRateLimit(RATE_LIMITS.resetCodeSubmit, ip, user.id);

  return NextResponse.json({ ok: true });
}
