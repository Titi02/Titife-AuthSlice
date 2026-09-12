"use client";

import { useState } from "react";
import { Input } from "@/components/forms/input";
import { Button } from "@/components/forms/button";
import { FormError } from "@/components/forms/form-error";
import { forgotPasswordSchema } from "@/lib/validation/forgot-password";

interface ForgotPasswordFormProps {
  onCodeSent: (email: string) => void;
  initialEmail?: string;
}

export function ForgotPasswordForm({
  onCodeSent,
  initialEmail,
}: ForgotPasswordFormProps) {
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);

    const formData = new FormData(e.currentTarget);
    const data = { email: formData.get("email") as string };

    const parsed = forgotPasswordSchema.safeParse(data);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (json.ok) {
        onCodeSent(data.email);
      } else {
        setError(json.message);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />
      <Input
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="email"
        defaultValue={initialEmail}
      />
      <Button type="submit" loading={loading}>
        Send Password Code
      </Button>
    </form>
  );
}
