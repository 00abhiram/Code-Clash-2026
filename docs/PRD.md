# Code Clash 2026 — PRD & Technical Specification

## 1. Executive Summary

**Problem:** Pallavi Engineering College (Hyderabad) requires a fully-automated, proctored coding competition platform for ~100–200 concurrent student participants, with zero budget. The system must handle registration, dual-round exams (TDD + Debugging), sandboxed code execution, anti-cheat enforcement, and a live admin dashboard — all running within a single 2-hour window on **Friday, 7 August 2026** (Round 1 unlocks 13:45 IST, 30 min; Round 2 unlocks 14:30 IST, 30 min).

**Business goals:**
- G1: Two frictionless, bulletproof auth paths (Email/Password, Google OAuth) that always produce a populated `profiles` row.
- G2: Exam integrity via mandatory fullscreen, cumulative background-time limits, single-attempt enforcement, and per-session state machines.
- G3: Real-time operational visibility for admins (live registrations, active sessions, submissions, violations).
- G4: Automatic grading against hidden test cases with deterministic tie-breaking, published on a live leaderboard.

**Scope:** Complete build, already implemented and compiling. Remaining work: end-to-end verification against the live Supabase instance, Realtime publication confirmation, sample data seeding, and Vercel deployment.

## 2. System Architecture

**Topology:** Client → Next.js 16 App Router (Vercel Edge/Node) → Supabase (PostgreSQL + Auth + Realtime) and Piston API (code execution). No self-hosted backend; all business logic lives in Next.js route handlers and Supabase database functions.

**Component boundaries:**
- **`src/lib/supabase/`** — three client factories: `client.ts` (browser), `server.ts` (route handlers), `middleware.ts` (proxy/edge session refresh + route guards). `src/proxy.ts` is the Next.js 16 entry (Turbopack builds `proxy` in place of legacy `middleware.ts`) delegating to `updateSession()`.
- **Route guard layer (`proxy.ts`)** — enforces: unauthenticated → `/login`; authenticated on `/login`|`/signup` → role-based redirect; student on `/admin` → `/dashboard`; student with `roll_no`/`branch` = `'EMPTY'` on any `/dashboard` route (except `/dashboard/onboarding`) → `/dashboard/onboarding`.
- **API route handlers** (`/api/*`) — authenticated HTTP layer over Supabase with server-side auth + ownership checks: `exam-sessions` (state machine + ownership), `submissions`/`submissions/evaluate` (server-side grading + ownership), `violations` (ownership), `questions` (admin CRUD), `settings` (auth required), `leaderboard` (auth required), `execute` (auth required).
- **Client exam shell** (`/dashboard/exam/[examId]/live`) — Monaco editor + Markdown problem panel + anti-cheat hook + countdown timer; single-attempt gate on mount.
- **Admin app** (`/admin/*`) — CRUD, leaderboard with dual-tab ranking, live Realtime counters.

**Data flow (exam lifecycle):** Student starts exam → `POST /api/exam-sessions` creates `in_progress` session (or returns existing; blocks if `completed`) → student codes, runs sample tests via `POST /api/execute` (Piston, client-side only) → submit/auto-submit → server-side evaluation via `POST /api/submissions/evaluate` per question (runs **all** test cases on server, records `submissions` row) → session PATCHed to `completed` → leaderboard recomputed → admin dashboard updates via Realtime.

**Grading security boundary:** Students never receive hidden test inputs/expected outputs or `solution_code`. The client-side Run button only evaluates sample tests (visible). Server-side `/api/submissions/evaluate` runs all test cases and returns only sample-level detail plus aggregate hidden counts.

## 3. Tech Stack & Dependencies

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.2.12 (App Router, Turbopack) | Route handlers use `Promise`-based `params`; `proxy.ts` replaces `middleware.ts` |
| Language | TypeScript (strict) | |
| Styling | Tailwind CSS (dark theme) | Tokens: `bg-background`, `bg-surface`, `border-border`, `primary-light`, `success`, `danger`, `warning`, `accent` |
| Editor | Monaco Editor (`@monaco-editor/react`) | Read `AGENTS.md` note: Next 16 docs in `node_modules/next/dist/docs/` |
| Backend | Supabase (PostgreSQL + Auth + Realtime) | Anon key client-side; RLS is the security boundary |
| Execution | Piston API v2 (`https://emkc.org/api/v2/piston`) | Public, no key. Env `NEXT_PUBLIC_PISTON_URL` overrides; self-hostable via Docker |
| Markdown | `react-markdown` + `remark-gfm` | |
| Icons | `lucide-react` | |
| Deployment | Vercel | Free tier |

**Supported contest languages:** Python, Java, C, C++ (DSA-only problems).

## 4. Codebase Directory Map

```
code-clash-2026/
├─ proxy.ts                              # Next 16 proxy entry (auth guard + onboarding guard)
├─ supabase/migrations/
│  ├─ 20260804_fix_handle_new_user_google_oauth.sql   # Trigger: Google-safe profile insert
│  ├─ 20260804_fix_auth_profiles_complete.sql         # year column, RLS, dual-path trigger (EXECUTED)
│  ├─ 20260818_enable_realtime_publications.sql       # Realtime for 4 tables (PENDING)
│  ├─ 20260819_rls_exam_tables.sql                    # RLS + SECURITY DEFINER functions (PENDING, not applied, MUST be last)
│  ├─ 20260820_add_session_duration_minutes.sql       # duration_minutes column (PENDING)
│  ├─ 20260821_submissions_unique_constraint.sql      # Unique index on submissions (PENDING)
│  ├─ 20260822_add_violation_rpc_and_auto_submitted.sql # increment_violation_count RPC + auto_submitted column (PENDING)
│  └─ 20260823_leaderboard_fix_and_assignment_enforcement.sql # Phase 8: leaderboard fix + assignment enforcement (PENDING)
└─ src/
   ├─ lib/supabase/{client,server,middleware}.ts
   ├─ types/database.ts                  # Typed Database schema (all 8 tables) + Piston types
   ├─ hooks/
   │  ├─ useAuth.tsx                     # AuthProvider: session + profile context
   │  ├─ useAntiCheat.ts                 # 15s cumulative bg timer, fullscreen, key blockers
   │  └─ useExamTimer.ts                 # Server-time countdown, auto-submit on expiry
   ├─ components/auth/
   │  ├─ LoginForm.tsx                   # Email/password sign-in, inline errors
   │  ├─ SignupForm.tsx                  # Full details + year; email-verification success state
   │  └─ GoogleOAuthButton.tsx           # signInWithOAuth → /auth/callback
   ├─ components/exam/                   # CodeEditor, ProblemPanel, TestResults, Timer, ViolationModal
   ├─ app/
   │  ├─ (auth)/{login,signup}/          # Auth pages under shared PEC-branded layout
   │  ├─ auth/callback/route.ts          # OAuth code exchange + error passthrough to /login?error=
   │  ├─ dashboard/onboarding/page.tsx   # Post-Google mandatory details form
   │  ├─ dashboard/exam/[examId]/live/page.tsx   # Exam shell (TDD/DEBUGGING aware)
   │  ├─ admin/{page,questions,settings,leaderboard}/page.tsx
    │  └─ api/{execute,settings,questions,questions/[id],questions/[id]/samples,exam-sessions,submissions,submissions/evaluate,violations,leaderboard}/route.ts
```

## 5. Core Logic & Business Rules

### 5.1 `profiles` schema

`id uuid PK REFERENCES auth.users(id)`, `email text`, `full_name text`, `roll_no text`, `branch text`, `year text` (default `'1'`), `role text` (`'student'|'admin'`, default `'student'`), `is_active bool`, `created_at/updated_at timestamptz`.

### 5.2 Trigger `handle_new_user` (AFTER INSERT ON auth.users, SECURITY DEFINER)

- Reads `NEW.raw_user_meta_data`.
- **Email path:** `roll_no`/`branch`/`year` present in metadata → inserted directly.
- **Google path:** metadata lacks them → `'EMPTY'`, `'EMPTY'`, `'1'` hardcoded; name resolved from `full_name` → `name` → `preferred_name` → email-prefix.
- `ON CONFLICT (id) DO UPDATE` with guarded CASE clauses (never overwrite a filled field with `'EMPTY'`); `EXCEPTION WHEN OTHERS` swallows failure (logs warning) so auth.user creation is never blocked.

### 5.3 RLS policies (profiles)

```sql
ENABLE ROW LEVEL SECURITY;
SELECT  → USING (auth.uid() = id)                 -- TO authenticated
UPDATE  → USING (auth.uid() = id) WITH CHECK (auth.uid() = id)
ALL     → TO service_role, USING (true)           -- admin API routes
```

This resolves the historical `Database error saving new user` and onboarding `Failed to save` failures.

### 5.4 Auth routing decision tree

1. `signUp()` → if `data.user && !data.session` → **email confirmation required** → render "Check your email" success state (no redirect). If session returned → `/dashboard`.
2. Google OAuth → `redirectTo: /auth/callback` → `exchangeCodeForSession`; callback inspects `error`/`error_description` params first (redirects `/login?error=<msg>`, rendered as toast-style banner via `useSearchParams` in Suspense); missing profile after exchange → `/dashboard/onboarding`.
3. Middleware: any `/dashboard` hit with `roll_no === 'EMPTY'` or `branch === 'EMPTY'` → hard redirect to onboarding (server-side, unbypassable).

### 5.5 Exam session state machine (server-enforced in `/api/exam-sessions`)

```
pending → in_progress → completed   (no reverse transitions; 400 on violation)
```

POST is idempotent resume; `completed` sessions block re-entry (live page shows "already submitted" screen).

### 5.6 Anti-cheat (client hook + server `violations` table)

Gate: `settings.is_anti_cheat_enabled`. When disabled, violations are not recorded.

**Auto-submit triggers (three independent paths):**

| Trigger | Threshold | Client | Server |
|---|---|---|---|
| Fullscreen exits | ≥ 2 exits | `useAntiCheat` counts exits, calls `autoSubmit("fullscreen_limit")` | **Cannot enforce** — server has no visibility into fullscreen state. Client-triggered evaluate is processed normally. |
| Cumulative background time | ≥ 15,000 ms | `visibilitychange` + 250 ms interval (paused on return, never reset) | **Cannot enforce** — server has no visibility into tab focus state. Client-triggered evaluate is processed normally. |
| Violation count | ≥ 5 violations | Client counts all violation types, calls `autoSubmit("violation_limit")` | **Enforced** — `POST /api/violations` checks `violation_count >= 5` after increment, completes session server-side. |

**Critical server-enforcement limitation:** Fullscreen exits and background time are browser-only signals. The server cannot independently verify these events. If a student disables JavaScript or manipulates the client, the server will NOT auto-submit for fullscreen/background violations. The violation count threshold IS server-enforced because violations are recorded via API.

**Warning system:**
- Each violation triggers a `ViolationModal` showing: violation type label, message, remaining count before auto-submit.
- Warning duration: 5 seconds for fullscreen/shortcut violations; 5 seconds for return-from-background.
- Auto-submit warnings show "Auto-submitting!" with 2-second delay before submission.

