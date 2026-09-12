**PRD: Standalone Authentication System**

*Revision 2 — updated after structured PRD review*

# 1\. Product Summary

This is a self-contained authentication module built with Next.js, TypeScript, Prisma, and PostgreSQL. It provides account creation, sign in, email verification, password reset, and a protected placeholder dashboard. It has no landing page, no marketing content, and no product features beyond auth. It exists to be dropped into other projects as a working, secure starting point for authentication, so every future app does not have to rebuild this layer from scratch.

**Distribution model:** this module is intended to be used as a cloneable starter repository (git template), not published as an npm package. Environment variables and the Prisma schema are project-local, not abstracted for multi-project installs.

*FIX APPLIED: Added the distribution model statement. The original PRD implied reusability without ever defining a mechanism, which left config and schema decisions undefined.*

# 2\. Problem Statement

Every new product needs authentication, and most teams either rebuild it from scratch or bolt on a heavy third-party auth provider before they know if they need one. Rebuilding from scratch is slow and error-prone, especially around password hashing, session handling, and validation. Reaching for a full auth provider early adds cost and vendor lock-in before the product has users. This module solves the middle case: a correct, minimal, self-hosted auth system that can be reused as a foundation.

# 3\. Goals and Non-Goals

## Goals

* Let a new user create an account, verify their email, and reach a protected dashboard.

* Let a returning user sign in with existing credentials.

* Let a user recover access if they forget their password.

* Enforce session-based access control on the dashboard route.

* Meet all 11 mandatory engineering requirements listed in this document, with no exceptions.

## Non-Goals

* No landing page or marketing page.

* No dashboard functionality beyond displaying the user's name and a sign out button.

* No profile editing, account settings, or account deletion.

* No social sign-in (Google, GitHub, etc).

* No two-factor authentication.

* No multi-tenant or multi-role support.

* No password strength meter or advanced UX polish beyond functional validation feedback.

*FIX APPLIED: Password complexity is intentionally not asserted as a locked decision here. It is tracked as an open question in Section 14, since the earlier draft buried a weak default (8 characters, one letter, one number) inside an assumption where it risked shipping unreviewed.*

# 4\. User Personas

**End User:** the person completing signup, sign-in, email verification, or password reset through the UI. They expect standard behavior: clear errors, a working password reset flow, no unexpected lockouts, and no dead ends if they mistype something recoverable.

This module has no external business stakeholder persona. The intended reuse of this module by other engineering teams is a business consideration, not a user persona, and is addressed in the Business Model section.

*FIX APPLIED: The original draft named a 'Developer-Consumer' as the primary persona but never measured their experience anywhere in the document, and described the actual end user with no real detail. Replaced both with a single, real, measurable persona.*

# 5\. Functional Requirements

## 5.1 Create Account

* Fields: full name, email, password, confirm password.

* Full name: required, 1 to 100 characters.

* Email: required, valid email format, max 254 characters, stored and checked case-insensitively at the database level (see Section 10).

* Password: required. Current default is minimum 8 characters, at least one letter and one number, maximum 128 characters. This default is pending confirmation — see Section 14\.

* Confirm password: must match the password field exactly, checked client-side and server-side.

* On submit: client-side schema validation runs first for immediate feedback, then the same schema runs server-side before any database write.

* On success: account is created in an unverified state, a verification code is generated and “emailed,” and the user is routed to the Email Verification screen.

* If the email already exists, verified or unverified: return the same generic message used at signup for every outcome, such as “if this email can be registered, you'll receive next steps by email,” and do not confirm existence directly in the response.

* Behind that generic response: if the account is unverified, issue a new verification code and invalidate the old one. If the account is verified, do nothing and send no email. Either way, no second account row is created for that email.

* Unverified accounts are automatically deleted if not verified within 24 hours of creation, freeing the email address for a genuine future signup.

* Idempotency mechanism: the create-account handler treats the email as the natural idempotency key. A unique database constraint on email is the final backstop against race conditions from concurrent double submissions.

