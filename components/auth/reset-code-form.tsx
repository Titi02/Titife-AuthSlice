"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/forms/input";
import { Button } from "@/components/forms/button";
import { FormError } from "@/components/forms/form-error";
import { resetCodeSchema } from "@/lib/validation/reset-code";
import { VERIFICATION_RESEND_COOLDOWN_SECONDS } from "@/lib/constants";

interface ResetCodeFormProps {
  email: string;
  onVerified: (code: string) => void;
}

function formatCountdown(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function ResetCodeForm({ email, onVerified }: ResetCodeFormProps) {
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(
    VERIFICATION_RESEND_COOLDOWN_SECONDS
  );

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);

    const formData = new FormData(e.currentTarget);
    const data = {
      email,
      code: formData.get("code") as string,
    };

    const parsed = resetCodeSchema.safeParse(data);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid code");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (json.ok) {
        onVerified(data.code);
      } else {
        setError(json.message);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendLoading(true);
    setError(undefined);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();

      if (json.ok) {
        setCountdown(VERIFICATION_RESEND_COOLDOWN_SECONDS);
      } else {
        setError(json.message);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-center">
        A reset code was sent to <span className="font-medium">{email}</span>
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={error} />
        <Input
          label="Reset code"
          name="code"
          type="text"
          required
          autoComplete="one-time-code"
        />
        <Button type="submit" loading={loading}>
          Verify Code
        </Button>
      </form>
      <button
        type="button"
        onClick={handleResend}
        disabled={resendLoading || countdown > 0}
        className="w-full text-center text-sm underline disabled:opacity-50"
        style={{ color: "var(--color-primary)" }}
      >
        {resendLoading
          ? "Sending..."
          : countdown > 0
            ? `Resend code in ${formatCountdown(countdown)}`
            : "Resend code"}
      </button>
    </div>
  );
}
