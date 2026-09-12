import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import {
  VERIFICATION_CODE_EXPIRY_MINUTES,
  VERIFICATION_CODE_LENGTH,
  RESET_TOKEN_EXPIRY_MINUTES,
} from "@/lib/constants";

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

// Derive a 6-digit code from all 32 random bytes so the code carries the full
// entropy of the CSPRNG output while staying short enough to type by hand.
export function generateVerificationCode(): string {
  const bytes = randomBytes(32);
  let value = BigInt(0);
  for (const byte of bytes) {
    value = (value << BigInt(8)) | BigInt(byte);
  }
  const modulus = 10 ** VERIFICATION_CODE_LENGTH;
  return Number(value % BigInt(modulus))
    .toString()
    .padStart(VERIFICATION_CODE_LENGTH, "0");
}

export function generateResetCode(): string {
  return generateVerificationCode();
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createVerificationCode(userId: string): Promise<string> {
  // PRD §7.5/§7.9: any previous code is now unusable, so remove it instead of
  // soft-deleting it. Only the newly issued code should remain.
  await prisma.verificationCode.deleteMany({
    where: { userId },
  });

  const code = generateVerificationCode();
  const expiresAt = new Date(
    Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000
  );

  await prisma.verificationCode.create({
    data: { userId, code, expiresAt },
  });

  return code;
}

export async function createResetCode(userId: string): Promise<string> {
  // A previous code is no longer usable once a new one is issued.
  await prisma.passwordResetToken.deleteMany({
    where: { userId },
  });

  const expiresAt = new Date(
    Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000
  );

  // The reset code is only 6 digits, so two users can occasionally draw the
  // same code; the unique tokenHash constraint surfaces that as P2002. Retry a
  // few times to pick a fresh code.
  for (let attempt = 0; ; attempt++) {
    const code = generateResetCode();
    try {
      await prisma.passwordResetToken.create({
        data: { userId, tokenHash: hashToken(code), expiresAt },
      });
      return code;
    } catch (error) {
      if (!isUniqueConstraintViolation(error) || attempt >= 4) throw error;
    }
  }
}