* Rate limited: see Section 7.3.

*FIX APPLIED: Closed the account-enumeration contradiction between signup and forgot-password by making signup's response equally generic, and added a 24-hour TTL on unverified accounts so abandoned signups don't permanently occupy a real person's email address.*

## 5.2 Sign In

* Fields: email, password.

* Both fields required. Client-side validation checks presence and email format only; it does not attempt to validate password correctness client-side.

* On submit: server checks credentials against the stored hash.

* If the account does not exist, or the password is wrong: return the same generic “invalid email or password” message in both cases, to avoid revealing which accounts exist.

* If the account exists but is unverified: return a distinct message telling the user to verify their email, with a link or button to resend the verification code.

* If the account is temporarily blocked due to repeated failed attempts: return a message stating the account is temporarily locked and roughly when it will unlock. This block is enforced entirely through the sign-in rate limit described in Section 7.3 — there is no separate account-level lockout field or mechanism.

* On success: create a new session record, set the session cookie, and redirect to the dashboard.

* Rate limited: see Section 7.3.

*FIX APPLIED: Removed the separate failedLoginCount/lockedUntil mechanism, which duplicated and could drift out of sync with the rate limiter. Sign-in lockout is now enforced by exactly one mechanism.*

## 5.3 Forgot Password (request form)

* Field: email.

* On submit: regardless of whether the email exists in the system, return the same generic message: “If an account exists for this email, a reset link has been sent.”

* If the email does exist and is verified: generate a single-use, time-limited reset token, store it hashed in the database, and “email” a link containing the raw token.

* If the email exists but is unverified: do not send a reset link. An unverified account has no confirmed password recovery path; direct the flow toward email verification instead if the user reaches out through support.

* Rate limited: see Section 7.3.

## 5.4 Reset Password (form reached from emailed link)

* The link contains the raw reset token as a URL parameter.

* On page load: the token is validated server-side before the form is usable. Validation checks: a matching hashed token exists, has not been used, and has not expired.

* If invalid, used, or expired: show a generic “this link is invalid or has expired” message, with a link back to the Forgot Password screen. Do not distinguish between “expired” and “already used” in the message.

* If valid: show fields for new password and confirm password, using the same password schema as Create Account.

* On submit: validate the new password against the schema, update the stored password hash, mark the token as used, and invalidate all other outstanding reset tokens for that account.

* After a successful reset: all existing sessions for that account are deleted, forcing re-authentication everywhere, so a stolen session cannot outlive a password reset.

* Redirect to Sign In with a success message.

## 5.5 Email Verification

* Fields: 6-digit numeric code entry, resend control.

* The code is generated at signup, stored in the database (not just in the session or client), and expires 15 minutes after issue.

* On submit: server checks the code against the stored value for that account, checks it has not expired, and checks it has not already been used.

* If correct and valid: mark the account as verified, invalidate the code, create a session, and redirect to the dashboard.

* If incorrect: show an inline error, do not reveal whether the code was wrong versus expired versus already used, beyond a generic “invalid or expired code” message.

* Resend control: clicking resend generates a new code, invalidates the previous one, and restarts the 60-second cooldown. The cooldown is enforced server-side; the button being disabled in the UI is a convenience, not the actual control.

* Code submission attempts are rate limited separately from resend: see Section 7.3.

## 5.6 Placeholder Dashboard

* Displays exactly two things: the signed-in user's full name, and a sign out button.

* No other content, navigation, or functionality.

* Protected route: unreachable without a valid, non-expired session.

## 5.7 Session and Sign Out Behavior

* A signed-out user requesting the dashboard URL directly is redirected to Sign In. The original destination is not preserved for redirect-back, since there is nothing else to reach.

* Sign out deletes the session record from the database and clears the session cookie from the browser. A sign-out action that only cleared the cookie without deleting the server-side record does not count as ending the session properly, and is explicitly disallowed.

