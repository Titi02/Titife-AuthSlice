import { NextRequest, NextResponse } from "next/server";
import { verifyEmailSchema } from "@/lib/validation/verify-email";
import { prisma } from "@/lib/db/prisma";
import { createSession } from "@/lib/auth/session";
import { checkRateLimit, recordRateLimit } from "@/lib/rate-limit/limiter";
import { getTrustedIp } from "@/lib/auth/ip";
import { RATE_LIMITS } from "@/lib/constants";
import { timingSafeEqual } from "crypto";

function codesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(request: NextRequest) {
  const ip = getTrustedIp(request);
  const body = await request.json();
  const parsed = verifyEmailSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Invalid or expired code." },
      { status: 400 }
    );
  }

  const { email, code } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.isVerified) {
    return NextResponse.json(
      { ok: false, message: "Invalid or expired code." },
      { status: 400 }
    );
  }

  const rateCheck = await checkRateLimit(
    RATE_LIMITS.verificationSubmit,
    ip,
    user.id
  );
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

  const verificationCode = await prisma.verificationCode.findFirst({
    where: { userId: user.id, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (
    !verificationCode ||
    verificationCode.expiresAt < new Date() ||
    !codesMatch(code, verificationCode.code)
  ) {
    await recordRateLimit(RATE_LIMITS.verificationSubmit, ip, user.id);
    return NextResponse.json(
      { ok: false, message: "Invalid or expired code." },
      { status: 400 }
    );
  }

  // PRD §7.5/§7.9: consume the code atomically. The conditional deleteMany
  // returns 0 if a concurrent request already consumed it, so a single-use code
  // can never be redeemed twice.
  const consumed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.verificationCode.deleteMany({
      where: {
        id: verificationCode.id,
        userId: user.id,
        usedAt: null,
        expiresAt: { gte: new Date() },
      },
    });

    if (count === 0) {
      return false;
    }

    await tx.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    });

    return true;
  });

  if (!consumed) {
    await recordRateLimit(RATE_LIMITS.verificationSubmit, ip, user.id);
    return NextResponse.json(
      { ok: false, message: "Invalid or expired code." },
      { status: 400 }
    );
  }

  await createSession(user.id);
  await recordRateLimit(RATE_LIMITS.verificationSubmit, ip, user.id);

  return NextResponse.json({ ok: true, redirectTo: "/dashboard" });
}
