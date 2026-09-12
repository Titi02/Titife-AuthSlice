"use client";

import { useId, type ReactNode } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  trailing?: ReactNode;
}

export function Input({
  label,
  error,
  id: propId,
  trailing,
  className,
  ...props
}: InputProps) {
  const autoId = useId();
  const id = propId ?? autoId;

  const baseClassName =
    "w-full rounded-md border bg-[var(--color-surface-cont-lowest)] px-3 py-2 text-sm text-[var(--color-on-surface-color)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]";
  const borderClassName = error
    ? "border-[var(--color-error-color)]"
    : "border-[var(--color-outline-varaint-color)]";

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className={`${baseClassName} ${borderClassName} ${
            trailing ? "pr-10" : ""
          } ${className ?? ""}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
        {trailing && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {trailing}
          </div>
        )}
      </div>
      {error && (
        <p
          id={`${id}-error`}
          className="mt-1 text-sm"
          style={{ color: "var(--color-error-color)" }}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
