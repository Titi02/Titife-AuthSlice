import { randomBytes, timingSafeEqual } from "crypto";

export function generateCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export function csrfTokensMatch(submitted: string, cookie: string): boolean {
  const a = Buffer.from(submitted);
  const b = Buffer.from(cookie);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}