**Violations recorded:**
- `fullscreen_exit` — leaving fullscreen mode
- `tab_switch` — `visibilitychange` to hidden (background accumulation starts)
- `shortcut_attempt` — blocked keys (`F12`, Ctrl/Cmd+C/V/X, Ctrl+Shift+I/J, Ctrl+U, right-click)

**Server-side enforcement (`POST /api/violations`):**
- Auth required (`getAuthUser`).
- Session ownership verified (`session.user_id === user.id`).
- Active session check (`session.status === "active"`; rejects 409 if completed).
- Rate limiting: max 10 violations per session per 60-second window (**in-memory per serverless instance; resets between Vercel invocations**).
- Violation type validated against allowed enum values.
- Violation count incremented via RPC (`increment_violation_count`) with non-atomic fallback (**race condition documented below**).
- Server-side auto-submit: re-checks `session.status === "active"` before completing; if `violation_count >= 5`, marks session `status: "completed"`. Uses `WHERE status = 'active'` to prevent double-completion.

**`hasAutoSubmittedRef` / `autoSubmittedRef` — client-only once-guards:**
- `useAntiCheat.ts`: `hasAutoSubmittedRef` (React ref) prevents multiple auto-submit calls within one page session. **Not persisted** — refreshing the page resets it. Server-side session status check prevents actual double-grading.
- `live/page.tsx`: `autoSubmittedRef` (React ref) prevents duplicate `autoSubmit()` calls. **Not persisted** — same protection as above.
- **Schema gap:** `auto_submitted` column does NOT exist in current `exam_sessions` table. Migration prepared (`20260822...`). Current auto-submit only sets `status: "completed"`.

**Race condition: `violation_count` increment:**
- RPC path (`increment_violation_count`): Atomic SQL `UPDATE ... SET violation_count = violation_count + 1`. **Requires migration to be applied.**
- Fallback path (manual increment): Read `violation_count`, compute `+1`, write back. **Not atomic** — two concurrent requests can both read the same value and write the same result, losing one increment.
- **Impact:** If two violations arrive concurrently and both read `violation_count = 4`, both write `5`. The actual count should be `6`. This means the threshold might be triggered one violation late.
- **Mitigation:** The `increment_violation_count` RPC migration must be applied to eliminate this race. Until then, the race exists but the practical impact is minimal (threshold triggered at 5 or 6 instead of exactly 5).

**Race condition: concurrent server auto-submit:**
- If two concurrent violations both trigger `newCount >= 5`, both re-check `freshSession?.status === "active"` and both attempt to complete the session.
- The second `UPDATE ... SET status = 'completed' WHERE status = 'active'` is a no-op (status already "completed").
- **Safe:** Session is completed exactly once. Both responses include `auto_submitted: true`, but only one actually changed the status.

**Browser limitations (honest documentation):**
- `visibilitychange` cannot detect which tab/app is active — only that the current tab lost/gained focus.
- Fullscreen API can be bypassed if browser DevTools are open.
- Keyboard shortcuts (`Ctrl+C`, etc.) cannot be truly blocked if DevTools are open.
- Right-click can be blocked via `contextmenu` event but DevTools bypasses this.
- No detection of external devices (phones, second monitors) or screen sharing.
- These are inherent browser sandbox limitations — the system relies on deterrence + audit trail, not perfect prevention.

**Anti-cheat disabled behavior:**
- All `useEffect` hooks in `useAntiCheat` check `if (!isEnabled) return;` — no listeners attached.
- No violations are recorded client-side or server-side when disabled.
- **Note:** PRD 5.3.1 originally specified "violations shall still be logged client-side for auditing but not enforced." This is NOT implemented — no client-side logging occurs when disabled. If audit logging is needed, a future phase should add `console.log` or localStorage logging.

### 5.7 Grading/leaderboard

Submissions evaluated at submit time via `POST /api/submissions/evaluate` — server runs every test case (sample + hidden) through Piston, normalizes output, and upserts a `submissions` row. Students receive only sample-level detail + aggregate hidden counts; hidden test inputs/expected outputs and `solution_code` never reach the client. Ranking per round = hidden tests passed → execution time → time taken.

### 5.10 Submission idempotency & finality (Phase 4)

**Idempotency strategy:** The evaluate endpoint checks for an existing graded submission (by question_id + exam_session_id + user_id) before running Piston. If one exists, it returns the stored result immediately (response includes `idempotent: true`). This means:
- Double-clicks: second click returns stored result, no duplicate Piston work.
- Network retries: retry returns stored result.
- Two tabs: second tab returns stored result.

**Session completion guard:** The evaluate endpoint checks `session.status === "completed"` before doing any work. Returns 409 if already submitted. This prevents:
- Auto-submit + manual submit race.
- Two concurrent auto-submit calls (first to complete PATCH wins; second gets 409).
- Post-deadline submission attempts.

**Database-level protection:** Prepared unique partial index on `(question_id, exam_session_id, user_id) WHERE status IN ('passed', 'failed')`. This is a defensive constraint — the application layer already performs idempotent checks, but this ensures correctness even if application logic has bugs.

**Dead route removal:** `POST /api/submissions` (direct insert) returns 410 Gone. All submissions must go through `/api/submissions/evaluate`.

**Client handling:** Auto-submit loop detects 409 responses and breaks immediately. Session PATCH is skipped if 409 received (another request already completed it). Post-submit UI shows "Exam was already submitted" for the race case.

**Race condition analysis:**

| Scenario | Outcome | Safety |
|---|---|---|
| Double-click Submit | Second call returns stored result | Safe (idempotent) |
| Network retry | Retry returns stored result | Safe (idempotent) |
| Two browser tabs | Second tab returns stored result | Safe (idempotent) |
| Auto-submit + manual Submit | Manual gets 409; auto continues | Safe (409 breaks loop) |
| Two concurrent auto-submits | First PATCH wins; second gets 409 | Safe (409 skips PATCH) |
| Submit immediately before deadline | Session still in_progress; accepted | Safe |
| Submit immediately after deadline | `isSessionExpired()` returns 400 | Safe |
| Refresh after submission | Session shows completed; blocked | Safe (state machine) |
| Submission after completed session | 409 from evaluate endpoint | Safe |

**Leaderboard protection:** The evaluate endpoint only creates/updates one submission row per (question, session, user). Even without the unique constraint, the upsert pattern prevents duplicate scored rows. The unique constraint adds database-level assurance.

### 5.8 API authentication & authorization (Phase 2)

All API routes verify the caller server-side via Supabase session cookies. No route trusts client-supplied `user_id`.

**Shared helpers** (`src/lib/supabase/server.ts`):
- `getAuthUser()` → returns `{ ok: true, user, supabase }` or `{ ok: false, response: 401 }`. Extracts user from session cookie; never trusts client-supplied identity.
- `requireAdmin()` → returns `{ ok: true, user, profile, supabase }` or `{ ok: false, response: 401/403 }`. Loads profile, verifies `role === 'admin'`.
- `requireSessionOwnership(supabase, userId, sessionId)` → verifies the exam session belongs to the user; returns session or 403/404.

**Ownership chain:**
```
authenticated user.id (from session cookie)
       ↓
exam_session.user_id (verified server-side)
       ↓
submission.user_id (verified via session ownership)
       ↓
violation.user_id (verified via session ownership)
```

**Per-route security model:**

| Route | Auth | Admin | Ownership | Notes |
|---|---|---|---|---|
| `POST /api/exam-sessions` | Required | — | — | Uses `user.id` from session; ignores client `user_id` |
| `PATCH /api/exam-sessions` | Required | — | Session ownership | Verifies `session.user_id === user.id` |
| `POST /api/submissions/evaluate` | Required | — | Session ownership | Uses `user.id` from session; ignores client `user_id` |
| `POST /api/submissions` | — | — | — | Disabled (410 Gone); use `/api/submissions/evaluate` |
| `POST /api/violations` | Required | — | Session ownership | Uses `user.id` from session; ignores client `user_id` |
| `GET /api/questions` | Required | — | — | Returns active questions only |
| `POST /api/questions` | Required | Admin | — | `requireAdmin()` check |
| `GET /api/questions/[id]` | Required | — | — | Returns question + sample tests only |
| `PUT /api/questions/[id]` | Required | Admin | — | `requireAdmin()` check |
| `DELETE /api/questions/[id]` | Required | Admin | — | `requireAdmin()` check |
| `GET /api/questions/[id]/samples` | Required | — | — | Returns sample test cases |
| `GET /api/settings` | Required | — | — | Returns exam settings |
| `GET /api/leaderboard` | Required | — | — | Auth required (session cookie) |
| `POST /api/execute` | Required | — | — | Auth required (prevents anonymous code exec) |

### 5.9 Server-side timing & unlock enforcement (Phase 3)

**Timing source:** Server `Date.now()` (Vercel/Node runtime). All unlock and deadline checks use server time, never client `Date.now()`.

**Round unlock enforcement:**
- `requireRoundUnlocked(supabase, examNumber)` — fetches `settings` row, compares server time against `exam{N}_unlock_at`. Returns 403 with `unlock_at` and `minutes_until_unlock` if before unlock.
- Applied to: `POST /api/exam-sessions`, `GET /api/questions?exam=N`, `GET /api/questions/[id]`.
- Client exam entry page (`/dashboard/exam/[examId]/page.tsx`) still checks unlock for UX countdown, but server is authoritative.

**Session deadline (duration snapshot):**
- At session creation, `duration_minutes` is snapshot from `settings` into `exam_sessions.duration_minutes`.
- Timer uses: `started_at (server-set) + duration_minutes (snapshot)`.
- If admin changes `settings.exam{N}_duration_minutes` after a session starts, the session's deadline is **not** affected — it uses the snapshot.
- `isSessionExpired(session, settings, examNumber)` checks: `now > started_at + (session.duration_minutes ?? settings default)`.

**Client/server timer relationship:**
- `useExamTimer` hook uses `startedAt` (from session response) + `durationMinutes` (from session response) — both server-authoritative.
- Client `Date.now()` is only used for the countdown display, not for the expiry decision.
- If client clock is wrong, the timer display is wrong but the server still rejects expired submissions.

**Submission expiry enforcement:**
- `POST /api/submissions/evaluate` rejects with 400 if `session.status === "completed"` or `isSessionExpired(...)`.
- Auto-submit from client triggers before deadline; server accepts if session is still valid.
- Stale browser cannot submit after server-side deadline.

**Duration change rule:** Admin changing `settings.exam{N}_duration_minutes` affects only NEW sessions. Existing in-progress sessions use their snapshot. This is deterministic and prevents mid-round surprises.

## 6. Current Status & Pending Tasks

**Complete & verified compiling (`npm run build` passes, 20 routes + proxy):** auth UI/routing (both paths), onboarding guard, trigger + RLS migrations (user executed in Supabase), email-verification success state, live exam shell, Piston wrapper, leaderboard.

**Hardening features — implemented in code, pending E2E verification + deployment:**

