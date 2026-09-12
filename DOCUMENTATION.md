# 1. What This Is

This is a self-hosted authentication slice built with Next.js, TypeScript, Prisma, and PostgreSQL. It handles account creation, email verification, sign-in, and password reset, ending at a placeholder dashboard. Users, sessions, and codes are all stored in Postgres, with argon2id hashing, Postgres-backed rate limiting, and Gmail email delivery.

It stops at authentication. There is no landing page, social sign-in, two-factor auth, profile settings, or multi-tenancy. The dashboard shows only the user's name and a sign-out button. The job is to hand off a verified, signed-in user to the next product, nothing more.

# 2. How To Run It

1. Install Node.js 20+ (LTS), npm, and PostgreSQL with the `citext` extension. For real email, have a Gmail App Password.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in the values below.
4. Run `npx prisma migrate deploy`, then `npx prisma generate`.
5. Run `npm run dev` and open `http://localhost:3000`.

Environment variables:

- `DATABASE_URL` — Postgres connection string.
- `SMTP_HOST` / `SMTP_PORT` — `smtp.gmail.com` / `465`.
- `SMTP_USER` / `SMTP_PASS` — Gmail address and App Password.
- `SMTP_FROM` — sender address.

Real credentials must never be committed — `.env` is gitignored and only `.env.example` (placeholders) is tracked.

# 3. The Flow, Step By Step

There is one auth page, `app/auth/page.tsx`, that swaps screens client-side. `auth-flow.tsx` holds the current screen in React state. The page reads an optional `?screen` parameter: `signin` starts on Sign In, otherwise Sign Up.

**Create Account.** The user enters name, email, and password on `signup-form.tsx`. It POSTs to `/api/auth/signup`, which validates with the shared Zod schema, checks the rate limit, and creates (or reuses) the account with an argon2id hash. It always returns the same generic message and emails a verification code. The client moves to Email Verification, carrying the email in React state.

**Verify → Dashboard.** The user enters the code on `verify-email-form.tsx`, which POSTs to `/api/auth/verify-email`. That route checks the code and expiry, then atomically consumes it and sets `isVerified`. It creates a session and redirects to `/dashboard`, which renders the name and a sign-out button.

**Sign In → Dashboard.** The user opens `/auth?screen=signin`. `signin-form.tsx` fetches a CSRF token, then POSTs email, password, and CSRF to `/api/auth/signin`. It verifies the password, creates a session, and redirects to `/dashboard`.

**Forgot Password.** The user enters their email on `forgot-password-form.tsx`, POSTing to `/api/auth/forgot-password`. That returns a generic message and, if the account exists, emails a six-digit reset code.

**Reset Code.** The user types the code on `reset-code-form.tsx`, POSTing to `/api/auth/reset-password/verify`, which checks the code hash and expiry.

**Reset Password.** The user sets a new password on `reset-password-form.tsx`, POSTing to `/api/auth/reset-password`. That marks the code used, updates the password hash, and deletes all sessions, forcing re-login. The user then signs in with the new password.

**Sign Out.** The button POSTs to `/api/auth/signout`, which deletes the session row and clears the cookie, then redirects to `/auth?screen=signin`.

**Direct `/dashboard` access.** `proxy.ts` (matcher `/dashboard/:path*`) checks the session and redirects to `/auth` if invalid; the page also re-checks with `validateSession()`.

The email is preserved between screens via React state and is never put in the URL.

# 4. The Data Model

Schema lives in `prisma/schema.prisma`, using the `citext` extension. Five tables.

**User** — one row per account: `email` (`citext`, unique), `fullName`, `passwordHash`, `isVerified` (defaults `false`), timestamps.

**Session** — one row per session: `sessionTokenHash` (unique, SHA-256 of the token), `expiresAt` (30-day window).

**VerificationCode** — holds email codes: `code` (six digits), `expiresAt` (15 min), `usedAt` (nullable; row is deleted on use).