* Sessions expire automatically after a fixed period of inactivity, using a 30-day sliding expiration window: each authenticated request extends the expiry by 30 days from that point.

# 6\. AI Processing Pipeline

Not applicable. This product has no AI component. No model calls, no inference, no generated content anywhere in the system.

# 7\. Technical Requirements

## 7.1 Password Hashing

* Algorithm: argon2id.

* Passwords are never stored, logged, or transmitted in plaintext beyond the initial HTTPS request body.

* Hashing happens server-side only, immediately before the database write, using argon2id with production-appropriate cost parameters (memory, iterations, parallelism tuned for the deployment environment).

## 7.2 Validation

* All input validation is defined as schemas (Zod), one schema per form: signup, sign in, forgot password, reset password, verification code.

* Each schema is defined once, in a shared location, and imported by both the API route handler (server-side enforcement) and the corresponding React form (client-side feedback).

* No handler contains ad hoc, inline validation logic outside the schema.

* Server-side validation is the source of truth. Client-side validation is a UX convenience only and is never trusted for security decisions.

## 7.3 Rate Limiting

| Action | Limit | Window | Scope |
| :---- | :---- | :---- | :---- |
| Sign up | 5 attempts | 15 minutes | per IP |
| Sign in | 5 attempts | 15 minutes | per IP and per account |
| Forgot password request | 5 attempts | 15 minutes | per IP and per account |
| Verification code resend | 5 attempts | 15 minutes | per IP and per account |
| Verification code submission | 10 attempts | 15 minutes | per account |

 

* Sign-in lockout is a direct consequence of this table, not a separate mechanism: 5 failed sign-in attempts in 15 minutes on one account blocks further attempts on that account until the window clears. There is no separate account-level lockout field.

* Implementation: rate limit counters are stored in a Postgres table (RateLimitEntry) keyed by identifier and action type, with a timestamp window. A database-backed store was chosen over Redis to avoid adding infrastructure, since Postgres is already required.

* IP address is read only from the platform-provided trusted proxy header (for example Vercel's x-forwarded-for, validated according to that platform's documented proxy behavior), never from a client-settable header. Per-account limits are the primary defense and are unaffected by a spoofed or shared IP; per-IP limits are a secondary defense only.

*FIX APPLIED: Unified sign-in lockout into the rate limiter (removing the duplicate account-lockout fields), and added an explicit trust boundary for IP extraction so the rate limiter cannot be bypassed or weaponized through a spoofed header.*

## 7.4 Session Management

* Sessions are stored server-side in the database, referenced by an opaque, high-entropy session token.

* Only a hashed version of the session token is stored in the Session table (sessionTokenHash, unique). The raw token is never persisted server-side; it exists only in the browser cookie and in the request at lookup time, when it is hashed and compared.

* Session cookie attributes: httpOnly: true, secure: true, sameSite: lax, path: /, expiry matching the 30-day sliding session window.

* The cookie contains only the opaque session token, never user data or the session payload directly.

* Every request to a protected route hashes the incoming session token and looks it up against the database to confirm it is still valid and not expired.

*FIX APPLIED: Session tokens are now hashed at rest, matching the same protection already applied to password reset tokens. The earlier draft hashed the shorter-lived reset token but stored the longer-lived (30-day) session identifier in plaintext, which was the greater exposure of the two.*

## 7.5 Email Verification Code Expiry

* Codes are generated server-side, stored in a dedicated database table with an expiresAt timestamp and a nullable usedAt timestamp.

* Expiry is checked against the database value on every verification attempt. The UI disabling the input after 15 minutes is a convenience only, not the enforcement mechanism.

## 7.6 Resend Cooldown

* Enforced by checking the createdAt timestamp of the most recent code record for that account against the current time on the server, on every resend request, before generating a new code.

## 7.7 Password Reset Tokens

* Tokens are generated as cryptographically random values, hashed before storage (the raw token is only ever in the emailed link and the incoming request, never stored in plaintext).

