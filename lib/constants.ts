export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const FULL_NAME_MIN_LENGTH = 1;
export const FULL_NAME_MAX_LENGTH = 100;

export const EMAIL_MAX_LENGTH = 254;

export const SESSION_COOKIE_NAME = "session";
export const CSRF_COOKIE_NAME = "csrf";
export const SESSION_DURATION_DAYS = 30;
export const SESSION_DURATION_SECONDS = SESSION_DURATION_DAYS * 24 * 60 * 60;

// PRD §7.4: cookies are `secure` only in production; browsers refuse to set
// `secure` cookies over plain HTTP, so development (http://localhost) uses the
// same attribute set with the secure flag off via environment, never by
// relaxing the production code path.
export const COOKIE_SECURE = process.env.NODE_ENV === "production";

export const VERIFICATION_CODE_EXPIRY_MINUTES = 15;
export const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;
export const VERIFICATION_CODE_LENGTH = 6;

export const RESET_TOKEN_EXPIRY_MINUTES = 15;

export const UNVERIFIED_ACCOUNT_TTL_HOURS = 24;

export const RATE_LIMIT_WINDOW_MINUTES = 15;
export const RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;

export const RATE_LIMITS = {
  signup: {
    action: "signup",
    limit: 5,
    windowMs: RATE_LIMIT_WINDOW_MS,
    scope: "ip" as const,
  },
  signin: {
    action: "signin",
    limit: 5,
    windowMs: RATE_LIMIT_WINDOW_MS,
    scope: "ipAndAccount" as const,
  },
  forgotPassword: {
    action: "forgotPassword",
    limit: 5,
    windowMs: RATE_LIMIT_WINDOW_MS,
    scope: "ipAndAccount" as const,
  },
  verificationResend: {
    action: "verificationResend",
    limit: 5,
    windowMs: RATE_LIMIT_WINDOW_MS,
    scope: "ipAndAccount" as const,
  },
  verificationSubmit: {
    action: "verificationSubmit",
    limit: 10,
    windowMs: RATE_LIMIT_WINDOW_MS,
    scope: "account" as const,
  },
  resetCodeSubmit: {
    action: "resetCodeSubmit",
    limit: 10,
    windowMs: RATE_LIMIT_WINDOW_MS,
    scope: "account" as const,
  },
} as const;
