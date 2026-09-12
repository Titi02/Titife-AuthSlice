import { validateSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function DashboardPage() {
  const session = await validateSession();

  if (!session) {
    redirect("/auth");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { fullName: true },
  });

  if (!user) {
    redirect("/auth");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-lg">{user.fullName}</p>
        <SignOutButton />
      </div>
    </div>
  );
}
