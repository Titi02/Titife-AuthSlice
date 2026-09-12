/**
 * PRD §13 Phase 4: Delete expired rate limit entries.
 *
 * Run via: npm run cleanup:rate-limits
 * Or schedule via cron / task scheduler.
 */
import { PrismaClient } from "@prisma/client";
import { RATE_LIMIT_WINDOW_MS } from "../lib/constants";

const prisma = new PrismaClient();

async function main() {
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  const result = await prisma.rateLimitEntry.deleteMany({
    where: {
      createdAt: { lt: cutoff },
    },
  });

  console.log(
    `Deleted ${result.count} expired rate limit entr(ies) created before ${cutoff.toISOString()}.`
  );
}

main()
  .catch((error) => {
    console.error("Cleanup failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
