"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signout", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        router.push(json.redirectTo || "/auth?screen=signin");
      }
    } catch {
      router.push("/auth?screen=signin");
    }
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="w-full cursor-pointer rounded-md border border-[var(--color-outline-color)] bg-[var(--color-surface-cont-lowest)] px-4 py-2 text-sm font-medium text-[var(--color-on-surface-color)] transition-colors hover:bg-[var(--color-surface-cont)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 disabled:opacity-50"
    >
      {loading ? "Signing out..." : "Sign Out"}
    </button>
  );
}
