/**
 * PRD §13 Phase 4: Delete expired password reset tokens.
 *
 * Run via: npm run cleanup:password-reset-tokens
 * Or schedule via cron / task scheduler.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();

  const result = await prisma.passwordResetToken.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  });

  console.log(
    `Deleted ${result.count} expired password reset token(s) as of ${now.toISOString()}.`
  );
}

main()
  .catch((error) => {
    console.error("Cleanup failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