* Each token record has expiresAt and usedAt fields.

* On successful use, usedAt is set immediately in the same transaction as the password update, preventing reuse even under concurrent requests.

## 7.8 Database Uniqueness

* The User model enforces a case-insensitive unique constraint on email at the database level using the Postgres citext type, not a plain text column with application-side lowercasing. This means the guarantee holds even if a future migration, admin tool, or other service writes to the table without going through this module's application code.

*FIX APPLIED: The earlier draft claimed case-insensitive uniqueness was enforced "at the database level" but the schema only had a plain unique text column, with case-insensitivity depending entirely on the application remembering to lowercase every write. Switched to Postgres's citext type so the database itself enforces it.*

## 7.9 Idempotent Signup

* The signup handler is idempotent with respect to email: if a request arrives for an email that already has an unverified account, no new account row is created. The existing row is reused and a new verification code is issued.

* The database unique constraint on email is the final safeguard against a race condition where two concurrent requests for the same new email both pass the initial existence check.

## 7.10 Protected Route Handling

* The dashboard route is protected using Next.js middleware configured to run in the Node.js runtime, not the Edge runtime, so it can query Prisma directly against Postgres for session validation.

* If Edge runtime is required for performance reasons in a future deployment, the session check must instead go through a lightweight proxy or Prisma Accelerate, and that tradeoff must be re-evaluated before switching.

* If no valid session is found, the middleware redirects to Sign In before any dashboard content or data is sent to the client.

*FIX APPLIED: The original requirement described plain Next.js middleware checking Prisma, which does not run under the default Edge runtime. Pinned the runtime explicitly so this requirement is actually buildable as written.*

## 7.11 Accessible Form Inputs

* Every input has an associated \<label\> element linked via matching htmlFor and id attributes.

* Every interactive element (inputs, buttons, links) has a visible focus state, implemented via visible focus rings that meet standard contrast requirements, not outline: none with no replacement.

## 7.12 Stack and Structure

* Next.js App Router.

* TypeScript throughout, no any types in shared schema or data-access code.

* Prisma as the ORM, PostgreSQL as the database, with the postgresqlExtensions preview feature enabled to support the citext email column.

* Route Handlers (app/api/.../route.ts) for all auth endpoints.

# 8\. Business Model

This is an internal reusable module, not a monetized product. There is no pricing, no subscription tier, and no revenue model. Its value is measured by engineering time saved when it is reused as the auth foundation for future projects, not by direct revenue.

**Success for this module is measured by adoption:** the number of future projects that reuse it instead of building auth from scratch. See Section 11 for the specific metric.

*FIX APPLIED: The original section stopped at "no revenue model" without saying what success actually looks like for a non-monetized internal tool. Added a concrete adoption-based definition and linked it to a metric.*

# 9\. Risks

| Risk | Impact | Mitigation |
| :---- | :---- | :---- |
| Email delivery fails or is delayed in production | Users cannot verify accounts or reset passwords | Select a reliable transactional email provider before production use (see Open Questions); add clear resend affordances |
| Rate limiting table grows unbounded | Database bloat, slower lookups over time | Scheduled cleanup job to purge expired rate-limit records (see Section 13, Phase 4\) |
| Argon2id cost parameters set too low for the deployment environment | Weakens password hashing under load | Benchmark cost parameters against target server hardware before launch |
| Reused verification code or reset token guessed via brute force | Account takeover | Rate limiting on submission plus short expiry windows mitigate this; codes and tokens are high-entropy |
| Session table not cleaned up | Database bloat from expired sessions | Scheduled cleanup job to purge expired session records (see Section 13, Phase 4\) |
| Abandoned unverified signups permanently occupy an email address | Real user later cannot register with their own email | 24-hour TTL and scheduled cleanup job on unverified accounts (see Section 5.1 and Section 13, Phase 4\) |
| Developer-consumers of this module skip reading this PRD and misconfigure cookie flags in a non-HTTPS environment | secure: true cookies silently fail to be set, breaking login in local dev | Document a clear local-development exception for the secure flag |

 

