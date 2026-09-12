"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/forms/input";
import { Button } from "@/components/forms/button";
import { FormError } from "@/components/forms/form-error";
import { signinSchema } from "@/lib/validation/signin";

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

interface SigninFormProps {
  onForgotPassword: (email: string) => void;
}

export function SigninForm({ onForgotPassword }: SigninFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string>();
  const [unverifiedEmail, setUnverifiedEmail] = useState<string>();
  const [resendMessage, setResendMessage] = useState<string>();
  const [resendLoading, setResendLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/csrf", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          if (json.csrfToken) setCsrfToken(json.csrfToken);
          else setError("Could not initialize security token. Please try again.");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not initialize security token. Please try again.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setUnverifiedEmail(undefined);
    setResendMessage(undefined);

    if (!csrfToken) {
      setError("Security token not ready. Please wait a moment and try again.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      csrfToken,
    };

    const parsed = signinSchema.safeParse(data);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (json.ok) {
        router.push(json.redirectTo || "/dashboard");
      } else if (json.unverified) {
        setUnverifiedEmail(json.email);
        setError(json.message);
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
    if (!unverifiedEmail) return;
    setResendLoading(true);
    setResendMessage(undefined);
    try {
      const res = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unverifiedEmail }),
      });
      const json = await res.json();
      setResendMessage(json.message);
    } catch {
      setResendMessage("Something went wrong. Please try again.");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />
      {resendMessage && (
        <p className="text-sm" style={{ color: "var(--color-primary)" }}>
          {resendMessage}
        </p>
      )}
      <Input
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="Password"
        name="password"
        type={showPassword ? "text" : "password"}
        required
        autoComplete="current-password"
        trailing={
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="cursor-pointer text-[var(--color-on-surface-variant-c)] hover:text-[var(--color-on-surface-color)]"
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        }
      />
      <div className="flex justify-end text-sm">
        <button
          type="button"
          onClick={() => onForgotPassword(email)}
          className="cursor-pointer underline"
          style={{ color: "var(--color-primary)" }}
        >
          Forgot password?
        </button>
      </div>
      <Button type="submit" loading={loading} disabled={!csrfToken}>
        Sign In
      </Button>
      {unverifiedEmail && (
        <button
          type="button"
          onClick={handleResend}
          disabled={resendLoading}
          className="w-full cursor-pointer text-center text-sm underline disabled:opacity-50"
          style={{ color: "var(--color-primary)" }}
        >
          {resendLoading ? "Sending..." : "Resend verification email"}
        </button>
      )}
    </form>
  );
}
