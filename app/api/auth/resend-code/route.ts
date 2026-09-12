import { NextRequest, NextResponse } from "next/server";
import { resendCodeSchema } from "@/lib/validation/verify-email";
import { prisma } from "@/lib/db/prisma";
import { createVerificationCode } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email/send";
import { checkRateLimit, recordRateLimit } from "@/lib/rate-limit/limiter";
import { getTrustedIp } from "@/lib/auth/ip";
import { RATE_LIMITS, VERIFICATION_RESEND_COOLDOWN_SECONDS } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const ip = getTrustedIp(request);
  const body = await request.json();
  const parsed = resendCodeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({
      ok: true,
      message: "If an account exists for this email, a new code has been sent.",
    });
  }

  const { email } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.isVerified) {
    return NextResponse.json({
      ok: true,
      message: "If an account exists for this email, a new code has been sent.",
    });
  }

  const rateCheck = await checkRateLimit(
    RATE_LIMITS.verificationResend,
    ip,
    user.id
  );
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const mostRecentCode = await prisma.verificationCode.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  if (mostRecentCode) {
    const elapsed =
      (Date.now() - mostRecentCode.createdAt.getTime()) / 1000;
    if (elapsed < VERIFICATION_RESEND_COOLDOWN_SECONDS) {
      const waitSeconds = Math.ceil(VERIFICATION_RESEND_COOLDOWN_SECONDS - elapsed);
      return NextResponse.json(
        {
          ok: false,
          message: `Please wait ${waitSeconds} seconds before resending.`,
        },
        { status: 429 }
      );
    }
  }

  const code = await createVerificationCode(user.id);

  // PRD §7.3: record the attempt before sending so a failed send still counts.
  await recordRateLimit(RATE_LIMITS.verificationResend, ip, user.id);

  await sendEmail({
    to: email,
    subject: "Verify your email address",
    text: code,
  });

  return NextResponse.json({
    ok: true,
    message: "A new verification code has been sent.",
  });
}
