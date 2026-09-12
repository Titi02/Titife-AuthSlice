import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashSessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from "@/lib/constants";

// PRD §7.10: Proxy (the Next.js 16 rename of middleware) runs in the Node.js
// runtime by default — it queries Prisma directly; no Edge runtime involved.
export function proxy(request: NextRequest) {
  return handle(request);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};

async function handle(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { sessionTokenHash: tokenHash },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    const response = NextResponse.redirect(new URL("/auth", request.url));
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  // PRD §5.7: sliding window — extend expiry on every authenticated request
  await prisma.session.update({
    where: { id: session.id },
    data: {
      expiresAt: new Date(Date.now() + SESSION_DURATION_SECONDS * 1000),
    },
  });

  return NextResponse.next();
}