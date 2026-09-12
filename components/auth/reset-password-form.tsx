"use client";

import { useState } from "react";
import { Input } from "@/components/forms/input";
import { Button } from "@/components/forms/button";
import { FormError } from "@/components/forms/form-error";
import { resetPasswordSchema } from "@/lib/validation/reset-password";

interface ResetPasswordFormProps {
  email: string;
  code: string;
  onSuccess: () => void;
}

export function ResetPasswordForm({
  email,
  code,
  onSuccess,
}: ResetPasswordFormProps) {
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);

    const formData = new FormData(e.currentTarget);
    const data = {
      email,
      code,
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };

    const parsed = resetPasswordSchema.safeParse(data);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (json.ok) {
        onSuccess();
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
        label="New password"
        name="password"
        type="password"
        required
        autoComplete="new-password"
      />
      <Input
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        required
        autoComplete="new-password"
      />
      <Button type="submit" loading={loading}>
        Reset Password
      </Button>
    </form>
  );
}
