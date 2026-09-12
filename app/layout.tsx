import type { Metadata } from "next";
import type React from "react";
import "./globals.css";
import "../tokens.css";

export const metadata: Metadata = {
  title: "Auth Module",
  description: "Standalone authentication module",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--color-background)] text-[var(--color-on-background)]">
        {children}
      </body>
    </html>
  );
}
