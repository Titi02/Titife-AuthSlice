import { NextRequest, NextResponse } from "next/server";
import { signupSchema } from "@/lib/validation/signup";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/hash";
import { createVerificationCode } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email/send";
import { checkRateLimit, recordRateLimit } from "@/lib/rate-limit/limiter";
import { getTrustedIp } from "@/lib/auth/ip";
import { RATE_LIMITS } from "@/lib/constants";
import { Prisma } from "@prisma/client";

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function POST(request: NextRequest) {
  const ip = getTrustedIp(request);

  const rateCheck = await checkRateLimit(RATE_LIMITS.signup, ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      },
      { status: 400 }
    );
  }

  const { fullName, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });

  // PRD §5.1: same generic response whether verified, unverified, or new
  if (existing?.isVerified) {
    await recordRateLimit(RATE_LIMITS.signup, ip);
    return NextResponse.json({
      ok: true,
      message:
        "If this email can be registered, you'll receive next steps by email.",
    });
  }

  const passwordHash = await hashPassword(password);

  // PRD §7.9: idempotent on email. The citext unique constraint is the backstop
  // against a concurrent double submission; on a unique violation we re-read and
  // reuse the existing row rather than creating a second account. A reused
  // unverified account is left as-is (its profile is not overwritten) and a new
  // verification code is re-issued below.
  let user = existing;
  if (!user) {
    try {
      user = await prisma.user.create({
        data: { email, fullName, passwordHash },
      });
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      user = await prisma.user.findUnique({ where: { email } });
    }
  }

  if (!user || user.isVerified) {
    // Lost a race to a concurrent request (or a just-verified account); never
    // create a second account.
    await recordRateLimit(RATE_LIMITS.signup, ip);
    return NextResponse.json({
      ok: true,
      message:
        "If this email can be registered, you'll receive next steps by email.",
    });
  }

  const code = await createVerificationCode(user.id);

  // PRD §7.3: record the attempt before sending so a failed send still counts.
  await recordRateLimit(RATE_LIMITS.signup, ip);

  await sendEmail({
    to: email,
    subject: "Verify your email address",
    text: code,
  });

  return NextResponse.json({
    ok: true,
    message:
      "If this email can be registered, you'll receive next steps by email.",
  });
}
