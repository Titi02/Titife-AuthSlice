"use client";

import { useState } from "react";
import { AuthScreen } from "@/components/auth/auth-screen";
import { SigninForm } from "@/components/auth/signin-form";
import { SignupForm } from "@/components/auth/signup-form";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { ResetCodeForm } from "@/components/auth/reset-code-form";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

type AuthScreenName =
  | "signin"
  | "signup"
  | "forgot-password"
  | "reset-code"
  | "reset-password"
  | "verify-email";

interface AuthFlowProps {
  initialScreen?: "signin" | "signup";
}

export function AuthFlow({ initialScreen = "signup" }: AuthFlowProps) {
  const [screen, setScreen] = useState<AuthScreenName>(initialScreen);
  const [verifyEmail, setVerifyEmail] = useState<string>();
  const [resetEmail, setResetEmail] = useState<string>();
  const [resetCode, setResetCode] = useState<string>();
  const [forgotEmail, setForgotEmail] = useState<string>();
  const [notice, setNotice] = useState<string>();

  if (screen === "signup") {
    return (
      <AuthScreen
        title="Create Account"
        footer={{
          preface: "Already have an account?",
          label: "Sign in",
          onClick: () => setScreen("signin"),
        }}
      >
        <SignupForm
          onVerifyEmail={(email) => {
            setVerifyEmail(email);
            setScreen("verify-email");
          }}
        />
      </AuthScreen>
    );
  }

  if (screen === "forgot-password") {
    return (
      <AuthScreen
        title="Forgot Password"
        footer={{ label: "Back to sign in", onClick: () => setScreen("signin") }}
      >
        <p className="text-sm text-center">
          Enter your email address and we&apos;ll send you a password reset code.
        </p>
        <ForgotPasswordForm
          initialEmail={forgotEmail}
          onCodeSent={(email) => {
            setResetEmail(email);
            setResetCode(undefined);
            setScreen("reset-code");
          }}
        />
      </AuthScreen>
    );
  }

  if (screen === "reset-code") {
    if (!resetEmail) {
      return (
        <AuthScreen
          title="Invalid Request"
          footer={{ label: "Back to sign in", onClick: () => setScreen("signin") }}
        >
          <p className="text-center">Please start the password reset again.</p>
        </AuthScreen>
      );
    }
    return (
      <AuthScreen
        title="Enter Reset Code"
        footer={{ label: "Back to sign in", onClick: () => setScreen("signin") }}
      >
        <ResetCodeForm
          email={resetEmail}
          onVerified={(code) => {
            setResetCode(code);
            setScreen("reset-password");
          }}
        />
      </AuthScreen>
    );
  }

  if (screen === "reset-password") {
    if (!resetEmail || !resetCode) {
      return (
        <AuthScreen
          title="Invalid Request"
          footer={{ label: "Back to sign in", onClick: () => setScreen("signin") }}
        >
          <p className="text-center">Please start the password reset again.</p>
        </AuthScreen>
      );
    }
    return (
      <AuthScreen title="Reset Password">
        <ResetPasswordForm
          email={resetEmail}
          code={resetCode}
          onSuccess={() => {
            setResetEmail(undefined);
            setResetCode(undefined);
            setNotice("Password updated");
            setScreen("signin");
          }}
        />
      </AuthScreen>
    );
  }

  if (screen === "verify-email") {
    if (!verifyEmail) {
      return (
        <AuthScreen title="Verify Email">
          <p className="text-center">
            No email address provided. Please sign up again.
          </p>
        </AuthScreen>
      );
    }
    return (
      <AuthScreen title="Verify Email">
        <VerifyEmailForm email={verifyEmail} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Sign In"
      footer={{
        preface: "Don't have an account?",
        label: "Sign up",
        onClick: () => setScreen("signup"),
      }}
    >
      {notice ? (
        <p className="text-sm text-center" style={{ color: "var(--color-positive)" }}>
          {notice}
        </p>
      ) : null}
      <SigninForm
        onForgotPassword={(email) => {
          setForgotEmail(email);
          setScreen("forgot-password");
        }}
      />
    </AuthScreen>
  );
}
