"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/forms/input";
import { Button } from "@/components/forms/button";
import { FormError } from "@/components/forms/form-error";
import { verifyEmailSchema } from "@/lib/validation/verify-email";
import { VERIFICATION_RESEND_COOLDOWN_SECONDS } from "@/lib/constants";

const SNACKBAR_DURATION_MS = 8000;

interface VerifyEmailFormProps {
  email: string;
}

function formatCountdown(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function VerifyEmailForm({ email }: VerifyEmailFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string>();
  const [countdown, setCountdown] = useState(
    VERIFICATION_RESEND_COOLDOWN_SECONDS
  );
  const [snackbarVisible, setSnackbarVisible] = useState(true);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (!snackbarVisible) return;
    const timer = setTimeout(
      () => setSnackbarVisible(false),
      SNACKBAR_DURATION_MS
    );
    return () => clearTimeout(timer);
  }, [snackbarVisible]);

  function restartCountdown() {
    setCountdown(VERIFICATION_RESEND_COOLDOWN_SECONDS);
  }

  function showSnackbar() {
    setSnackbarVisible(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);

    const formData = new FormData(e.currentTarget);
    const data = {
      email,
      code: formData.get("code") as string,
    };

    const parsed = verifyEmailSchema.safeParse(data);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid code");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (json.ok) {
        router.push(json.redirectTo || "/dashboard");
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
    setResendMessage(undefined);
    setError(undefined);
    try {
      const res = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (json.ok) {
        restartCountdown();
        showSnackbar();
      } else {
        setResendMessage(json.message);
      }
    } catch {
      setResendMessage("Something went wrong. Please try again.");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-center">
        A verification code was sent to{" "}
        <span className="font-medium">{email}</span>
      </p>
      {snackbarVisible && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md px-4 py-2 text-center text-sm"
          style={{
            backgroundColor: "var(--color-primary-container)",
            color: "var(--color-on-primary-container)",
          }}
        >
          Verification Code Sent! Check Email
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={error} />
        {resendMessage && (
          <p className="text-sm" style={{ color: "var(--color-primary)" }}>
            {resendMessage}
          </p>
        )}
        <Input
          label="Verification code"
          name="code"
          type="text"
          required
          autoComplete="one-time-code"
        />
        <Button type="submit" loading={loading}>
          Verify Email
        </Button>
      </form>
      <button
        type="button"
        onClick={handleResend}
        disabled={resendLoading || countdown > 0}
        className="w-full cursor-pointer text-center text-sm underline disabled:opacity-50"
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
