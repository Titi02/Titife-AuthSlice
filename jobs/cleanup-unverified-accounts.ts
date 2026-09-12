/**
 * PRD §13 Phase 4: Delete unverified accounts older than 24 hours.
 *
 * Run via: npm run cleanup:unverified-accounts
 * Or schedule via cron / task scheduler.
 */
import { PrismaClient } from "@prisma/client";
import { UNVERIFIED_ACCOUNT_TTL_HOURS } from "../lib/constants";

const prisma = new PrismaClient();

async function main() {
  const cutoff = new Date(
    Date.now() - UNVERIFIED_ACCOUNT_TTL_HOURS * 60 * 60 * 1000
  );

  const result = await prisma.user.deleteMany({
    where: {
      isVerified: false,
      createdAt: { lt: cutoff },
    },
  });

  console.log(
    `Deleted ${result.count} unverified account(s) created before ${cutoff.toISOString()}.`
  );
}

main()
  .catch((error) => {
    console.error("Cleanup failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