| Feature | Status | Location |
|---|---|---|
| Single-attempt enforcement (session state machine, re-entry block) | Implemented | `src/app/api/exam-sessions/route.ts`, live page `status === "completed"` gate |
| 15 s cumulative anti-cheat timer (background accumulation) | Implemented | `src/hooks/useAntiCheat.ts` (`maxBackgroundTimeMs = 15000`) |
| Real-time admin dashboard (Realtime counters on 4 tables) | Implemented; **requires Realtime publications enabled in Supabase dashboard** | `src/app/admin/page.tsx` (`channel("admin-realtime")`) |
| Distinct TDD vs. DEBUGGING UIs (question_type selector, badges, buggy starter code) | Implemented | `src/app/admin/questions/page.tsx`, live page, `ProblemPanel` |
| Server-side grading + data leak prevention | Implemented | `src/app/api/submissions/evaluate/route.ts`, `src/app/api/questions/[id]/samples/route.ts`, `src/app/api/questions/route.ts`, `src/app/api/questions/[id]/route.ts` |
| Submit flow rewrite (server-side evaluate, post-submit UI) | Implemented | `src/app/dashboard/exam/[examId]/live/page.tsx` |
| Server-side auth + authorization on all API routes | Implemented | `src/lib/supabase/server.ts` (helpers), all `/api/*/route.ts` files |
| RLS migration prepared (not applied) | Prepared | `supabase/migrations/20260819_rls_exam_tables.sql` |
| Server-side timing & unlock enforcement | Implemented | `src/lib/supabase/server.ts` (timing helpers), `src/app/api/exam-sessions/route.ts`, `src/app/api/questions/route.ts`, `src/app/api/questions/[id]/route.ts`, `src/app/api/submissions/evaluate/route.ts` |
| Duration snapshot on session creation | Implemented | `src/app/api/exam-sessions/route.ts` (inserts `duration_minutes`) |
| `duration_minutes` column migration | Prepared | `supabase/migrations/20260820_add_session_duration_minutes.sql` |
| Submission idempotency & finality | Implemented | `src/app/api/submissions/evaluate/route.ts`, `src/app/api/submissions/route.ts`, `src/app/dashboard/exam/[examId]/live/page.tsx` |
| Unique constraint on submissions | Prepared | `supabase/migrations/20260821_submissions_unique_constraint.sql` |
| Anti-cheat: fullscreen exit auto-submit + violation count auto-submit | Implemented | `src/hooks/useAntiCheat.ts` (fullscreen count + violation count) |
| Anti-cheat: server-side enforcement (active session check, rate limiting, enum validation, server auto-submit) | Implemented (column gap documented) | `src/app/api/violations/route.ts` |
| Anti-cheat: warning modal with type + remaining count | Implemented | `src/components/exam/ViolationModal.tsx` |
| `increment_violation_count` RPC + `auto_submitted` column | Prepared (NOT applied) | `supabase/migrations/20260822_add_violation_rpc_and_auto_submitted.sql` |
| RLS: admin policies on all 8 tables | Prepared (NOT applied) | `supabase/migrations/20260819_rls_exam_tables.sql` |
| RLS: role escalation prevention on profiles | Prepared (NOT applied) | `supabase/migrations/20260819_rls_exam_tables.sql` |
| RLS: session ownership check on violations INSERT | Prepared (NOT applied) | `supabase/migrations/20260819_rls_exam_tables.sql` |
| Leaderboard SECURITY DEFINER function | Implemented | `supabase/migrations/20260819_rls_exam_tables.sql` (`get_leaderboard_data()`) |
| Leaderboard API updated to use function | Implemented | `src/app/api/leaderboard/route.ts` |
| Piston execution: per-test AbortController timeout (25s) | Implemented | `src/lib/piston.ts` (`executeCodeDirect`) |
| Piston execution: request body size limit (100KB) | Implemented | `src/app/api/execute/route.ts` |
| Piston execution: source code size limit (50KB) | Implemented | `src/lib/piston.ts`, all routes + client |
| Piston execution: language validation | Implemented | `src/app/api/execute/route.ts` |
| Piston execution: error type classification | Implemented | `src/lib/piston.ts`, `src/app/api/execute/route.ts` |
| Piston execution: malformed response handling | Implemented | `src/lib/piston.ts`, `src/app/api/execute/route.ts` |
| Piston execution: Piston unavailability detection | Implemented | `src/app/api/submissions/evaluate/route.ts` |
| Piston execution: client-side size validation | Implemented | `src/app/dashboard/exam/[examId]/live/page.tsx` |
| Settings defaults alignment (server ↔ admin ↔ PRD) | Implemented | `src/lib/supabase/server.ts` (fixed `DEFAULT_SETTINGS` dates) |
| Dynamic duration in exam entry warning | Implemented | `src/app/dashboard/exam/[examId]/page.tsx` |
| Leaderboard RPC: `is_submitted` → `status = 'completed'` | Prepared (NOT applied) | `supabase/migrations/20260823_leaderboard_fix_and_assignment_enforcement.sql` |
| Student assignment enforcement in `start_exam_session` | Prepared (NOT applied) | `supabase/migrations/20260823_leaderboard_fix_and_assignment_enforcement.sql` |

**Phase 1 — Server-side grading & data contract (complete):**
- Created `POST /api/submissions/evaluate` — runs all test cases server-side via Piston, returns only sample results + aggregate hidden counts.
- Created `GET /api/questions/[id]/samples` — student-visible sample test cases only.
- Fixed `GET /api/questions` — `solution_code` stripped from all responses.
- Fixed `GET /api/questions/[id]` — requires auth, strips `solution_code`, returns only sample test cases.
- Rewrote `autoSubmit`/`handleSubmit` — submission calls evaluate endpoint; `executeCode` only used for Run button.
- Added `submitted` state to prevent re-runs; added post-submission results panel (sample + hidden aggregate).
- Verified: zero `solution_code` leaks, zero hidden test data leaks to client.

**Phase 2 — Server-side auth, authorization & ownership (complete):**
- Created `getAuthUser()`, `requireAdmin()`, `requireSessionOwnership()` in `src/lib/supabase/server.ts`.
- All 10 API routes now verify authentication server-side via session cookie.
- Student APIs (exam-sessions, submissions, violations) verify session ownership — one student cannot read/modify another's data.
- Client-supplied `user_id` is ignored/overridden in all student APIs.
- Admin APIs (questions POST/PUT/DELETE) require `role === 'admin'` via `requireAdmin()`.
- `/api/execute` requires authentication (prevents anonymous code execution).
- `/api/settings` requires authentication (prevents exam timing data leak).
- `/api/leaderboard` requires authentication.
- Prepared RLS migration (`supabase/migrations/20260819_rls_exam_tables.sql`) — not applied to live DB.

**Phase 3 — Server-side timing & unlock enforcement (complete):**
- Created timing helpers in `src/lib/supabase/server.ts`: `getSettings()`, `requireRoundUnlocked()`, `getDurationMinutes()`, `isSessionExpired()`.
- `POST /api/exam-sessions` — rejects with 403 if round not yet unlocked; snapshots `duration_minutes` from settings at session creation.
- `GET /api/questions?exam=N` — rejects with 403 if round not yet unlocked.
- `GET /api/questions/[id]` — fetches question's `exam_number`, rejects with 403 if round not yet unlocked.
- `POST /api/submissions/evaluate` — rejects with 400 if session is completed or expired (server-authoritative).
- Live page (`live/page.tsx`) — uses server `duration_minutes` from session response for Timer; handles 403 from questions fetch.
- Duration change rule: admin changing settings duration affects only new sessions, not existing in-progress sessions.
- Prepared `duration_minutes` column migration — not applied to live DB.

**Phase 4 — Submission idempotency & finality (complete):**
- Evaluate endpoint checks `session.status === "completed"` before Piston work; returns 409 if already submitted.
- Idempotency: checks for existing graded submission before running Piston; returns stored result with `idempotent: true`.
- Removed dead `POST /api/submissions` route (returns 410 Gone).
- Auto-submit loop handles 409 (breaks immediately, skips session PATCH).
- Prepared unique partial index on submissions table — not applied to live DB.
- Race condition analysis documented (9 scenarios, all safe).

**Phase 5 — Anti-cheat policy & enforcement alignment (complete):**
- Fixed `useAntiCheat` hook: now counts fullscreen exits and auto-submits on 2nd exit (was only recording violations).
- Fixed `useAntiCheat` hook: now counts total violations (all types) and auto-submits on 5th violation (was no threshold).
- Updated `ViolationModal` to show violation type label + remaining count before auto-submit.
- Updated live page to pass `violationType` and `remainingCount` to modal.
- Server-side `POST /api/violations`: rejects violations for completed sessions (409).
- Server-side `POST /api/violations`: rate limiting — max 10 violations per session per 60-second window (in-memory, resets on serverless cold start).
- Server-side `POST /api/violations`: `violation_type` enum validation against allowed values.
- Server-side auto-submit: re-checks `freshSession?.status === "active"` before completing; uses `WHERE status = 'active'` to prevent double-completion.
- **CRITICAL FIX:** Removed non-existent columns (`auto_submitted`, `total_score`, `total_tests`) from server auto-submit update — now only sets `status: "completed"`.
- Documented browser sandbox limitations honestly in PRD (cannot detect DevTools bypass, external devices, screen sharing).
- Documented server-enforcement limitation: fullscreen exits and background time are client-only signals; server cannot independently verify them.
- Documented race condition in `violation_count` fallback increment (non-atomic without RPC migration).
- Documented that `hasAutoSubmittedRef` / `autoSubmittedRef` are client-only, not persisted.
- Documented that `auto_submitted` column does not exist in current schema (migration prepared).
- Verified: `npx tsc --noEmit` passes, `npm run build` passes, `npm run lint` 0 new issues.

**Remaining tasks for the next engineer:**

1. Apply migrations to Supabase in ORDER (requires approval):
   - `supabase/migrations/20260820_add_session_duration_minutes.sql` — add `duration_minutes` column.
   - `supabase/migrations/20260821_submissions_unique_constraint.sql` — unique partial index.
   - `supabase/migrations/20260822_add_violation_rpc_and_auto_submitted.sql` — atomic `increment_violation_count` RPC (with ownership check) + `auto_submitted` column.
   - `supabase/migrations/20260819_rls_exam_tables.sql` — RLS + SECURITY DEFINER functions (**MUST be last**).
   - `supabase/migrations/20260823_leaderboard_fix_and_assignment_enforcement.sql` — leaderboard status filter + student assignment enforcement (after 20260819).
2. Migrate existing `solution_code` data from `questions` table to `question_solutions` table (if any questions have solution_code populated).
3. Confirm Realtime publications on `profiles`, `exam_sessions`, `submissions`, `violations`.
4. Verify Google OAuth in production.
5. Test auto-submit path (timer expiry and anti-cheat trigger) against hidden tests.
6. Deploy to Vercel; sanity-check env vars.
7. E2E test anti-cheat: verify fullscreen exit count auto-submit, violation count auto-submit, background time auto-submit, server-side rate limiting, server-side active session rejection.
8. **After all migrations applied:** Verify RLS policies enforce correctly, admin pages work, student isolation holds, leaderboard shows all students, evaluate endpoint grades hidden tests, solution_code and hidden test_cases are inaccessible to students.
9. **Verify database-level security:** Confirm students cannot read solution_code via browser console (question_solutions table), cannot read hidden test_cases (is_sample filter), cannot forge submission scores (INSERT blocked), cannot change exam session status (UPDATE blocked).
10. **Verify Piston reliability:** Test with actual Piston instance — verify timeout behavior, error classification, malformed response handling, source code size limits, language validation.
11. **Production load planning:** Determine if public Piston API can handle 200 concurrent students or if self-hosted Docker Piston is needed. Consider Vercel plan (free tier concurrent execution limits).

