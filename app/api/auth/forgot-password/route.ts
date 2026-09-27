import { NextRequest, NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/validation/forgot-password";
import { prisma } from "@/lib/db/prisma";
import { createResetCode } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email/send";
import { checkRateLimit, recordRateLimit } from "@/lib/rate-limit/limiter";
import { getTrustedIp } from "@/lib/auth/ip";
import { RATE_LIMITS } from "@/lib/constants";

const GENERIC_MESSAGE =
  "If an account exists for this email, a reset code has been sent.";

export async function POST(request: NextRequest) {
  const ip = getTrustedIp(request);

  const body = await request.json();
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }

  const { email } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });

  // PRD §5.3: same generic response regardless of email existence
  if (!user || !user.isVerified) {
    const rateCheck = await checkRateLimit(
      RATE_LIMITS.forgotPassword,
      ip,
      user?.id
    );
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { ok: false, message: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
    await recordRateLimit(RATE_LIMITS.forgotPassword, ip, user?.id);
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }

  const rateCheck = await checkRateLimit(RATE_LIMITS.forgotPassword, ip, user.id);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const code = await createResetCode(user.id);

  // PRD §7.3: record the attempt before sending so a failed send still counts.
  await recordRateLimit(RATE_LIMITS.forgotPassword, ip, user.id);

  try {
    await sendEmail({
      to: email,
      subject: "Reset your password",
      text: `Your password reset code is: ${code}\n\nThis code expires in 15 minutes.`,
    });
  } catch (error) {
    // PRD §5.3: an SMTP failure must not 500 or reveal account state; the reset
    // code is already persisted, so the user can retry later.
    console.error("Failed to send reset email:", error);
  }

  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
}
