# AGENTS.md

This file governs how an AI coding agent (running in Antigravity) behaves while building this project. It does not describe features — that is the PRD's job. This file describes constraints: what is already decided, what must never happen, how the codebase must be arranged, and what to do when instructions run out.

If anything in this file conflicts with something you infer, assume, or would prefer to do differently: this file wins.

---

## 1. What is this project

This is a standalone, self-hosted authentication module — not a full product. It provides six screens: Create Account, Sign In, Forgot Password, Reset Password, Email Verification, and a placeholder Dashboard. Its job ends the moment a verified, signed-in user reaches the dashboard. Nothing beyond auth is in scope.

- **Audience:** internal engineering reuse. This module is meant to be dropped into future projects as a secure starting point for authentication, not shipped as a standalone commercial product.
- **Version being built:** the complete v1 scope as defined in the source PRD. There is no v2, no later phase, and no "next milestone" beyond what the PRD's Phase 5 (Hardening and testing) covers.
- **Source of truth:** `auth-system-prd-v2.docx` (Revision 2). Every functional requirement, every data model field, every numeric limit, and every screen behavior comes from that document. This file (AGENTS.md) does not restate those requirements — it tells you how to behave while implementing them. When you need to know *what* to build, go back to the PRD. When you need to know *how* to build it, this file is authoritative.
- If a feature request, a task description, or your own judgment ever points somewhere the PRD does not, treat that as out of scope by default. See Question 7.

---

## 2. What is locked

Everything below is a decision the team has already made. Do not swap it, upgrade it, "improve" it, add an alternative alongside it, or reach for a different library that does the same job. Locked means locked, not "locked unless you find something better."

**Stack**
- Next.js, App Router only. Never use the Pages Router, not even for one route.
- TypeScript everywhere. Never use `any` in shared validation schemas or in any data-access code (Prisma queries, session lookups, token handling).
- Prisma as the only ORM. PostgreSQL as the only database.
- All auth endpoints are Route Handlers at `app/api/.../route.ts`. Never build them as Pages API routes, tRPC procedures, or a separate Express server.

**Password handling**
- Argon2id is the only password hashing algorithm. Never use bcrypt, scrypt, MD5, SHA-256, or any general-purpose hash for passwords, even temporarily, even in a test file.

**Validation**
- Zod is the only schema validation library. Every form (signup, sign in, forgot password, reset password, verification code) has exactly one schema, defined once, in a shared location, imported by both the Route Handler and the client form. Never write a second, slightly-different copy of a schema for the client side.

**Rate limiting**
- Rate limit counters live in Postgres, in a `RateLimitEntry` table. Never introduce Redis, an in-memory store, or any external rate-limiting service for this module.

**Sessions**
- Sessions are database-backed, referenced by an opaque, high-entropy token. Never switch to JWTs or any stateless session scheme.
- Only a hashed version of the session token (`sessionTokenHash`) is ever stored. The raw token lives only in the browser cookie and in the incoming request at lookup time.

**Cookies**
- Session cookie attributes are fixed: `httpOnly: true`, `secure: true`, `sameSite: lax`, `path: /`, expiry matching a 30-day sliding window. Never relax any of these attributes, even in local development — use environment-specific config instead of changing the defaults in code.

**Route protection**
- The dashboard route is protected by Next.js middleware running in the **Node.js runtime**, not the Edge runtime, because it needs to query Prisma directly. Never move this check to Edge middleware without first re-evaluating the tradeoff the PRD describes (Section 7.10) — this is not a decision you make unilaterally mid-build.

**Data model**
- The Prisma schema (PRD Section 10) is locked field-for-field: `User`, `Session`, `VerificationCode`, `PasswordResetToken`, `RateLimitEntry`. Do not add convenience fields (no `failedLoginCount`, no `lockedUntil` — these were deliberately removed in Revision 2 because they duplicated the rate limiter). Do not remove fields. Do not rename fields without updating every reference across the codebase in the same change.
- `email` on `User` uses Postgres's `citext` type via the `postgresqlExtensions` preview feature. Never fall back to a plain `String @unique` with app-side `.toLowerCase()` as the only protection — that was the exact bug this schema was revised to fix.

**Distribution model**
- This module is a cloneable starter repository (a git template), not an npm package. Never structure config, environment variables, or the Prisma schema as if they need to support being installed into multiple projects from one shared package. Keep everything project-local.

**Scope lock (non-goals)**
- No landing page, no marketing page, no social sign-in, no two-factor authentication, no profile editing, no account settings, no multi-tenant or multi-role support, no password strength meter beyond functional pass/fail validation. If you find yourself writing any of these, stop — you have drifted outside the PRD.
- The dashboard renders exactly two things: the signed-in user's name and a sign out button. Nothing else. No placeholder widgets, no "coming soon" sections, no nav bar.

---

## 3. What must never happen

