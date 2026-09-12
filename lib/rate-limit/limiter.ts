import { prisma } from "@/lib/db/prisma";

export type RateLimitScope = "ip" | "account" | "ipAndAccount";

interface RateLimitConfig {
  action: string;
  limit: number;
  windowMs: number;
  scope: RateLimitScope;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

async function countEntries(
  identifier: string,
  action: string,
  windowMs: number
): Promise<{ count: number; oldestCreatedAt: Date | null }> {
  const since = new Date(Date.now() - windowMs);

  const [count, oldest] = await Promise.all([
    prisma.rateLimitEntry.count({
      where: { identifier, action, createdAt: { gte: since } },
    }),
    prisma.rateLimitEntry.findFirst({
      where: { identifier, action, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  return { count, oldestCreatedAt: oldest?.createdAt ?? null };
}

export async function checkRateLimit(
  config: RateLimitConfig,
  ip: string,
  userId?: string
): Promise<RateLimitResult> {
  const identifiers: string[] = [];

  if (config.scope === "ip" || config.scope === "ipAndAccount") {
    identifiers.push(ip);
  }
  if (config.scope === "account" || config.scope === "ipAndAccount") {
    if (userId) {
      identifiers.push(userId);
    } else if (config.scope === "account") {
      // Account-scoped check with no account to key on: nothing to count.
      return { allowed: true };
    }
  }

  let minRetryAfterMs = 0;

  for (const identifier of identifiers) {
    const { count, oldestCreatedAt } = await countEntries(
      identifier,
      config.action,
      config.windowMs
    );

    if (count >= config.limit) {
      const retryAfterMs = oldestCreatedAt
        ? config.windowMs - (Date.now() - oldestCreatedAt.getTime())
        : config.windowMs;
      minRetryAfterMs = Math.max(minRetryAfterMs, retryAfterMs);
    }
  }

  if (minRetryAfterMs > 0) {
    return { allowed: false, retryAfterMs: minRetryAfterMs };
  }

  return { allowed: true };
}

export async function recordRateLimit(
  config: RateLimitConfig,
  ip: string,
  userId?: string
): Promise<void> {
  const entries: Array<{ identifier: string; action: string; userId: string | null }> = [];

  if (config.scope === "ip" || config.scope === "ipAndAccount") {
    entries.push({ identifier: ip, action: config.action, userId: null });
  }
  if (config.scope === "account" || config.scope === "ipAndAccount") {
    if (userId) {
      entries.push({ identifier: userId, action: config.action, userId });
    }
  }

  if (entries.length > 0) {
    await prisma.rateLimitEntry.createMany({ data: entries });
  }
}
