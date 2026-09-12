import { type NextRequest } from "next/server";

/**
 * PRD §7.3: Read IP only from the platform's trusted proxy header.
 * x-forwarded-for first value is the original client when behind a trusted proxy.
 * Falls back to 127.0.0.1 for local dev with no proxy.
 */
export function getTrustedIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  return "127.0.0.1";
}