Every rule below protects the business, the user, or the integrity of the system. Breaking any rule on this list means the task has failed, even if the code compiles, the feature demos correctly, and all visible tests pass. "It works" is not the bar. Section references point back to the PRD.

1. **Never let signup or forgot-password reveal whether an email is registered.** Both endpoints return the same generic response regardless of whether the account exists, is verified, or is unverified. (PRD 5.1, 5.3)
2. **Never create a second account for an email that already has an unverified account.** Re-issue a verification code instead. The unique constraint on `email` is a backstop, not the primary defense — the handler itself must be idempotent. (PRD 5.1, 7.9)
3. **Never leave an unverified account in the database forever.** Unverified accounts must be deleted 24 hours after creation, via a scheduled job, not a manual process. (PRD 5.1, 9, 13 Phase 4)
4. **Never store, log, or transmit a password in plaintext beyond the original HTTPS request body**, and never hash it anywhere except immediately server-side, right before the database write. (PRD 7.1)
5. **Never build a second lockout mechanism for sign-in.** Failed-attempt lockout is enforced entirely by the rate limiter described in Section 7.3. Do not add a `failedLoginCount` field, a lockout timestamp, or any parallel logic — that duplication was already tried and removed for a reason: it drifts out of sync with the rate limiter.
6. **Never trust a client-settable header for IP-based rate limiting.** Read the IP only from the platform's trusted proxy header. A rate limiter that trusts a spoofable header is not a rate limiter. (PRD 7.3)
7. **Never skip invalidating every other session on a successful password reset.** A password reset must delete all existing sessions for that account, not just issue a new one alongside the old ones. (PRD 5.4)
8. **Never store a raw password reset token or a raw session token in the database.** Both are hashed before storage; only the hash is queried against. (PRD 7.4, 7.7)
9. **Never let a reset token or verification code be reusable.** Mark tokens as used in the same transaction as the action they authorize, and check expiry against the database on every attempt — never rely on the UI disabling a button or an input as the actual control. (PRD 7.5, 7.6, 7.7)
10. **Never let "sign out" mean only "clear the cookie."** Sign out must delete the server-side session record. A client-only sign out is explicitly disallowed. (PRD 5.7)
11. **Never let the dashboard route render, even partially, without a valid, non-expired, server-verified session.** No flash of protected content, no client-side-only redirect. (PRD 5.6, 7.10)
12. **Never add analytics, telemetry, or user-behavior tracking of any kind.** Success metrics for this module are measured through manual and automated QA runs, not instrumentation in the product. (PRD 11)
13. **Never write inline, ad hoc validation logic inside a Route Handler.** All validation goes through the shared Zod schema for that form. If the schema doesn't cover a case, fix the schema — don't patch around it in the handler.
14. **Never treat client-side validation as a security boundary.** It exists for UX feedback only. Every Route Handler re-validates independently of what the client claims to have checked.
15. **Never add a feature from the non-goals list (Section 2 above) because it seemed convenient, small, or "basically free" to add while touching related code.**
16. **Never commit, hardcode, or log real secrets, credentials, API keys, or connection strings containing passwords.** All environment-specific values (database passwords, session secrets, API keys) must live in `.env` files, which are gitignored. Only `.env.example` (with placeholder values) is committed. Never paste real credentials into source code, config files, or logs.

---

## 4. How is the work arranged

Follow this structure. Don't invent a parallel structure, don't flatten it, and don't reorganize it mid-project without a clear reason tied to a build failure.

```
/app
  /(auth)
    /signup/page.tsx
    /signin/page.tsx
    /forgot-password/page.tsx
    /reset-password/page.tsx
    /verify-email/page.tsx
  /dashboard
    /page.tsx
  /api
    /auth
      /signup/route.ts
      /signin/route.ts
      /signout/route.ts
      /verify-email/route.ts
      /resend-code/route.ts
      /forgot-password/route.ts
      /reset-password/route.ts
  middleware.ts              # Node.js runtime, dashboard route guard

/lib
  /validation                # one Zod schema per form, imported by both
    signup.ts                # client forms and Route Handlers — no duplicates
    signin.ts
    forgot-password.ts
    reset-password.ts
    verify-email.ts
  /auth
    hash.ts                  # argon2id hashing/verification only
    session.ts                # create/validate/revoke sessions, token hashing
    tokens.ts                 # reset token + verification code generation/hashing
  /rate-limit
    limiter.ts                 # single shared implementation over RateLimitEntry
  /email
    send.ts                   # single abstraction; swap providers here only
  /db
    prisma.ts                 # single Prisma client instance (singleton)

/components
  /forms                      # shared input, label, button, focus-state primitives
  /auth                       # form components specific to each screen

/prisma
  schema.prisma                # matches PRD Section 10 exactly
  /migrations

/jobs
  cleanup-unverified-accounts.ts
  cleanup-expired-sessions.ts
  cleanup-expired-rate-limits.ts
```

