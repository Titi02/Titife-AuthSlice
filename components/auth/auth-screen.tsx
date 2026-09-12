"use client";

import type { ReactNode } from "react";

interface AuthScreenFooter {
  preface?: string;
  label: string;
  onClick: () => void;
}

interface AuthScreenProps {
  title: string;
  footer?: AuthScreenFooter;
  children: ReactNode;
}

export function AuthScreen({ title, footer, children }: AuthScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-semibold text-center">{title}</h1>
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