### 5.12 Phase 5 — Implementation verification matrix

**Implemented (code complete, compiles):**
- `useAntiCheat` hook: fullscreen exit count + auto-submit on 2nd exit
- `useAntiCheat` hook: violation count + auto-submit on 5th violation
- `useAntiCheat` hook: cumulative background time + auto-submit on 15s
- `useAntiCheat` hook: keyboard shortcut blocking + right-click blocking
- `ViolationModal`: shows violation type label + remaining count
- `POST /api/violations`: auth, ownership, active session check, rate limiting, enum validation
- `POST /api/violations`: server-side auto-submit on violation_count >= 5 (sets `status: "completed"`)
- Live page: passes `violationType` + `remainingCount` to modal
- Live page: `autoSubmittedRef` once-guard prevents duplicate auto-submit calls

**Code-verified (tsc/lint/build pass):**
- `npx tsc --noEmit` — clean (0 errors)
- `npm run lint` — 15 pre-existing issues, 0 new from Phase 5
- `npm run build` — clean (21 routes + proxy)

**Requires live Supabase (cannot verify without database):**
- `increment_violation_count` RPC exists and works atomically
- `auto_submitted` column exists on `exam_sessions` table
- Rate limiting map survives across serverless invocations (currently in-memory, resets on cold start)
- Violation count increment race condition (exists without RPC migration)

**Requires E2E testing:**
- Fullscreen exit auto-submit triggers correctly after 2nd exit
- Violation count auto-submit triggers correctly after 5th violation
- Background time auto-submit triggers correctly after 15s cumulative
- Server rejects violations for completed sessions (409)
- Server rejects violations for unauthenticated users (401)
- Server rejects violations for wrong user's session (403)
- Violation modal shows correct type + remaining count
- Auto-submit cannot be triggered multiple times (once-guard)
- Manual submit + anti-cheat auto-submit race is safe
- Timer expiry auto-submit still works correctly

**Requires production testing:**
- Rate limiting under real serverless cold-start conditions
- Fullscreen API behavior across different browsers (Chrome, Firefox, Safari)
- `visibilitychange` behavior across different browsers
- Keyboard shortcut blocking across different browsers
- Performance impact of 250ms interval timer on battery/CPU

### 5.13 Phase 6 — Database Security & Row Level Security Hardening (correction pass complete)

**Critical issues found and corrected (initial pass was too permissive):**

| Issue | Severity | Initial Pass | Correction |
|---|---|---|---|
| Student UPDATE on exam_sessions — students can forge status/violation_count | CRITICAL | Allowed student UPDATE own sessions | **REMOVED** — no student UPDATE policy. All mutations via SECURITY DEFINER functions |
| Student INSERT on submissions — students can forge scores | CRITICAL | Allowed student INSERT own submissions | **REMOVED** — no student INSERT policy. All inserts via `insert_submission()` SECURITY DEFINER |
| `solution_code` readable by students via browser console | CRITICAL | Documented as "known limitation" | **FIXED** — moved to `question_solutions` table with no student RLS policy |
| Hidden test_cases readable by students via browser console | CRITICAL | Documented as "known limitation" | **FIXED** — student SELECT restricted to `is_sample = true`; hidden cases protected at DB level |
| `increment_violation_count` RPC missing ownership verification | HIGH | RPC accepted any session_id | **FIXED** — added `p_user_id` parameter + ownership check |
| No admin policies — admin pages would break under RLS | CRITICAL | Added admin ALL policies | Unchanged (correct) |
| Role escalation via profiles UPDATE | CRITICAL | Added WITH CHECK preventing role change | Unchanged (correct) |
| violations INSERT missing session ownership check | HIGH | Added EXISTS check | Unchanged (correct) |

**Security matrix (corrected RLS migration):**

| Table | Student SELECT | Student INSERT | Student UPDATE | Student DELETE | Admin |
|---|---|---|---|---|---|
| profiles | own only | trigger only | own only (no role change) | none | ALL |
| exam_sessions | own only | own only | **NONE** (SECURITY DEFINER only) | none | ALL |
| submissions | own only | **NONE** (SECURITY DEFINER only) | **NONE** | none | ALL |
| violations | own only | own (with session check) | none | none | ALL |
| questions | active only | none | none | none | ALL |
| test_cases | **sample only** (`is_sample = true`) | none | none | none | ALL |
| settings | all | none | none | none | ALL |
| student_assignments | own only | none | none | none | ALL |
| **question_solutions** | **NONE** (admin only) | none | none | none | ALL |

**New table: `question_solutions`**
- Stores `solution_code` separately from `questions` table
- No student SELECT policy = students cannot read solution_code via browser console
- Admin ALL policy = admin pages can read/write
- Evaluate endpoint reads via `get_question_solution()` SECURITY DEFINER function

**SECURITY DEFINER functions (bypass RLS, verify ownership internally):**

| Function | Purpose | Ownership Check |
|---|---|---|
| `get_all_test_cases(uuid)` | Read ALL test cases for grading | None (called by authenticated server API) |
| `get_question_solution(uuid)` | Read solution_code for grading | None (called by authenticated server API) |
| `start_exam_session(uuid, uuid)` | Transition pending → in_progress | Verifies session belongs to caller |
| `complete_exam_session(uuid, uuid, boolean)` | Transition in_progress → completed | Verifies session belongs to caller |
| `insert_submission(uuid, uuid, uuid, text, text, ...)` | Insert graded submission | Verifies session belongs to caller + status is in_progress |
| `increment_violation_count(uuid, uuid)` | Atomic violation count increment | Verifies session belongs to caller |
| `get_leaderboard_data(integer)` | Aggregate leaderboard data | None (returns non-sensitive columns only) |

**Files changed (correction pass):**
- `supabase/migrations/20260819_rls_exam_tables.sql` — complete rewrite: removed student UPDATE on exam_sessions, removed student INSERT on submissions, restricted test_cases to sample-only, added `question_solutions` table, added 7 SECURITY DEFINER functions
- `supabase/migrations/20260822_add_violation_rpc_and_auto_submitted.sql` — added `p_user_id` parameter + ownership verification to `increment_violation_count`
- `src/app/api/exam-sessions/route.ts` — rewritten to use `start_exam_session()` and `complete_exam_session()` SECURITY DEFINER functions instead of direct UPDATE
- `src/app/api/submissions/evaluate/route.ts` — rewritten to use `get_all_test_cases()` for hidden test cases and `insert_submission()` for submission insert
- `src/app/api/violations/route.ts` — rewritten to use `increment_violation_count()` with ownership check and `complete_exam_session()` for auto-submit; removed fallback direct UPDATE
- `src/app/api/leaderboard/route.ts` — uses `get_leaderboard_data()` SECURITY DEFINER function (unchanged from initial pass)
- `src/types/database.ts` — added `question_solutions` table types

**Migration dependency graph (CRITICAL — must be applied in this order):**
```
20260820_add_session_duration_minutes.sql
        ↓
20260821_submissions_unique_constraint.sql
        ↓
20260822_add_violation_rpc_and_auto_submitted.sql
        ↓
20260819_rls_exam_tables.sql  (MUST be last — enables RLS + creates functions)
        ↓
20260823_leaderboard_fix_and_assignment_enforcement.sql  (Phase 8 — overrides get_leaderboard_data + start_exam_session)
```
Each arrow means "must be applied before". Applying RLS before schema migrations will cause errors. Phase 8 migration (20260823) must be applied after 20260819 because it uses `CREATE OR REPLACE` on functions defined there.

**Threat model — database-level protection:**

| Attack Vector | Protected? | Mechanism |
|---|---|---|
| Student queries `solution_code` via browser console | ✅ YES | `question_solutions` table has no student RLS policy |
| Student queries hidden test_cases via browser console | ✅ YES | `test_cases` SELECT policy restricts to `is_sample = true` |
| Student forges submission scores via browser console | ✅ YES | No student INSERT policy on `submissions`; `insert_submission()` verifies session ownership + status |
| Student changes own role to 'admin' via browser console | ✅ YES | profiles UPDATE WITH CHECK prevents role changes |
| Student updates exam_sessions status via browser console | ✅ YES | No student UPDATE policy on `exam_sessions`; all mutations via SECURITY DEFINER functions |
| Student inserts violations for another student's session | ✅ YES | violations INSERT policy checks session ownership |
| Student reads other students' data via browser console | ✅ YES | All SELECT policies restrict to `auth.uid() = user_id` |
| Student bypasses round unlock check | ✅ YES | Server-side `requireRoundUnlocked()` enforces timing |
| Student submits after session expiry | ✅ YES | Server-side `isSessionExpired()` rejects expired submissions |

**Direct browser Supabase access audit (admin pages):**

| Admin Page | Operations | RLS Protection |
|---|---|---|
| `admin/page.tsx` | SELECT profiles, exam_sessions, submissions, violations counts + Realtime | Admin ALL policy allows reads |
| `admin/questions/page.tsx` | SELECT/INSERT/UPDATE/DELETE questions + test_cases + question_solutions | Admin ALL policy allows all ops |
| `admin/settings/page.tsx` | SELECT/UPSERT/UPDATE settings | Admin ALL policy allows all ops |
| `admin/leaderboard/page.tsx` | fetch("/api/leaderboard") → SECURITY DEFINER function | Function bypasses RLS |

**Server/API compatibility (corrected):**

| Route | RLS Impact | Function Used | Compatible? |
|---|---|---|---|
| POST /api/exam-sessions | INSERT on exam_sessions + `start_exam_session()` RPC | `start_exam_session` | ✅ |
| PATCH /api/exam-sessions | `start_exam_session()` or `complete_exam_session()` RPC | SECURITY DEFINER | ✅ |
| POST /api/submissions/evaluate | `get_all_test_cases()` + `insert_submission()` RPCs | SECURITY DEFINER | ✅ |
| POST /api/violations | INSERT on violations + `increment_violation_count()` + `complete_exam_session()` | SECURITY DEFINER | ✅ |
| GET /api/questions | SELECT on questions (active) | RLS | ✅ |
| POST/PUT/DELETE /api/questions | Admin policy allows all | RLS admin | ✅ |
| GET /api/settings | SELECT on settings (all) | RLS | ✅ |
| GET /api/leaderboard | `get_leaderboard_data()` SECURITY DEFINER | SECURITY DEFINER | ✅ |

**Verification results:**
- `npx tsc --noEmit` — clean (0 errors)
- `npm run lint` — 15 pre-existing issues, 0 new from Phase 6 correction
- `npm run build` — clean (21 routes + proxy)

