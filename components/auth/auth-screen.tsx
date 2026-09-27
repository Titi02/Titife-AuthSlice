"use client";

import type { ReactNode } from "react";

interface AuthScreenFooter {
  preface?: string;
  label: string;
  onClick: () => void;
}

interface AuthScreenProps {
  title: string;
  titleClassName?: string;
  subtitle?: string;
  footer?: AuthScreenFooter;
  children?: ReactNode;
}

export function AuthScreen({
  title,
  titleClassName,
  subtitle,
  footer,
  children,
}: AuthScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2">
          <h1
            className={`text-2xl font-semibold text-center${titleClassName ? ` ${titleClassName}` : ""}`}
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              className="text-sm text-center"
              style={{ color: "var(--color-on-surface-variant-c)" }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {children}
        {footer ? (
          <p className="text-center text-sm">
            {footer.preface ? `${footer.preface} ` : null}
            <button
              type="button"
              onClick={footer.onClick}
              className="cursor-pointer underline"
              style={{ color: "var(--color-primary)" }}
            >
              {footer.label}
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