*FIX APPLIED: Added a risk row for abandoned unverified signups, matching the new TTL fix in Section 5.1, and pointed the two cleanup-job mitigations at the specific roadmap phase where they are now actually scheduled.*

# 10\. Prisma Data Model

generator client {  
  provider        \= "prisma-client-js"  
  previewFeatures \= \["postgresqlExtensions"\]  
}  
   
datasource db {  
  provider   \= "postgresql"  
  url        \= env("DATABASE\_URL")  
  extensions \= \[citext\]  
}  
   
model User {  
  id                String    @id @default(cuid())  
  email             String    @unique @db.Citext  
  fullName          String  
  passwordHash      String  
  isVerified        Boolean   @default(false)  
  createdAt         DateTime  @default(now())  
  updatedAt         DateTime  @updatedAt  
   
  sessions          Session\[\]  
  verificationCodes VerificationCode\[\]  
  resetTokens       PasswordResetToken\[\]  
  rateLimitEntries  RateLimitEntry\[\]  
   
  @@index(\[isVerified, createdAt\])  
}  
   
model Session {  
  id               String   @id @default(cuid())  
  userId           String  
  user             User     @relation(fields: \[userId\], references: \[id\], onDelete: Cascade)  
  sessionTokenHash String   @unique  
  expiresAt        DateTime  
  createdAt        DateTime @default(now())  
   
  @@index(\[userId\])  
  @@index(\[expiresAt\])  
}  
   
model VerificationCode {  
  id         String    @id @default(cuid())  
  userId     String  
  user       User      @relation(fields: \[userId\], references: \[id\], onDelete: Cascade)  
  code       String  
  expiresAt  DateTime  
  usedAt     DateTime?  
  createdAt  DateTime  @default(now())  
   
  @@index(\[userId\])  
  @@index(\[expiresAt\])  
}  
   
model PasswordResetToken {  
  id          String    @id @default(cuid())  
  userId      String  
  user        User      @relation(fields: \[userId\], references: \[id\], onDelete: Cascade)  
  tokenHash   String    @unique  
  expiresAt   DateTime  
  usedAt      DateTime?  
  createdAt   DateTime  @default(now())  
   
  @@index(\[userId\])  
  @@index(\[expiresAt\])  
}  
   
model RateLimitEntry {  
  id          String   @id @default(cuid())  
  identifier  String  
  action      String  
  userId      String?  
  user        User?    @relation(fields: \[userId\], references: \[id\], onDelete: Cascade)  
  createdAt   DateTime @default(now())  
   
  @@index(\[identifier, action, createdAt\])  
}

*FIX APPLIED: Removed failedLoginCount and lockedUntil from User (lockout now runs entirely through RateLimitEntry). Changed email to @db.Citext for a true database-level case-insensitive constraint. Renamed the Session lookup field to sessionTokenHash and made it the unique hashed value, no longer storing a raw, long-lived session identifier. Added an index to support the unverified-account cleanup job.*

# 11\. Success Metrics

These metrics are measured through manual and automated QA test runs prior to reuse in any project, not through production analytics. No user-behavior tracking or analytics instrumentation is part of this module's scope.

| Metric | Target |
| :---- | :---- |
| Signup-to-verified-account completion rate in testing | Above 95% for valid inputs |
| Password reset completion rate in testing | Above 95% for valid token flows |
| Unauthorized dashboard access attempts blocked | 100% |
| Double-submission signup requests resulting in duplicate accounts | 0 |
| All 11 mandatory engineering requirements present and verifiable in code | 11 of 11 |
| Number of future projects that adopt this module instead of building auth from scratch | Tracked manually per Section 8 |

 

*FIX APPLIED: Added a measurement-mechanism statement so the numeric targets are not implicitly promising analytics instrumentation that is out of scope. Added an adoption metric to match the Business Model section.*

# 12\. Assumptions