**Requires live Supabase verification:**
- All RLS policies enforce correctly
- Admin policies allow admin browser client operations
- Student isolation prevents cross-student data access
- SECURITY DEFINER functions bypass RLS correctly
- `question_solutions` table blocks student read access to solution_code
- `test_cases` RLS blocks student read access to hidden test cases
- `insert_submission()` prevents forged scores at database level
- `start_exam_session()` / `complete_exam_session()` enforce state machine at database level
- `increment_violation_count()` verifies ownership before incrementing
- Role escalation prevention blocks students from setting `role = 'admin'`
- Session ownership check on violations INSERT prevents cross-session violations
- Realtime subscriptions respect RLS

**Requires E2E testing:**
- Admin can read/write questions, test_cases, question_solutions, settings via browser client
- Admin dashboard shows correct counts (all students, not just own)
- Student cannot read other students' submissions/sessions/violations
- Student cannot read solution_code via browser console (question_solutions table)
- Student cannot read hidden test_cases via browser console (is_sample filter)
- Student cannot change their own role to 'admin'
- Student cannot insert violations for other students' sessions
- Student cannot forge submission scores (INSERT blocked at DB level)
- Student cannot change exam session status (UPDATE blocked at DB level)
- Leaderboard shows all students' rankings correctly
- Evaluate endpoint grades against hidden test cases (via SECURITY DEFINER)
- Auto-submit via violations route completes session correctly (via SECURITY DEFINER)
- Realtime updates work for admin dashboard

### 5.14 Phase 7 — Piston Execution Reliability & Scalability (complete)

**Audit findings (critical issues fixed):**

| Issue | Severity | Location | Fix |
|---|---|---|---|
| evaluate/route.ts calls Piston with no AbortController — hung Piston blocks submission indefinitely | CRITICAL | `evaluate/route.ts` | Added per-test AbortController via `executeCodeDirect()` with 25s timeout |
| evaluate/route.ts has no malformed Piston response handling — crashes on `data.run?.stdout` | HIGH | `evaluate/route.ts` | Added null checks: `result.run?.stdout ?? ""`, `result.run?.wall_time` |
| execute/route.ts has no request body size limit — huge code crashes serverless | HIGH | `execute/route.ts` | Added `MAX_REQUEST_BODY_BYTES = 100KB` check + `content-length` header check |
| execute/route.ts has no AbortController — hung Piston blocks indefinitely | HIGH | `execute/route.ts` | Added `AbortController` with `PISTON_TIMEOUT_MS = 30s` |
| No source code size limit anywhere — massive code exhausts Piston memory | MEDIUM | `piston.ts`, `execute/route.ts`, `evaluate/route.ts`, `live/page.tsx` | Added `MAX_SOURCE_CODE_BYTES = 50KB` check in all 4 files |
| No language validation — unsupported languages sent to Piston cause confusing errors | MEDIUM | `execute/route.ts` | Added `isSupportedLanguage()` check (python, java, c, cpp) |
| No error type classification — all errors returned as generic strings | MEDIUM | `piston.ts`, `execute/route.ts` | Added `error_type` field: compile, runtime, timeout, unavailable, malformed, unknown |
| execute/route.ts doesn't handle non-JSON Piston responses | MEDIUM | `execute/route.ts` | Added try/catch around `pistonResponse.json()` with "malformed" error type |
| piston.ts unused `PISTON_URL` constant | LOW | `piston.ts` | Removed (client calls `/api/execute`, server uses parameter) |

**Execution architecture (before vs after):**

```
BEFORE:
  Client Run  → executeCode() → POST /api/execute → fetch(PISTON_URL) [no timeout, no size limit]
  Client Submit → autoSubmit() → POST /api/submissions/evaluate → for each test: fetch(PISTON_URL) [no timeout, sequential, no error classification]

AFTER:
  Client Run  → executeCode() → POST /api/execute → fetch(PISTON_URL) [30s timeout, size limit, language validation, malformed response handling]
  Client Submit → autoSubmit() → POST /api/submissions/evaluate → for each test: executeCodeDirect() [25s per-test timeout, size limit, error classification, Piston unavailability detection]
```

**Timeout strategy:**

| Layer | Timeout | Behavior on timeout |
|---|---|---|
| Client Run button (`executeCode`) | 30s | Returns `PistonError` with `error_type: "timeout"` to UI |
| Server `/api/execute` (per test) | 30s | Returns 502 with `error_type: "timeout"` |
| Server `/api/submissions/evaluate` (per test case) | 25s via `executeCodeDirect` | Marks test as failed, continues to next test. If Piston unavailable, skips remaining tests. |
| Overall evaluate request | No hard cap (sum of per-test timeouts) | Worst case: N tests × 25s. For 10 tests = ~4 min. Acceptable for 30-min exam. |

**Error classification model:**

```typescript
error_type: "compile" | "runtime" | "timeout" | "unavailable" | "malformed" | "unknown"
```

| Type | Meaning | Client action |
|---|---|---|
| compile | Syntax error in user code | Show error, student can fix |
| runtime | Runtime error (non-zero exit code) | Show stderr/exit code |
| timeout | Piston or execution timed out | Show timeout message, suggest retry |
| unavailable | Piston API unreachable or rate limited | Show "execution server unavailable" |
| malformed | Piston returned invalid/unexpected response | Show "execution server error" |
| unknown | Unclassified error | Show raw error message |

**Resource limits:**

| Limit | Value | Enforced at |
|---|---|---|
| Source code size | 50,000 bytes (~50 KB) | Client, server `/api/execute`, server `/api/submissions/evaluate` |
| Request body size | 100,000 bytes (~100 KB) | Server `/api/execute` |
| Supported languages | python, java, c, cpp | Server `/api/execute` |
| Piston execution timeout | 30 seconds (Run), 25 seconds (Evaluate) | Client `executeCode()`, server `executeCodeDirect()` |
| Piston API request body | Unchanged (Piston default) | Piston server |

**Concurrency analysis for 100–200 students:**

| Bottleneck | Current behavior | Impact at 200 students | Mitigation |
|---|---|---|---|
| Piston API (public) | Each test case = 1 HTTP request. Sequential per student. | 200 students × 2 questions × ~5 test cases = ~2,000 sequential Piston calls. If each takes 2s, peak = ~2,000 × 2s = ~4,000s total Piston time, distributed across concurrent requests. | Public Piston has rate limiting. **Recommendation:** self-host Piston via Docker for production. |
| Vercel serverless | Each `/api/execute` and `/api/submissions/evaluate` = 1 serverless function invocation. | Vercel free tier: 10 concurrent executions. 200 students clicking Run simultaneously = 100 concurrent requests. | Free tier may queue requests. Consider Vercel Pro or self-hosting. |
| Sequential test execution | Tests run one-by-one in a for loop. | 10 tests × 25s timeout = 250s worst case per student. | Acceptable for 30-min exam. Could parallelize but increases Piston load. |
| Auto-submit storm | 200 students auto-submitting at timer expiry simultaneously. | 200 × 2 evaluate calls = 400 Piston calls in rapid succession. | Sequential per student; Piston handles queuing. |
| Cold start | Vercel serverless cold start on first invocation. | First 10 students may experience 1-2s cold start delay. | Acceptable; subsequent requests are warm. |

**Duplicate execution protection:**

| Guard | Location | Behavior |
|---|---|---|
| `isRunning` state | `live/page.tsx` | Disables Run button while executing. Prevents rapid successive clicks. |
| `autoSubmittedRef` | `live/page.tsx` | React ref prevents multiple auto-submit calls. Not persisted — server status check prevents double-grading. |
| `submitted` state | `live/page.tsx` | Disables Run + Submit after submission. |
| Idempotency check | `evaluate/route.ts` | Returns stored result if question already graded for this session. |
| Session completion guard | `evaluate/route.ts` | Returns 409 if session already completed. |
| Server auto-submit guard | `violations/route.ts` | `WHERE status = 'in_progress'` prevents double-completion. |

**Retry strategy:**

| Scenario | Server retry | Client retry |
|---|---|---|
| Transient Piston failure (5xx) | **No automatic retry** — returns error to client. Student can click Run again. | Manual: student clicks Run again after seeing error. |
| Piston timeout | **No retry** — per-test timeout returns error. Student can click Run again. | Manual: student clicks Run again. |
| Piston unavailable (ECONNREFUSED) | **No retry** — marks all remaining tests as failed. | Manual: student clicks Run again. If persistent, Piston is down. |
| Network failure (client→server) | N/A (client-side) | Manual: student clicks Run again. |
| Evaluate timeout on one test | **No retry for that test** — marks as failed, continues to next test. | N/A (server-side). |
| Auto-submit failure | **One retry** for session completion (`completeSession` called twice). | N/A (server-side). |