**PasswordResetToken** — holds reset codes: `tokenHash` (unique, hashed), `expiresAt` (15 min), `usedAt` (nullable).

**RateLimitEntry** — rate-limit counters: `identifier`, `action`, `createdAt`.

**Which constraints make an invalid state impossible?** `User.email` is unique on `citext`, so the same email can't exist twice. `sessionTokenHash` and `tokenHash` are unique, so a hash maps to one row. All foreign keys cascade, so deleting a user leaves no orphaned rows. `isVerified` defaults to `false`. Password shape and expiry are enforced in code (Zod and `expiresAt` checks), not by database `CHECK` constraints.

# 5. The Concepts

**Argon2id hashing** — a slow, memory-hard hash so leaked hashes are hard to crack. `lib/auth/hash.ts` uses `argon2.hash(..., { type: argon2.argon2id })`.

**Centralized validation** — one Zod schema per form in `lib/validation`, shared by the route and the client, so the two never drift.

**Client mirrors server** — the client runs the same schema for instant feedback only; the server is the real check.

**Rate limiting** — Postgres counters (`lib/rate-limit/limiter.ts`) cap attempts per window by IP and/or account, per `lib/constants.ts`.

**Sessions** — server-side rows referenced by a 32-byte token; only the SHA-256 hash is stored (`lib/auth/session.ts`).

**Secure cookies** — `httpOnly`, `secure` in production, `sameSite: lax`, `path: /`, 30-day expiry.

**Verification codes** — six digits from CSPRNG output, stored plaintext (hashing six digits adds little), 15-minute expiry, single-use.


**Resend cooldown** — 60 seconds, enforced server-side in `resend-code/route.ts`.

**Password reset codes** — a six-digit code (not a link), stored hashed, 15-minute expiry, single-use via an atomic `updateMany`.

**Email uniqueness** — `citext` makes it case-insensitive in the database, not in the app.

**Signup idempotency** — the same email never creates two accounts; an unverified account is reused and re-issued a code. A `P2002` catch handles the concurrent race.

**Protected routes** — `proxy.ts` plus a server-side `validateSession()` guard the dashboard.

**Accessibility** — every input has a `<label>` and a visible focus ring (`components/forms/input.tsx`).

**Connection pooling** — one Prisma client using `@prisma/adapter-pg` with `max: 10` (`lib/db/prisma.ts`).

**Gmail SMTP** — Nodemailer in `lib/email/send.ts`, isolated so the provider can be swapped.

**Cleanup jobs** — five scripts under `jobs/` delete expired data, run via `npm run cleanup:*`.

# 6. What Went Wrong

**Email uniqueness wasn't in the database.** The schema had a plain unique text column, so uniqueness depended on the app lowercasing every write. I switched to Postgres `citext` so the database enforces it.

**The session token was stored in plaintext.** The 30-day session token — the bigger exposure — was stored raw while the shorter-lived reset token was hashed. Sessions now store only `sessionTokenHash`.

**There were two lockout mechanisms.** `failedLoginCount`/`lockedUntil` fields duplicated the rate limiter and could drift. Both were removed; lockout is now only the `RateLimitEntry` table.

# 7. What This Slice Does Not Handle

**At scale:** the Postgres rate limiter adds write load (Redis candidate); Argon2 uses default costs that need benchmarking; IP limits trust `x-forwarded-for`, so a trusted proxy must set it; sessions have no per-user cap; verification codes are stored plaintext.

**Before real users:** pick a real email provider, benchmark Argon2, schedule the cleanup jobs, and add an automated test suite (none exists yet).

**Intentionally out of scope:** no landing page, social sign-in, 2FA, profile settings, multi-tenancy, password-strength meter, or analytics.

**Left out for time:** automated tests and a committed cron config for the cleanup jobs.

# 8. If I Built This Again

I'd lock the security invariants into the data model before writing any UI — hash the session token at rest, enforce email uniqueness with `citext`, and keep lockout to one mechanism. Most of the rework here came from a weak default shipping first and being corrected later, and each fix touched the schema plus every code path using it.