* Full name has a max length of 100 characters and requires at least 1 non-whitespace character.

* Session invalidation on all devices occurs automatically after a successful password reset.

* No redirect-back-to-original-destination behavior is implemented after login, since the dashboard is the only protected page.

* Sessions use a 30-day sliding expiration window.

* Verification code submission is rate limited separately from resend, at 10 attempts per 15 minutes per account.

* Rate limit counters are stored in Postgres rather than a separate service like Redis.

* Next.js App Router is used, not the Pages Router.

* Success metrics are framed around internal correctness and adoption, not revenue-based KPIs, since this is not a monetized product.

* Distribution model: this module is used as a cloneable starter repository, not a package.

* Unverified accounts expire and are deleted after 24 hours.

*FIX APPLIED: Removed the password-complexity assumption (moved to Open Questions, since it should be a confirmed decision, not a silent default) and removed the account-lockout assumption (no longer needed, since lockout is now fully defined by the rate limiter in Section 7.3). Added the distribution model and unverified-account TTL as new assumptions to keep this list synced with the rest of the document.*

# 13\. Phased Roadmap

## Phase 1: Data layer and core auth logic

* Prisma schema, migrations, database connection.

* Enable the postgresqlExtensions preview feature and the citext extension for case-insensitive email uniqueness.

* Password hashing utility (argon2id).

* Validation schemas (Zod) for all forms.

## Phase 2: API routes

* Signup, sign in, sign out, forgot password, reset password, verify email, resend code.

* Rate limiting middleware applied to all relevant routes, including the sign-in lockout behavior, with IP extraction restricted to the platform's trusted proxy header.

## Phase 3: UI screens

* Create Account, Sign In, Forgot Password, Reset Password, Email Verification, Dashboard.

* Client-side validation wired to the same Zod schemas.

* Accessible form markup: labels, focus states.

## Phase 4: Route protection, session enforcement, and scheduled cleanup

* Middleware to guard the dashboard route, explicitly configured to run in the Node.js runtime, not Edge.

* Session issuance and lookup using a hashed session token (sessionTokenHash), never a raw stored token.

* Scheduled cleanup job: delete unverified accounts older than 24 hours.

* Scheduled cleanup job: delete expired session records.

* Scheduled cleanup job: delete expired rate-limit entries.

## Phase 5: Hardening and testing

* Manual test pass through every edge case listed in Section 5\.

* Load test rate limiting under concurrent requests, including behind a shared IP, to confirm per-account limits hold independently of IP-based limits.

* Verify idempotent signup under simulated double submission.

* Verify that a password reset invalidates all existing sessions for that account.

*FIX APPLIED: Moved the citext setup into Phase 1, moved the middleware runtime decision and session-hashing work into Phase 4 explicitly, and added the three cleanup jobs that Section 9 promises as risk mitigations but the original roadmap never scheduled.*

# 14\. Open Questions

* Which transactional email provider will send verification and reset emails in production (for example Resend, Postmark, SendGrid, or AWS SES)?

* Should rate limiting move to a dedicated store like Redis if this module is reused in a high-traffic project, or is a Postgres-backed table acceptable long term?

* Is a 30-day session length correct for the intended use cases this module will be reused in, or should it be configurable per project?

* Should password complexity be strengthened beyond the current default of 8 characters, one letter, and one number, given this module may be reused in security-sensitive projects?

* Should unverified accounts have a shorter or longer TTL than 24 hours, and should there be a manual override for support cases?

* Should a user be allowed multiple simultaneous sessions across devices, or should signing in on a new device revoke older sessions?

* Is it acceptable for the forgot-password and signup flows to never reveal whether an email is registered under any circumstance, or is there a case where a direct “this email is already in use” message is an acceptable tradeoff?

*FIX APPLIED: Added four new open questions surfaced during review, on top of the three carried over from the original draft. Removed the account-lockout configurability question from an earlier version of this list since lockout is now fully defined by the rate limiter and no longer a separate design decision.*