**Rationale for no automatic retries:**
- Piston calls are expensive (CPU + memory on execution server).
- Automatic retries amplify load during Piston instability (thundering herd).
- Students can manually retry — they see the error and decide whether to retry.
- For hidden evaluation, a failed test is scored as 0 — this is correct behavior (the code didn't pass).
- For auto-submit, one retry for session completion is sufficient (prevents stuck sessions).

**Files changed:**
- `src/lib/piston.ts` — removed unused `PISTON_URL`, added `MAX_SOURCE_CODE_BYTES`, `PISTON_TIMEOUT_MS`, `EVALUATE_PER_TEST_TIMEOUT_MS`, `SUPPORTED_LANGUAGES`, `isSupportedLanguage()`, `getSourceCodeSizeBytes()`, `classifyPistonError()`, `executeCodeDirect()`, malformed response handling in `executeCode()`
- `src/app/api/execute/route.ts` — added `AbortController` with 30s timeout, `MAX_REQUEST_BODY_BYTES` check, language validation, source code size validation, malformed JSON/response handling, `error_type` field in all error responses
- `src/app/api/submissions/evaluate/route.ts` — replaced direct Piston fetch with `executeCodeDirect()` (25s per-test timeout), added source code size validation, added `pistonUnavailable` flag to skip remaining tests when Piston is down, added empty test cases check, removed unused `PISTON_URL` constant
- `src/app/dashboard/exam/[examId]/live/page.tsx` — added client-side `getSourceCodeSizeBytes()` check before Run, imported `MAX_SOURCE_CODE_BYTES`

**Verification results:**
- `npx tsc --noEmit` — clean (0 errors)
- `npm run lint` — 14 pre-existing issues (3 errors, 11 warnings), 0 new from Phase 7 (reduced from 15 by removing unused `PISTON_URL`)
- `npm run build` — clean (21 routes + proxy)

**Code-level verification matrix:**

| Scenario | Classification | Status |
|---|---|---|
| Successful sample run | Happy path | Code-verified (executeCode + /api/execute + Piston) |
| Compile error | `error_type: "runtime"` | Code-verified (non-zero exit code, stderr captured) |
| Runtime error | `error_type: "runtime"` | Code-verified (non-zero exit code, stderr captured) |
| Timeout (30s) | `error_type: "timeout"` | Code-verified (AbortController abort → catch → classified) |
| Malformed Piston response | `error_type: "malformed"` | Code-verified (try/catch json parse + null check on `run` field) |
| Piston unavailable | `error_type: "unavailable"` | Code-verified (ECONNREFUSED → classified, `pistonUnavailable` flag skips remaining tests) |
| Hidden test evaluation | Sequential per-test with 25s timeout | Code-verified (`executeCodeDirect` in evaluate loop) |
| Simultaneous Run clicks | `isRunning` guard prevents | Code-verified (button disabled while running) |
| Simultaneous Submit clicks | `autoSubmittedRef` once-guard + idempotency | Code-verified (ref check + server-side idempotent return) |
| Retry after transient failure | Manual retry via Run button | Code-verified (no auto-retry, student clicks again) |
| 100–200 user architecture | Documented bottlenecks | Requires production testing |
| Server cleanup after aborted execution | AbortController clearTimeout in `finally` | Code-verified (all paths clear timeout) |

**Requires live Supabase verification:**
- `get_all_test_cases()` SECURITY DEFINER returns correct test cases for evaluate endpoint
- `insert_submission()` SECURITY DEFINER correctly inserts graded results
- Evaluate endpoint correctly grades hidden test cases via direct Piston calls

**Requires production testing:**
- Piston API behavior under 100+ concurrent requests (rate limiting, response times)
- Vercel serverless cold start impact on first 10-20 students
- Auto-submit storm behavior when 100+ students hit timer expiry simultaneously
- Public Piston API rate limits under real competition load
- Self-hosted Piston Docker container capacity (if deployed)


### 5.15 Phase 8 — Leaderboard, Settings & Application Cleanup (complete)

**Audit findings (all fixed):**

| Issue | Severity | Location | Fix |
|---|---|---|---|
| Server `DEFAULT_SETTINGS` uses wrong unlock dates (`2026-08-08`) — admin page and PRD specify `2026-08-07` | HIGH | `src/lib/supabase/server.ts` | Aligned defaults to `"2026-08-07T08:15:00Z"` / `"2026-08-07T09:00:00Z"` |
| Exam entry page hardcodes "30-minute countdown" instead of reading from settings | MEDIUM | `src/app/dashboard/exam/[examId]/page.tsx` | Changed to dynamic `{settings?.exam1_duration_minutes}` / `{settings?.exam2_duration_minutes}` |
| Leaderboard RPC filters by `is_submitted = true` — should use `status = 'completed'` (semantically authoritative) | LOW | `supabase/migrations/20260819_rls_exam_tables.sql` | `get_leaderboard_data()` now filters `es.status = 'completed'` |
| No student assignment enforcement — any authenticated student can start any exam | HIGH | `supabase/migrations/20260819_rls_exam_tables.sql` | `start_exam_session()` now checks `student_assignments` table; blocks if assignments exist but student not assigned |
| Dead `POST /api/submissions` returns 410 Gone | NONE | `src/app/api/submissions/route.ts` | Correctly disabled — no change needed |
| Admin settings page uses direct Supabase client | NONE | `src/app/admin/settings/page.tsx` | Correct — RLS admin policy allows; no API needed |
| Admin dashboard Settings icon | NONE | `src/app/admin/page.tsx` | Locally defined SVG component — no circular reference |
| `duration_minutes` nullable on exam_sessions | NONE | DB schema | Server `getDurationMinutes()` falls back to settings — correct |

**Settings defaults alignment:**

| Source | exam1_unlock_at | exam2_unlock_at | Status |
|---|---|---|---|
| PRD | 2026-08-07T08:15:00Z (13:45 IST) | 2026-08-07T09:00:00Z (14:30 IST) | Authoritative |
| Server `DEFAULT_SETTINGS` | ~~2026-08-08T08:15:00Z~~ | ~~2026-08-08T09:00:00Z~~ | **Fixed → 2026-08-07** |
| Admin page defaults | 2026-08-07T08:15:00Z | 2026-08-07T09:00:00Z | Already correct |
| `/api/settings` fallback | Uses server `DEFAULT_SETTINGS` | Uses server `DEFAULT_SETTINGS` | **Fixed** (inherits server fix) |

**Student assignment enforcement:**

```sql
-- start_exam_session() now checks:
-- 1. Get exam_number from session
-- 2. Count assignments for this exam
-- 3. If assignments exist AND student not assigned → RAISE EXCEPTION
-- 4. If no assignments exist (exam unrestricted) → allow all students
```

This means:
- Before assignments are created: all students can start any exam (backwards compatible)
- After admin creates assignments for an exam: only assigned students can start
- Existing sessions are unaffected (function only runs on `pending → in_progress` transition)

**Leaderboard ranking logic (unchanged, verified deterministic):**

| Rank criterion | Direction | SQL expression |
|---|---|---|
| 1. Hidden test pass rate | DESC | `SUM(hidden_tests_passed) / SUM(hidden_tests_total)` |
| 2. Total execution time | ASC | `SUM(execution_time_ms)` |
| 3. Total time taken | ASC | `EXTRACT(EPOCH FROM MAX(submitted_at) - MIN(started_at))` |

**Files changed:**
- `src/lib/supabase/server.ts` — fixed `DEFAULT_SETTINGS` dates to match PRD
- `src/app/dashboard/exam/[examId]/page.tsx` — dynamic duration in warning message
- `supabase/migrations/20260823_leaderboard_fix_and_assignment_enforcement.sql` — new migration: overrides `get_leaderboard_data()` (status filter) + `start_exam_session()` (assignment enforcement)

**Verification results:**
- `npx tsc --noEmit` — clean (0 errors)
- `npm run lint` — 14 pre-existing issues (3 errors, 11 warnings), 0 new from Phase 8
- `npm run build` — clean (21 routes + proxy)

**Requires live Supabase verification:**
- `start_exam_session()` assignment check works correctly with `student_assignments` data
- `get_leaderboard_data()` returns correct results with `status = 'completed'` filter
- Migration 20260823 applies cleanly after 20260819

**Requires production testing:**
- Student without assignment cannot start a restricted exam
- Student with assignment can start normally
- Exam without any assignments allows all students (backwards compatible)
- Leaderboard shows only completed sessions (not partial submissions)


### 5.16 Phase 9 — Automated Testing & Regression Coverage (complete)

**Test framework:** Vitest 5.0.0 (with Vite, @vitest/coverage-v8)

**Test configuration:**
- `vitest.config.ts` — path aliases matching `tsconfig.json` (`@/` → `./src/`)
- `package.json` — `test`, `test:watch`, `test:coverage` scripts
- Environment: node
- Test pattern: `src/**/*.test.ts`

**Test categories and counts:**

| Category | File | Tests | Status |
|---|---|---|---|
| Piston helpers | `src/lib/__tests__/piston.test.ts` | 33 | ✅ PASS |
| Timing helpers | `src/lib/__tests__/timing.test.ts` | 10 | ✅ PASS |
| Anti-cheat thresholds | `src/lib/__tests__/violation-thresholds.test.ts` | 17 | ✅ PASS |
| Exam sessions state machine | `src/app/api/__tests__/exam-sessions.test.ts` | 24 | ✅ PASS |
| Submissions/evaluate logic | `src/app/api/__tests__/submissions.test.ts` | 20 | ✅ PASS |
| Security regression | `src/app/api/__tests__/security.test.ts` | 13 | ✅ PASS |
| Violations API logic | `src/app/api/__tests__/violations.test.ts` | 23 | ✅ PASS |
| Piston execute API | `src/app/api/__tests__/execute.test.ts` | 21 | ✅ PASS |
| Questions API | `src/app/api/__tests__/questions.test.ts` | 14 | ✅ PASS |
| Leaderboard ranking | `src/app/api/__tests__/leaderboard.test.ts` | 8 | ✅ PASS |
| Settings contract | `src/app/api/__tests__/settings.test.ts` | 7 | ✅ PASS |
| **Total** | **11 files** | **190** | **ALL PASS** |

**Scenarios covered per category:**

**1. Piston helpers (33 tests):**
- `isSupportedLanguage`: python, java, c, cpp accepted; javascript, ruby, go, rust, typescript, "" rejected
- `getSourceCodeSizeBytes`: empty, ASCII, multi-byte UTF-8, boundary (50KB exact), over-limit
- `normalizeOutput`: trim, CRLF→LF, newlines preserved, empty, whitespace-only
- `evaluateTestCase`: match, mismatch, PistonError, non-zero exit code with stderr
- `getLanguagePistonId`: all 4 languages + fallback
- `getLanguageMonacoId`: all 4 languages + fallback
- `getLanguageFileExtension`: all 4 languages + fallback
- Constants: MAX_SOURCE_CODE_BYTES (50KB), PISTON_TIMEOUT_MS (30s), EVALUATE_PER_TEST_TIMEOUT_MS (25s)

**2. Timing helpers (10 tests):**
- `getDurationMinutes`: exam 1, exam 2
- `isSessionExpired`: within duration, exceeded, snapshot vs settings fallback, exact boundary (just expired, just not expired)
- Settings defaults alignment: PRD dates, duration defaults

**3. Anti-cheat thresholds (17 tests):**
- Fullscreen exit: 0→no, 1→no, 2→yes, 3→yes
- Background time: below, at, above 15s threshold
- Violation count: 0, 1, 4, 5, 10
- Remaining count calculation
- Warning/auto-submit timing constants

**4. Exam sessions state machine (24 tests):**
- Valid transitions: pending→in_progress, in_progress→completed
- Invalid transitions: completed→in_progress, completed→pending, in_progress→pending, pending→completed
- POST behavior: invalid exam_number (0, 3), valid (1, 2), completed session block, in_progress resume, pending transition
- PATCH behavior: missing id, missing status, non-existent session, mismatched ownership, invalid transition
- Duration snapshot: session uses snapshot, null fallback to settings

**5. Submissions/evaluate (20 tests):**
- Input validation: missing question_id, code, exam_session_id; empty code
- Source code size: within limit, over 50KB limit
- Session guards: completed session (409), expired session (400), unauthorized session (403)
- Idempotency: existing graded submission returns stored result, no existing proceeds
- Piston unavailability: flag set on unavailable, skips remaining tests, processes when available
- Grading logic: allPassed with hidden+sample, failed on hidden, failed on sample, no hidden tests
- Auto-submit flow: 409 breaks loop

**6. Security regression (13 tests):**
- Authentication boundary: unauthenticated → 401
- Admin boundary: non-admin → 403
- Session ownership: mismatched → 403, non-existent → 404
- Data leak prevention: solution_code stripped from questions, sample-only filter on test_cases, hidden test inputs never in evaluate response, leaderboard non-sensitive fields only
- State machine: valid/invalid transitions documented
- Dead route: 410 for POST /api/submissions
- Input validation: violation type enum, exam_number 1|2 only

**7. Violations API (23 tests):**
- Rate limiting: within window (0→yes, 9→yes, 10→no, 20→no), after window reset
- Auto-submit threshold: below (4), at (5), above (6)
- Type validation: 5 valid types, 5 invalid types
- Session status: in_progress allowed, completed/pending rejected
- Count computation: increment, threshold crossing, already at threshold

**8. Execute API (21 tests):**
- Body size: within 100KB, over 100KB
- Code size: within 50KB, over 50KB
- Language validation: 4 accepted, 2 rejected
- Response handling: success, compile error, malformed (missing run), valid
- Timeout: AbortError vs other errors
- Error classification: timeout, compile, unavailable, malformed, unknown (5 scenarios)

**9. Questions API (14 tests):**
- GET: authentication, exam filter, solution_code stripped, active-only filter
- POST: admin required, student rejected
- GET/[id]: authentication, sample-only filter, solution_code stripped, unlock enforcement
- PUT/DELETE: admin required
- GET/[id]/samples: authentication, sample-only, inactive rejection

**10. Leaderboard ranking (8 tests):**
- Pass rate priority: higher rate ranks first
- Execution time tiebreaker: faster ranks first
- Time taken tiebreaker: less time ranks first
- Edge cases: 0/0 hidden (no submissions), empty, single entry
- Determinism: same data produces same order
- Three-way tie: rate → exec time → time taken

**11. Settings contract (7 tests):**
- Default alignment: PRD dates, 30 min duration, anti-cheat enabled, pooling disabled
- Shape: all required fields present, valid ISO strings, positive integer duration

**Files created:**
- `vitest.config.ts`
- `src/lib/__tests__/piston.test.ts`
- `src/lib/__tests__/timing.test.ts`
- `src/lib/__tests__/violation-thresholds.test.ts`
- `src/lib/__tests__/mocks.ts`
- `src/app/api/__tests__/exam-sessions.test.ts`
- `src/app/api/__tests__/submissions.test.ts`
- `src/app/api/__tests__/security.test.ts`
- `src/app/api/__tests__/violations.test.ts`
- `src/app/api/__tests__/execute.test.ts`
- `src/app/api/__tests__/questions.test.ts`
- `src/app/api/__tests__/leaderboard.test.ts`
- `src/app/api/__tests__/settings.test.ts`

**Files modified:**
- `package.json` — added `test`, `test:watch`, `test:coverage` scripts; added `vitest`, `@vitest/coverage-v8`, `vite` devDependencies

**Coverage classification:**

| Category | Coverage level | Notes |
|---|---|---|
| Authentication boundary | ✅ Code-verified | getAuthUser() return shapes mocked and tested |
| Authorization boundary | ✅ Code-verified | requireAdmin() return shapes mocked and tested |
| Session ownership | ✅ Code-verified | requireSessionOwnership() return shapes mocked and tested |
| Exam session state machine | ✅ Code-verified | All valid/invalid transitions tested |
| Submission idempotency | ✅ Code-verified | Existing/no-existing paths tested |
| Submission session guards | ✅ Code-verified | Completed/expired/unauthorized tested |
| Piston error classification | ✅ Code-verified | 5 error types tested |
| Source code size validation | ✅ Code-verified | Boundary and over-limit tested |
| Language validation | ✅ Code-verified | 4 accepted, 2 rejected |
| Leaderboard ranking | ✅ Code-verified | All ranking criteria and edge cases tested |
| Settings defaults | ✅ Code-verified | PRD alignment verified |
| Anti-cheat threshold logic | ✅ Code-verified | All 3 thresholds tested (math only) |
| Data leak prevention | ✅ Code-verified | Response shapes verified |
| Rate limiting | ✅ Code-verified | Window and max tested |

**Classification — what is NOT proven by unit tests:**

| Category | Classification | Requires |
|---|---|---|
| RLS policy enforcement | NOT tested | Live Supabase |
| SECURITY DEFINER functions | NOT tested | Live Supabase |
| Browser anti-cheat behavior | NOT tested | Phase 10 E2E |
| Realtime subscriptions | NOT tested | Phase 10 E2E |
| 100–200 concurrent users | NOT tested | Production load test |
| Supabase client mock accuracy | Partially tested | Live Supabase |

**Verification results:**
- `npx tsc --noEmit` — clean (0 errors)
- `npm run lint` — 17 pre-existing issues (3 errors, 14 warnings), 0 new from Phase 9
- `npm run build` — clean (21 routes + proxy)
- `npm test` — 190 tests, 11 files, all passing (279ms)

### 5.17 Phase 10 — Full End-to-End Browser Testing (complete)

**Framework:** Playwright 1.53.0 (Chromium, headless)

**Test configuration:**
- `playwright.config.ts` — `webServer` starts dev server on port 3000, Chromium project, `reuseExistingServer`
- `e2e/helpers.ts` — shared utilities: `signInViaAPI` (GoTrue REST bypass), `signOutViaAPI`, `assertPageLoads`, `assertNoErrorPage`
- Auth strategy: API-based sign-in via Supabase GoTrue REST API, sets `sb-access-token` and `sb-refresh-token` cookies
- Credentials: `TEST_STUDENT_EMAIL` / `TEST_STUDENT_PASSWORD` / `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` env vars

**Test categories and results (73 total):**

| Category | File | Tests | Passed | Skipped | Failed |
|---|---|---|---|---|---|
| Public pages smoke | `e2e/public-pages.spec.ts` | 10 | 10 | 0 | 0 |
| Authentication flow | `e2e/auth.spec.ts` | 12 | 4 | 8 | 0 |
| API contracts | `e2e/api-contract.spec.ts` | 11 | 11 | 0 | 0 |
| Exam lifecycle | `e2e/exam-lifecycle.spec.ts` | 10 | 0 | 10 | 0 |
| Admin dashboard | `e2e/admin.spec.ts` | 11 | 0 | 11 | 0 |
| Security boundaries | `e2e/security.spec.ts` | 19 | 13 | 6 | 0 |
| **Total** | **6 files** | **73** | **38** | **35** | **0** |

**Skipped tests classification (all properly documented):**

| Skip reason | Count | Env vars needed |
|---|---|---|
| Requires test student credentials | 24 | `TEST_STUDENT_EMAIL`, `TEST_STUDENT_PASSWORD` |
| Requires test admin credentials | 11 | `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD` |

**Public pages tests (10/10 pass):**
- Homepage loads with "Code Clash" text
- Login page: email/password fields, Sign In button, Google OAuth button, link to signup
- Signup page: email, password, confirm password fields, link to login
- Unauthenticated redirects from `/dashboard` and `/admin` to `/login`

**Authentication tests (4/4 pass, 8 skipped — no credentials):**
- Login page renders correctly (email, password, Sign In button)
- Signup page renders correctly
- Invalid credentials show error or stay on login
- All protected routes (`/dashboard`, `/admin`, `/admin/settings`, `/admin/questions`) redirect to `/login`

**API contract tests (11/11 pass):**
- 8 unauthenticated API calls return 401: `/api/settings`, `/api/leaderboard`, `/api/exam-sessions`, `/api/execute`, `/api/submissions/evaluate`, `/api/violations`, `/api/questions` (GET+POST)
- Dead `POST /api/submissions` returns 410 Gone
- 2 validation tests: invalid exam parameter and invalid exam_number return 400 or 401

**Security boundary tests (13/13 pass, 6 skipped — no credentials):**
- Route protection: unauthenticated users cannot reach `/dashboard`, `/admin`, `/admin/settings`, `/dashboard/exam/1/live`
- API security: all 9 endpoints require authentication
- Dead route enforcement: `POST /api/submissions` → 410
- Skipped: student cannot access admin (requires credentials), data leak prevention (requires credentials)

**Files created:**
- `playwright.config.ts`
- `e2e/helpers.ts`
- `e2e/public-pages.spec.ts`
- `e2e/auth.spec.ts`
- `e2e/api-contract.spec.ts`
- `e2e/exam-lifecycle.spec.ts`
- `e2e/admin.spec.ts`
- `e2e/security.spec.ts`

**Files modified:**
- `package.json` — added `@playwright/test` and `playwright` devDependencies

**Verification results:**
- `npx tsc --noEmit` — clean (0 errors)
- `npm run lint` — 15 pre-existing issues (3 errors, 12 warnings), 0 new from Phase 10
- `npm run build` — clean (21 routes + proxy)
- `npx playwright test` — 38 passed, 35 skipped (credentials required), 0 failed

**Remaining work:**
- Set `TEST_STUDENT_EMAIL`, `TEST_STUDENT_PASSWORD`, `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD` env vars to run authenticated E2E tests (35 tests currently skipped)
- Browser anti-cheat behavior: NOT tested in E2E (requires live session with real exam state)
- Realtime subscriptions: NOT tested in E2E (requires active exam session)

### 5.18 Phase 11 — Production Preparation & Deployment Readiness (complete)

**Production code audit results:**

| Issue | Severity | Location | Status |
|---|---|---|---|
| Settings API fallback dates wrong (`2026-08-08` instead of `2026-08-07`) | HIGH | `src/app/api/settings/route.ts:21-22` | **FIXED** — changed to `2026-08-07` |
| `.gitignore` blocks `.env.example` from being committed | MEDIUM | `.gitignore` | **FIXED** — added `!.env.example` exception |
| `.env.example` missing E2E test variables | LOW | `.env.example` | **FIXED** — added `TEST_*` and `BASE_URL` placeholders |
| `requireSessionOwnership()` defined but never used in routes | LOW | `src/lib/supabase/server.ts:111` | Documented — routes do manual ownership checks (functionally equivalent) |
| Mass assignment risk on questions POST/PUT (raw body → insert/update) | LOW | `src/app/api/questions/route.ts:56`, `[id]/route.ts:62` | Documented — admin-only routes, acceptable risk |
| `GET /api/questions/[id]/samples` missing round unlock enforcement | MEDIUM | `src/app/api/questions/[id]/samples/route.ts` | Documented — sample data only, no hidden tests exposed |
| In-memory rate limiter in violations route (resets on serverless cold start) | LOW | `src/app/api/violations/route.ts:16` | Documented — serverless limitation |
| 15 `console.error`/`console.warn` statements across codebase | INFO | Various | All are operational error logging (no `console.log`), acceptable |
| No hardcoded localhost URLs in production source | N/A | All `src/` files | Clean |
| No TODO/FIXME/HACK comments in production source | N/A | All `src/` files | Clean |

**Environment variable inventory:**

| Variable | Required | Server/Client | Where Referenced | Public | Secret |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Client | `client.ts`, `server.ts`, `middleware.ts`, `e2e/helpers.ts` | Yes (NEXT_PUBLIC_) | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client | `client.ts`, `server.ts`, `middleware.ts`, `e2e/helpers.ts` | Yes (NEXT_PUBLIC_) | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only | `scripts/seed-questions.ts` | No | **Yes** |
| `NEXT_PUBLIC_PISTON_URL` | No (default: `https://emkc.org/api/v2/piston`) | Client | `execute/route.ts`, `evaluate/route.ts` | Yes (NEXT_PUBLIC_) | No |
| `TEST_STUDENT_EMAIL` | No (E2E only) | Test | `e2e/helpers.ts` | No | No |
| `TEST_STUDENT_PASSWORD` | No (E2E only) | Test | `e2e/helpers.ts` | No | **Yes** |
| `TEST_ADMIN_EMAIL` | No (E2E only) | Test | `e2e/helpers.ts` | No | No |
| `TEST_ADMIN_PASSWORD` | No (E2E only) | Test | `e2e/helpers.ts` | No | **Yes** |
| `BASE_URL` | No (default: `http://localhost:3000`) | Test | `e2e/helpers.ts`, `playwright.config.ts` | No | No |

**GitHub readiness:**
- Repository: 1 commit on `main` branch
- `.gitignore` correctly excludes: `node_modules/`, `.next/`, `.env*` (except `.env.example`), `coverage/`, `.vercel/`, `*.tsbuildinfo`, `next-env.d.ts`
- No secrets in source code — `SUPABASE_SERVICE_ROLE_KEY` only used in `scripts/seed-questions.ts` (not committed)
- No `.env.local` in git (properly ignored)
- `package-lock.json` should be committed (ensures reproducible installs)
- E2E test artifacts (`test-results/`, `playwright-report/`) should NOT be committed

**What to commit:**
- All `src/` files
- `package.json`, `package-lock.json`
- `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`
- `vitest.config.ts`, `playwright.config.ts`
- `e2e/` directory
- `supabase/migrations/` directory
- `docs/PRD.md`
- `.env.example`
- `.gitignore`
- `README.md`

**What NOT to commit:**
- `.env.local` (contains real credentials)
- `node_modules/`
- `.next/`
- `coverage/`
- `.vercel/`
- `test-results/`, `playwright-report/`
- `*.tsbuildinfo`

**Next.js / Vercel readiness:**
- `npm run build` — clean (21 routes + proxy)
- `npx tsc --noEmit` — clean (0 errors)
- No filesystem assumptions (all data via Supabase)
- No serverless incompatibilities (all routes use standard Next.js patterns)
- Piston timeouts configured (30s Run, 25s Evaluate)
- Request body size limits enforced (100KB)
- Static pages: `/`, `/_not-found`, `/admin`, `/admin/leaderboard`, `/admin/questions`, `/admin/settings`, `/dashboard`, `/dashboard/onboarding`, `/login`, `/signup`
- Dynamic pages: all API routes, `/dashboard/exam/[examId]`, `/dashboard/exam/[examId]/live`, `/auth/callback`
- Classification: Code-verified (build passes), Requires Vercel deployment (actual runtime verification)

**Supabase migration inventory:**

| # | Filename | Purpose | Risk |
|---|---|---|---|
| 1 | `20260804_fix_handle_new_user_google_oauth.sql` | Google OAuth profile trigger (superseded by #2) | LOW |
| 2 | `20260804_fix_auth_profiles_complete.sql` | Definitive auth/profiles fix + RLS on profiles | LOW |
| 3 | `20260818_enable_realtime_publications.sql` | Enable Realtime on 4 tables | LOW |
| 4 | `20260820_add_session_duration_minutes.sql` | Add `duration_minutes` column to exam_sessions | LOW |
| 5 | `20260821_submissions_unique_constraint.sql` | Unique partial index on submissions | MEDIUM (must deduplicate first) |
| 6 | `20260822_add_violation_rpc_and_auto_submitted.sql` | `increment_violation_count` RPC + `auto_submitted` column | LOW |
| 7 | `20260819_rls_exam_tables.sql` | RLS + 7 SECURITY DEFINER functions + `question_solutions` table | **HIGH** (MUST be last) |
| 8 | `20260823_leaderboard_fix_and_assignment_enforcement.sql` | Override leaderboard + assignment enforcement | LOW |

**Migration dependency order (CRITICAL):**
```
20260804_fix_handle_new_user_google_oauth.sql  (superseded, can skip)
    ↓
20260804_fix_auth_profiles_complete.sql  (applied by user already)
    ↓
20260818_enable_realtime_publications.sql
    ↓
20260820_add_session_duration_minutes.sql
    ↓
20260821_submissions_unique_constraint.sql  (deduplicate first!)
    ↓
20260822_add_violation_rpc_and_auto_submitted.sql
    ↓
20260819_rls_exam_tables.sql  *** MUST be renamed to sort after 20260822 ***
    ↓
20260823_leaderboard_fix_and_assignment_enforcement.sql
```

**CRITICAL:** `20260819_rls_exam_tables.sql` must be renamed (e.g., `20260824_rls_exam_tables.sql`) before applying, because Supabase applies migrations in filename order and this file must come AFTER `20260820`, `20260821`, `20260822`.

**Production database data plan (manual seeding checklist):**

SCHEMA (migrations):
- Apply migrations 3-8 in dependency order (see above)

DATA (settings):
```sql
INSERT INTO settings (id, is_anti_cheat_enabled, exam1_unlock_at, exam2_unlock_at, 
  exam1_duration_minutes, exam2_duration_minutes, exam1_pool_questions, exam2_pool_questions)
VALUES (1, true, '2026-08-07T08:15:00Z', '2026-08-07T09:00:00Z', 30, 30, false, false)
ON CONFLICT (id) DO NOTHING;
```

DATA (questions — via seed script):
```bash
npm run seed
```
Or manually insert via Supabase dashboard SQL editor.

DATA (admin profile):
```sql
-- After admin signs up via the app, update their role:
UPDATE profiles SET role = 'admin' WHERE email = '<ADMIN_EMAIL>';
```

TEST ACCOUNTS:
- Admin: Sign up via app → run UPDATE query above
- Test student: Sign up via app → fill onboarding form

REAL PARTICIPANTS:
- Students sign up via `/signup` (email/password) or Google OAuth
- Admin creates assignments via dashboard if needed

**Google OAuth configuration (manual steps):**
1. **Google Cloud Console:** Create OAuth 2.0 Client ID (Web application)
2. **Authorized redirect URIs:** `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
3. **Supabase Dashboard:** Authentication → Providers → Google → Enable
4. **Supabase Dashboard:** Enter Google Client ID + Client Secret
5. **Vercel:** No OAuth config needed (callback handled by Supabase)

**Piston production configuration:**
- Endpoint: `NEXT_PUBLIC_PISTON_URL` env var (default: `https://emkc.org/api/v2/piston`)
- Supported languages: python, java, c, cpp
- Timeouts: 30s (Run), 25s (Evaluate per-test)
- Source limit: 50KB
- Error classification: compile, runtime, timeout, unavailable, malformed, unknown
- No automatic retries (manual retry via Run button)
- **WARNING:** Public Piston capacity for 100-200 students has NOT been verified

**Security final audit:**

Application-level protections (code-verified):
- Authentication on all API routes via `getAuthUser()`
- Admin authorization via `requireAdmin()` on question CRUD
- Session ownership verification on exam-sessions, submissions, violations
- Hidden test data never exposed to client (sample-only filter)
- `solution_code` stripped from all question responses
- Submission idempotency prevents duplicate grading
- Session state machine enforced server-side (pending→in_progress→completed)
- Timing enforcement server-side (round unlock, session expiry)
- Anti-cheat: 3 auto-submit triggers (fullscreen exits, background time, violation count)
- Rate limiting on violations route (in-memory, serverless limitation)
- Language validation, source code size limits, request body size limits
- Piston timeouts with AbortController

Database protections (requires live Supabase):
- RLS on all 8 tables
- SECURITY DEFINER functions for all mutations
- `question_solutions` table blocks student read access to solution_code
- `test_cases` RLS restricts students to `is_sample = true`
- `insert_submission()` prevents forged scores
- `start_exam_session()` / `complete_exam_session()` enforce state machine
- `increment_violation_count()` verifies ownership atomically
- Role escalation prevention on profiles UPDATE
- Session ownership check on violations INSERT

**Smoke-test checklist (manual, 25 steps):**

| # | Action | Expected Result | Destructive? |
|---|---|---|---|
| 1 | Visit `/` | Homepage loads with "Code Clash" | No |
| 2 | Visit `/signup`, fill form, submit | "Check your email" success state | Creates account |
| 3 | Visit `/login`, enter credentials | Redirects to `/dashboard` | No |
| 4 | Click logout | Redirects to `/login` | No |
| 5 | Complete onboarding form | Redirects to `/dashboard` | Updates profile |
| 6 | Login as admin, visit `/admin` | Dashboard with stats loads | No |
| 7 | Admin creates student assignment | Assignment saved | Creates data |
| 8 | Student visits `/dashboard/exam/1` | Shows round info or unlock timer | No |
| 9 | Round unlocks, student clicks "Start Exam" | Exam live page loads with Monaco editor | Creates session |
| 10 | Student views question in ProblemPanel | Question description renders | No |
| 11 | Student clicks "Run" with sample code | Test results display | No |
| 12 | Student submits code with compile error | Error shown, no submission created | No |
| 13 | Student submits code with runtime error | Error shown, submission recorded as failed | Creates submission |
| 14 | Student submits correct code | "Passed" shown, submission recorded | Creates submission |
| 15 | Timer expires | Auto-submit triggers | Creates submission |
| 16 | Student visits leaderboard | Rankings display | No |
| 17 | Admin visits `/admin/questions` | Question list loads | No |
| 18 | Admin creates new question | Question saved | Creates data |
| 19 | Admin updates settings | Settings saved | Updates data |
| 20 | Admin views leaderboard | Rankings display with tabs | No |
| 21 | Unauthenticated API request to `/api/settings` | Returns 401 | No |
| 22 | Student tries to access `/admin` | Redirected to `/dashboard` | No |
| 23 | Student opens browser console, queries `question_solutions` | Empty result (RLS blocks) | No |
| 24 | Student opens browser console, queries hidden `test_cases` | Empty result (RLS blocks) | No |
| 25 | Student tries to insert submission via console | Blocked by RLS | No |

**Automated test results:**

| Test Suite | Tests | Passed | Skipped | Failed |
|---|---|---|---|---|
| Unit tests (Vitest) | 190 | 190 | 0 | 0 |
| E2E tests (Playwright) | 73 | 38 | 35 | 0 |
| **Total** | **263** | **228** | **35** | **0** |

- 35 E2E skips: require `TEST_*` credentials (not configured)
- 0 failures across all suites

**Verification results:**
- `npx tsc --noEmit` — clean (0 errors)
- `npm run lint` — 14 pre-existing issues (3 errors, 11 warnings), 0 new from Phase 11
- `npm run build` — clean (21 routes + proxy)
- `npm test` — 190 tests, all passing
- `npx playwright test` — 38 passed, 35 skipped, 0 failed

**Files changed in Phase 11:**
- `src/app/api/settings/route.ts` — fixed hardcoded fallback dates from `2026-08-08` to `2026-08-07`
- `.gitignore` — added `!.env.example` exception
- `.env.example` — added E2E test variable placeholders
- `docs/PRD.md` — added Phase 11 section (this section)

**Remaining risks:**
1. Public Piston API capacity for 100-200 concurrent students is unverified
2. Vercel free tier concurrency limit (10 concurrent serverless executions)
3. In-memory rate limiter resets on serverless cold start
4. `20260819_rls_exam_tables.sql` must be renamed before applying
5. Realtime publications must be enabled in Supabase dashboard
6. Google OAuth must be configured in Google Cloud Console + Supabase dashboard
7. Admin account must be created and role updated via SQL after signup
8. Questions/test cases must be seeded before competition
9. Browser anti-cheat behavior not verified in production
10. 35 E2E tests require credentials to run
