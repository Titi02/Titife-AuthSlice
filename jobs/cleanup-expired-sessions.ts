/**
 * PRD §13 Phase 4: Delete expired sessions.
 *
 * Run via: npm run cleanup:sessions
 * Or schedule via cron / task scheduler.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();

  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  });

  console.log(
    `Deleted ${result.count} expired session(s) as of ${now.toISOString()}.`
  );
}

main()
  .catch((error) => {
    console.error("Cleanup failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