Rules about this layout:
- Business logic (hashing, session handling, token generation, rate limiting) lives in `/lib`, never inline inside a Route Handler. Route Handlers parse the request, call `/lib` functions, and shape the response — nothing more.
- Only one Prisma client instance for the whole app. Never instantiate `PrismaClient` inside a route file or a component.
- The three cleanup jobs are separate scripts, not logic bolted onto an existing request handler. They correspond directly to PRD Section 13, Phase 4.
- Build in the PRD's phase order: data layer and hashing first, then API routes, then UI, then route protection and cleanup jobs, then hardening. Don't build Phase 3 UI polish before Phase 1's schema and validation are in place, and don't build a cleanup job before the model it cleans up exists.

---

## 5. How should the code look

- **TypeScript strict mode on.** No `any`, no `@ts-ignore` used to silence a real type error — fix the type instead.
- **Node.js LTS.** Use only APIs and syntax supported by the current active LTS release. No experimental or nightly-only features.
- **Small, single-purpose functions.** A function that hashes a password does not also touch the database. A function that validates a form does not also send an email.
- **No magic numbers.** Rate limit thresholds, expiry windows (15 minutes, 24 hours, 30 days, 60 seconds), and password length bounds are named constants in one place, not inline literals repeated across files.
- **Async/await, not `.then()` chains.** Errors are caught explicitly, not swallowed silently.
- **Naming:** kebab-case for filenames, PascalCase for React components and types, camelCase for variables and functions. Match Prisma model field names exactly when referencing them — don't introduce a second naming convention on top of the schema.
- **No dead code, no commented-out blocks, no leftover `console.log` debugging statements in anything committed.**
- **Comments explain why, not what.** If a rule from Section 3 above shapes a piece of code in a non-obvious way, a one-line comment referencing the PRD section is welcome. Comments that just restate the line below them are not.
- **Imports use path aliases** (e.g. `@/lib/auth/session`), not long relative `../../../` chains.
- **Formatting and linting are enforced, not optional.** Run the linter and formatter before considering any piece of work finished.

---

## 6. What counts as done

Before reporting any task complete, produce a checklist covering everything below. Check off only what is actually true — do not check something off because it seems like it should work.

- [ ] The project builds with zero errors and zero type errors.
- [ ] The relevant PRD functional requirement (cite the section number, e.g. "5.2 Sign In") is fully implemented, not partially.
- [ ] Every applicable rule from Section 3 of this file ("What must never happen") has been checked against the code just written, not just against the feature's happy path.
- [ ] No locked choice from Section 2 was swapped, added-to, or worked around.
- [ ] Validation for any new or touched form goes through the shared Zod schema, used on both client and server, with no duplicate or ad hoc validation.
- [ ] Any new sensitive value (token, code, session identifier) is hashed before storage, if it is the kind of value this PRD requires to be hashed.
- [ ] Any new rate-limited action is registered through the single shared rate-limit implementation in `/lib/rate-limit`, using the exact limits from PRD 7.3 — not a new or approximate number.
- [ ] The folder structure in Section 4 was followed; nothing was placed outside its designated location.
- [ ] Linting and formatting pass with no errors.
- [ ] Nothing from the non-goals list snuck in.

If any box can't be checked, the task is not done — say so plainly and state exactly what's missing, rather than reporting success.

---

## 7. What the agent does when unsure

You will hit gaps. The PRD has open questions it deliberately left open (password complexity policy, email provider choice, session length configurability, multi-device session behavior, and others listed in PRD Section 14). This is expected, not a failure of the PRD.

When you hit a gap:

1. **Do not invent a feature, a screen, a field, or a business rule to fill it.** If the PRD doesn't say it, it is not in scope, even if it would be a small, sensible, "obviously needed" addition.
2. **Do not silently pick the more powerful or more flexible option "to be safe."** A configurable password policy, a settings screen, a token-refresh mechanism — none of these exist because a gap looked convenient to fill.
3. **Prefer the smallest, most literal reading of the PRD's stated defaults.** Where the PRD gives a specific default pending confirmation (for example, the 8-character password minimum in PRD 5.1), implement that exact default rather than guessing at something stronger or weaker.
4. **Never produce a rushed, unstructured, or inconsistent implementation because the instructions ran out.** Slow down instead. A smaller, correctly-scoped piece of working code is always the right answer over a larger piece of guessed-at code. No spaghetti as a stand-in for a decision you're not authorized to make.
5. **Flag it instead of resolving it.** State plainly what's unclear, point to the relevant PRD section (or note that it's absent), and stop at the boundary of what's actually specified. Leave a clearly marked note (e.g. a `// OPEN QUESTION: see PRD 14 — password complexity policy` comment) rather than quietly encoding your own guess as if it were a decision.
6. **If a request from a task or a person conflicts with this file, this file wins**, unless that person is explicitly and knowingly overriding a specific rule — in which case, say out loud which rule is being overridden and why, so it's never a silent departure.

