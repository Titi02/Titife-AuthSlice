# Auth Module

A standalone, self-hosted authentication module built with Next.js (App Router), TypeScript, Prisma, and PostgreSQL. Provides signup, sign-in, email verification, forgot/reset password, and a protected dashboard.

## Prerequisites

- **Node.js** ≥ 20 (LTS)
- **PostgreSQL** with the `citext` extension enabled
- **npm**

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable       | Description                                              |
| -------------- | -------------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string for Prisma                  |
| `SMTP_HOST`    | SMTP server host used by Nodemailer to send verification and reset emails (default `smtp.gmail.com`) |
| `SMTP_PORT`    | SMTP server port (default `465`)                          |
| `SMTP_SECURE`  | `true` for implicit TLS on port 465 (default), `false` for STARTTLS |
| `SMTP_USER`    | SMTP username (full Gmail address)                        |
| `SMTP_PASS`    | SMTP password (Gmail App Password, not the login password) |
| `SMTP_FROM`    | `From` address used on outgoing emails (e.g. `no-reply@example.com`) |

> **Important:** `.env` is gitignored. Only `.env.example` (with placeholders) is committed.

## Database Setup

1. Ensure PostgreSQL is running and the `citext` extension is available.
2. Run migrations to create the schema:

```bash
npx prisma migrate deploy
```

3. Generate the Prisma client:

```bash
npx prisma generate
```

## Running the App

```bash
npm run dev
```

The app runs at `http://localhost:3000` by default.

## Cleanup Jobs

Five standalone cleanup scripts handle expired data (PRD §13, Phase 4). Schedule them via cron or a task scheduler:

```bash
# Delete unverified accounts older than 24 hours
npm run cleanup:unverified-accounts

# Delete expired verification codes
npm run cleanup:verification-codes

# Delete expired password reset tokens
npm run cleanup:password-reset-tokens

# Delete expired sessions
npm run cleanup:sessions

# Delete expired rate limit entries
npm run cleanup:rate-limits
```

Example cron entry (runs all five jobs hourly):

```cron
0 * * * * cd /path/to/app && npm run cleanup:unverified-accounts && npm run cleanup:verification-codes && npm run cleanup:password-reset-tokens && npm run cleanup:sessions && npm run cleanup:rate-limits
```

## Typecheck / Lint / Build

```bash
npx tsc --noEmit        # TypeScript type check
npm run lint             # ESLint
npm run build            # Production build
```

## Project Structure

```
app/
  auth/           # Single auth page (app/auth/page.tsx) that renders signup, signin, forgot-password, reset-password, verify-email via a client-side flow
  dashboard/      # Protected dashboard (session-guarded)
  api/auth/       # Route Handlers for all auth endpoints
lib/
  auth/           # Hashing (argon2id), session management, token generation, IP extraction
  validation/     # Shared Zod schemas (one per form, used client + server)
  rate-limit/     # Rate limiting over RateLimitEntry table in Postgres
  email/          # Email sending abstraction
  db/             # Prisma client singleton
components/
  forms/          # Shared form primitives (Input, Button, FormError)
  auth/           # Auth-specific form components
prisma/           # Schema and migrations
jobs/             # Scheduled cleanup scripts
```
"# Titife-AuthSlice" 
