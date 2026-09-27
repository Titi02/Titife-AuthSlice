"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/forms/input";
import { Button } from "@/components/forms/button";
import { FormError } from "@/components/forms/form-error";
import { signupSchema } from "@/lib/validation/signup";
import { PASSWORD_MIN_LENGTH, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

const FULL_NAME_REGEX = /^[A-Za-z ]*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_LETTER_REGEX = /[a-zA-Z]/;
const PASSWORD_NUMBER_REGEX = /[0-9]/;
const PASSWORD_SPECIAL_CHARS = "#@>^";
const PASSWORD_SPECIAL_CHAR_REGEX = /[#@>^]/;

const PASSWORD_REQUIREMENTS: Array<{
  label: string;
  test: (password: string) => boolean;
}> = [
  {
    label: "Minimum Of 8 Characters",
    test: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    label: "At least one letter",
    test: (password) => PASSWORD_LETTER_REGEX.test(password),
  },
  {
    label: "At least one number",
    test: (password) => PASSWORD_NUMBER_REGEX.test(password),
  },
  {
    label: `At least one special character (${PASSWORD_SPECIAL_CHARS})`,
    test: (password) => PASSWORD_SPECIAL_CHAR_REGEX.test(password),
  },
];

const SUCCESS_VISIBLE_MS = 0;
const SUCCESS_FADE_MS = 300;

interface FieldValues {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

type FieldErrors = Partial<Record<keyof FieldValues, string>>;

const LABELS: Record<keyof FieldValues, string> = {
  fullName: "Full name",
  email: "Email",
  password: "Password",
  confirmPassword: "Confirm password",
};

function validateField(
  field: keyof FieldValues,
  value: string,
): string | undefined {
  if (!value) {
    return `${LABELS[field]} Field Cannot Be Empty`;
  }
  if (field === "fullName" && !FULL_NAME_REGEX.test(value)) {
    return "Full Name Must Use Letters";
  }
  if (field === "email" && !EMAIL_REGEX.test(value)) {
    return "Enter A Valid Email Address";
  }
  return undefined;
}

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

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

interface SignupFormProps {
  onVerifyEmail: (email: string) => void;
}

export function SignupForm({ onVerifyEmail }: SignupFormProps) {
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [values, setValues] = useState<FieldValues>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordActive, setPasswordActive] = useState(false);
  const [hiddenLabels, setHiddenLabels] = useState<Set<string>>(new Set());
  const [fadingLabels, setFadingLabels] = useState<Set<string>>(new Set());
  const [rateLimited, setRateLimited] = useState(false);
  const fadeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const trimmedFullName = values.fullName.trim();
  const trimmedEmail = values.email.trim();

  const isFormValid =
    trimmedFullName.length > 0 &&
    FULL_NAME_REGEX.test(trimmedFullName) &&
    EMAIL_REGEX.test(trimmedEmail) &&
    values.password.length >= PASSWORD_MIN_LENGTH &&
    PASSWORD_LETTER_REGEX.test(values.password) &&
    PASSWORD_NUMBER_REGEX.test(values.password) &&
    PASSWORD_SPECIAL_CHAR_REGEX.test(values.password) &&
    values.confirmPassword === values.password;

  const passwordRequirements = useMemo(
    () =>
      PASSWORD_REQUIREMENTS.map(({ label, test }) => ({
        label,
        met: test(values.password),
      })),
    [values.password],
  );

  const allRequirementsMet = passwordRequirements.every(
    (requirement) => requirement.met,
  );

  const visibleRequirements = passwordRequirements.filter(
    (requirement) => !hiddenLabels.has(requirement.label),
  );

  function scheduleFade(label: string) {
    const outer = setTimeout(() => {
      setFadingLabels((prev) => new Set(prev).add(label));
      const inner = setTimeout(() => {
        setHiddenLabels((prev) => new Set(prev).add(label));
        setFadingLabels((prev) => {
          const next = new Set(prev);
          next.delete(label);
          return next;
        });
        if (fadeTimersRef.current.get(label) === inner) {
          fadeTimersRef.current.delete(label);
        }
      }, SUCCESS_FADE_MS);
      fadeTimersRef.current.set(label, inner);
    }, SUCCESS_VISIBLE_MS);
    fadeTimersRef.current.set(label, outer);
  }

  function handlePasswordChange(value: string) {
    setPasswordActive(true);
    setValues((prev) => ({ ...prev, password: value }));

    for (const { label, test } of PASSWORD_REQUIREMENTS) {
      if (test(value)) {
        if (hiddenLabels.has(label)) continue;
        if (fadeTimersRef.current.has(label)) continue;
        scheduleFade(label);
      } else {
        setHiddenLabels((prev) => {
          if (!prev.has(label)) return prev;
          const next = new Set(prev);
          next.delete(label);
          return next;
        });
        setFadingLabels((prev) => {
          if (!prev.has(label)) return prev;
          const next = new Set(prev);
          next.delete(label);
          return next;
        });
        const timer = fadeTimersRef.current.get(label);
        if (timer) {
          clearTimeout(timer);
          fadeTimersRef.current.delete(label);
        }
      }
    }
  }

  useEffect(() => {
    const timers = fadeTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  // PRD §7.3: after a 429 the client stays blocked for the full server-side
  // window, matching the rate limiter's 15-minute window.
  useEffect(() => {
    if (!rateLimited) return;
    const timer = setTimeout(() => setRateLimited(false), RATE_LIMIT_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [rateLimited]);

  function handleFieldChange(field: keyof FieldValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function handleFieldBlur(field: keyof FieldValues) {
    const trimmed =
      field === "fullName" || field === "email"
        ? values[field].trim()
        : values[field];
    setValues((prev) => ({ ...prev, [field]: trimmed }));
    setFieldErrors((prev) => ({
      ...prev,
      [field]: validateField(field, trimmed),
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setFieldErrors({});

    const data = {
      fullName: trimmedFullName,
      email: trimmedEmail,
      password: values.password,
      confirmPassword: values.confirmPassword,
    };

    const parsed = signupSchema.safeParse(data);
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FieldValues | undefined;
        if (field && !errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (res.status === 429) {
        setError("Too many attempts. Please try again later.");
        setRateLimited(true);
        return;
      }

      if (json.ok) {
        onVerifyEmail(data.email);
      } else {
        setError(json.message);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const passwordTrailing =
    values.password.length > 0 ? (
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setShowPassword((prev) => !prev)}
        aria-label={showPassword ? "Hide password" : "Show password"}
        className="cursor-pointer text-[var(--color-on-surface-variant-c)] hover:text-[var(--color-on-surface-color)]"
      >
        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    ) : undefined;

  const confirmPasswordTrailing =
    values.confirmPassword.length > 0 ? (
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setShowConfirmPassword((prev) => !prev)}
        aria-label={
          showConfirmPassword ? "Hide confirm password" : "Show confirm password"
        }
        className="cursor-pointer text-[var(--color-on-surface-variant-c)] hover:text-[var(--color-on-surface-color)]"
      >
        {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    ) : undefined;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <FormError message={error} />
      <Input
        label="Full name"
        name="fullName"
        type="text"
        required
        autoComplete="name"
        value={values.fullName}
        onChange={(e) => handleFieldChange("fullName", e.target.value)}
        onBlur={() => handleFieldBlur("fullName")}
        error={fieldErrors.fullName}
      />
      <Input
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="email"
        value={values.email}
        onChange={(e) => handleFieldChange("email", e.target.value)}
        onBlur={() => handleFieldBlur("email")}
        error={fieldErrors.email}
      />
      <div>
        <Input
          label="Password"
          name="password"
          type={showPassword ? "text" : "password"}
          required
          autoComplete="new-password"
          value={values.password}
          onChange={(e) => handlePasswordChange(e.target.value)}
          onFocus={() => setPasswordActive(true)}
          onBlur={() => {
            setPasswordActive(false);
            handleFieldBlur("password");
          }}
          error={fieldErrors.password}
          trailing={passwordTrailing}
        />
        {passwordActive &&
          !allRequirementsMet &&
          visibleRequirements.length > 0 && (
            <ul className="mt-2 space-y-1" aria-live="polite">
              {visibleRequirements.map((requirement) => (
                <li
                  key={requirement.label}
                  className={`flex items-center gap-1.5 text-sm transition-opacity duration-300 ${
                    fadingLabels.has(requirement.label)
                      ? "opacity-0"
                      : "opacity-100"
                  }`}
                  style={{
                    color: requirement.met
                      ? "var(--color-positive)"
                      : "var(--color-error-color)",
                  }}
                >
                  {requirement.met ? <CheckIcon /> : <XIcon />}
                  <span>{requirement.label}</span>
                </li>
              ))}
            </ul>
          )}
      </div>
      <Input
        label="Confirm password"
        name="confirmPassword"
        type={showConfirmPassword ? "text" : "password"}
        required
        autoComplete="new-password"
        value={values.confirmPassword}
        onChange={(e) => handleFieldChange("confirmPassword", e.target.value)}
        onBlur={() => handleFieldBlur("confirmPassword")}
        error={fieldErrors.confirmPassword}
        trailing={confirmPasswordTrailing}
      />
      <Button
        type="submit"
        loading={loading}
        disabled={!isFormValid || rateLimited}
      >
        Create Account
      </Button>
    </form>
  );
}