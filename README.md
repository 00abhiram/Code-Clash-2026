# ⚔️ Code Clash 2026

**A production-oriented coding competition platform built for Pallavi Engineering College, Hyderabad — supporting Test-Driven Development and Code Debugging rounds with automated server-side grading, anti-cheat proctoring, and live leaderboards.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?logo=supabase)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?logo=vercel)](https://vercel.com)
[![Vitest](https://img.shields.io/badge/Tests-Vitest-yellow?logo=vitest)](https://vitest.dev)
[![Playwright](https://img.shields.io/badge/E2E-Playwright-green?logo=playwright)](https://playwright.dev)

[🚀 **Live Demo**](https://code-clash-pec.vercel.app/) · [💻 **GitHub Repository**](https://github.com/00abhiram/Code-Clash-2026)

---

## 🎯 Project Overview

Code Clash 2026 is a full-stack coding competition platform designed for **~100–200 concurrent student participants** in a proctored 2-hour competition window. The platform supports two distinct round formats:

- **Test-Driven Development (TDD)** — students write code to pass progressively harder test cases
- **Code Debugging** — students identify and fix bugs in starter code

The system provides **server-authoritative grading** against hidden test cases, **real-time leaderboards**, **anti-cheat proctoring**, and a **live admin dashboard** — all running on a zero-budget architecture using Vercel, Supabase, and the public Piston API.

---

## ✨ Key Features

### 👨‍💻 Student Experience

| Feature | Details |
|---|---|
| **Authentication** | Email/password registration + Google OAuth with automatic profile creation |
| **Onboarding** | Post-signup form collects roll number, branch, and year |
| **Exam Selection** | Students select from available rounds with server-enforced unlock times |
| **Monaco Code Editor** | Full-featured code editor with syntax highlighting for Python, Java, C, C++ |
| **Sample Test Execution** | Run button executes sample test cases via Piston with real-time output |
| **Hidden Test Grading** | Server evaluates all test cases (sample + hidden) at submission time |
| **Server-Authoritative Timer** | Countdown timer based on server timestamps; auto-submit on expiry |
| **Submission Results** | Post-submit view shows sample results + aggregate hidden test counts |
| **Leaderboard** | Rankings based on hidden test performance, execution time, and time taken |

### 🧪 Test-Driven Development

In TDD rounds, students receive problem statements with **visible sample test cases**. The workflow:

1. Read the problem description and sample inputs/outputs
2. Write code in the Monaco editor
3. Click **Run** to execute against sample tests (client-side Piston call)
4. Iterate until sample tests pass
5. Click **Submit** — server runs **all** test cases (sample + hidden) and records the grade
6. View results: sample-level detail + aggregate hidden test counts

### 🐛 Code Debugging

In debugging rounds, students receive **pre-written buggy starter code**. The workflow:

1. Read the problem description and identify the bug
2. Analyze the buggy starter code in the Monaco editor
3. Fix the code and run against sample tests
4. Submit when ready — server evaluates against all test cases
5. View results and ranking

### 🛡️ Anti-Cheat / Proctoring

The platform implements a multi-layered anti-cheat system:

| Protection | Implementation | Enforcement |
|---|---|---|
| **Fullscreen monitoring** | Tracks fullscreen exit count; auto-submits after 2 exits | Client |
| **Background-tab detection** | Monitors `visibilitychange` events; accumulates background time | Client |
| **Cumulative background time** | Auto-submits after 15 seconds cumulative background time | Client |
| **Violation tracking** | Records all violation types (fullscreen, tab switch, shortcuts) | Client + Server |
| **Server-side auto-submit** | Auto-submits after 5 total violations | **Server-enforced** |
| **Rate limiting** | Max 10 violations per session per 60-second window | Server |
| **Session validation** | Server rejects violations for completed sessions | Server |
| **Keyboard blocking** | Blocks F12, Ctrl+C/V/X, Ctrl+Shift+I/J, Ctrl+U, right-click | Client |

> **Browser limitation:** Fullscreen exits and background-tab detection are browser-only signals. The server cannot independently verify these events. The violation count threshold IS server-enforced because violations are recorded via API. The system relies on deterrence + audit trail, not perfect prevention.

### ⚡ Code Execution & Judging

| Component | Details |
|---|---|
| **Execution Engine** | Piston API v2 (public, self-hostable via Docker) |
| **Supported Languages** | Python, Java, C, C++ |
| **Server-Side Grading** | All test cases evaluated server-side; hidden inputs never reach the client |
| **Output Normalization** | Trims whitespace, normalizes line endings for deterministic comparison |
| **Timeout Handling** | 25s per-test timeout (evaluate), 30s per-test timeout (Run button) |
| **Error Classification** | Compile, runtime, timeout, unavailable, malformed, unknown |
| **Idempotent Submissions** | Duplicate submissions return stored results; no duplicate grading |
| **Source Code Limits** | 50KB max source code size; 100KB max request body |
| **Fail-Fast** | If Piston is unavailable, remaining tests are skipped gracefully |

### 🏆 Leaderboards

| Feature | Details |
|---|---|
| **Separate Rankings** | TDD and Debugging rounds have independent leaderboards |
| **Ranking Criteria** | Hidden test pass rate → execution time → time taken |
| **Completed Only** | Only submitted sessions appear on the leaderboard |
| **Deterministic Tie-Breaking** | Consistent ordering based on multiple criteria |
| **Realtime Updates** | Admin dashboard receives live leaderboard updates via Supabase Realtime |

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────────────────────────────┐
│   Student        │     │           Next.js 16 App Router          │
│   Browser        │────▶│  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│                  │     │  │  Pages    │  │  API     │  │ Proxy  │ │
│  ┌──────────┐   │     │  │  (SSR)    │  │  Routes  │  │ (Auth  │ │
│  │  Monaco   │   │     │  └──────────┘  └──────────┘  │  Guard)│ │
│  │  Editor   │   │     │                                └────────┘ │
│  └──────────┘   │     └────────────────┬────────────────────────┘
│                  │                      │
│  ┌──────────┐   │                      │
│  │ Anti-Cheat│   │                      ▼
│  │   Hook    │   │     ┌─────────────────────────────────────────┐
│  └──────────┘   │     │              Supabase                     │
└─────────────────┘     │  ┌──────────┐  ┌──────────┐  ┌────────┐ │
                        │  │ PostgreSQL│  │  Auth    │  │Realtime│ │
┌─────────────────┐     │  │  (RLS)   │  │ (JWT)   │  │  (WS)  │ │
│   Admin          │────▶│  └──────────┘  └──────────┘  └────────┘ │
│   Browser        │     └─────────────────────────────────────────┘
└─────────────────┘                      │
                                         ▼
                        ┌─────────────────────────────────────────┐
                        │         Piston API (Execution)           │
                        │    https://emkc.org/api/v2/piston       │
                        └─────────────────────────────────────────┘
```

**Key architectural decisions:**

- **No self-hosted backend** — all business logic lives in Next.js route handlers and Supabase database functions
- **Supabase as the security boundary** — Row Level Security (RLS) protects all tables; SECURITY DEFINER functions handle sensitive mutations
- **Server-authoritative timing** — all unlock and deadline checks use server timestamps, never client time
- **Client + Server anti-cheat** — fullscreen/background detection is browser-only; violation count threshold is server-enforced

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router, Turbopack), React 19, TypeScript 5, Tailwind CSS 4 |
| **Code Editor** | Monaco Editor (`@monaco-editor/react`) |
| **Backend** | Next.js Route Handlers (serverless on Vercel) |
| **Database** | PostgreSQL via Supabase with Row Level Security |
| **Authentication** | Supabase Auth (Email/Password + Google OAuth) |
| **Realtime** | Supabase Realtime (WebSocket) |
| **Code Execution** | Piston API v2 (public, no API key required) |
| **Testing** | Vitest 5.0.0 (190 unit/API tests), Playwright (E2E suite) |
| **Deployment** | Vercel (free tier) |
| **Version Control** | Git, GitHub |

---

## 🔐 Security Engineering

Security is a first-class concern in this platform. The system implements defense-in-depth across multiple layers:

### Authentication & Authorization

- **Supabase Auth** handles user registration, login, and session management
- **Google OAuth** integration with automatic profile creation for new users
- **Role-based access control** — `student` and `admin` roles enforced server-side
- **Admin API routes** require `role === 'admin'` via `requireAdmin()` helper
- **All API routes** verify authentication server-side via session cookies; no route trusts client-supplied `user_id`

### Database Security (Row Level Security)

| Table | Student Access | Protection Mechanism |
|---|---|---|
| `profiles` | Read/update own only | RLS `auth.uid() = id`; role change blocked in WITH CHECK |
| `exam_sessions` | Read own only; INSERT own only | No student UPDATE — all mutations via SECURITY DEFINER functions |
| `submissions` | Read own only | No student INSERT — all inserts via `insert_submission()` SECURITY DEFINER |
| `violations` | Read own; INSERT own (with session check) | Session ownership verified in RLS policy |
| `questions` | Active questions only | `is_active = true` filter |
| `test_cases` | Sample cases only | `is_sample = true` filter; hidden cases protected at DB level |
| `settings` | Read all | Students can read; only admins can modify |
| `question_solutions` | **No access** | No student RLS policy = students cannot read `solution_code` |

### Server-Side Security

- **SECURITY DEFINER functions** bypass RLS for sensitive mutations (session state transitions, submissions, violations)
- **Hidden test cases** protected at database level — student SELECT restricted to `is_sample = true`
- **Solution code** stored in separate `question_solutions` table with no student RLS policy
- **Server-side exam unlock validation** — round timing enforced via `requireRoundUnlocked()`
- **Server-side session expiration** — `isSessionExpired()` rejects expired submissions
- **Duration snapshotting** — session duration captured at creation; admin changes don't affect in-progress sessions
- **Submission idempotency** — duplicate submissions return stored results; no double-grading
- **Unique graded-submission constraint** — database-level protection against duplicate scored rows
- **Violation ownership checks** — `increment_violation_count()` verifies `auth.uid() = p_user_id`
- **Server-side status validation** — session state machine enforced at database level

> **Secrets are never committed to the repository.** Environment variables containing API keys, database credentials, and OAuth secrets are kept server-side only.

---

## 🧪 Testing & Quality

### Automated Test Suite

| Framework | Scope | Status |
|---|---|---|
| **Vitest** | Unit/API tests (190 tests across 11 files) | ✅ All passing |
| **Playwright** | E2E tests (6 spec files) | ✅ 38 passing, 35 require test credentials |
| **TypeScript** | Strict compilation (`tsc --noEmit`) | ✅ Clean |
| **ESLint** | Code linting | ⚠️ 14 pre-existing warnings/errors |
| **Build** | Production build (`next build`) | ✅ Clean (21 routes + proxy) |

### Test Coverage

- **API route handlers** — all 10 routes tested for auth, ownership, validation, error handling
- **Piston execution** — timeout, error classification, malformed responses, size limits
- **Anti-cheat logic** — rate limiting, threshold detection, violation type validation
- **Security boundaries** — unauthorized access prevention, role escalation blocking
- **Exam lifecycle** — session state machine, timing enforcement, idempotency

### E2E Test Specs

| Spec | Tests | Description |
|---|---|---|
| `public-pages.spec.ts` | Homepage, 404 | Public page rendering |
| `auth.spec.ts` | Login, signup forms | Authentication flows |
| `api-contract.spec.ts` | API responses | API contract verification |
| `exam-lifecycle.spec.ts` | Session flow | Exam start, submit, complete |
| `admin.spec.ts` | Admin pages | Admin dashboard functionality |
| `security.spec.ts` | Auth guards | Protected route enforcement |

> **Note:** 35 E2E tests are skipped because they require configured test accounts with valid credentials.

---

## 📁 Project Structure

```
code-clash-2026/
├── proxy.ts                          # Next.js 16 proxy (auth guard + onboarding redirect)
├── public/
│   └── pec-logo.png                  # College logo
├── src/
│   ├── app/
│   │   ├── (auth)/                   # Login, signup pages
│   │   ├── admin/                    # Admin dashboard, questions, settings, leaderboard
│   │   ├── auth/callback/            # OAuth callback handler
│   │   ├── dashboard/                # Student dashboard, exam entry, live coding
│   │   └── api/                      # Route handlers (10 endpoints)
│   ├── components/                   # React components (auth, exam, UI)
│   ├── hooks/                        # Custom hooks (useAuth, useAntiCheat, useExamTimer)
│   ├── lib/                          # Utilities (supabase clients, piston helpers)
│   └── types/                        # TypeScript type definitions
├── e2e/                              # Playwright E2E tests (6 spec files)
├── supabase/
│   └── migrations/                   # Database migrations (8 files)
├── docs/
│   └── PRD.md                        # Product Requirements Document
└── package.json
```

---

## 🚀 Running Locally

### Prerequisites

- Node.js 18+ (Node 24 recommended)
- npm, yarn, or pnpm
- Supabase project (for database and auth)

### Setup

```bash
# Clone the repository
git clone https://github.com/00abhiram/Code-Clash-2026.git
cd Code-Clash-2026

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start development server
npm run dev
```

### Environment Variables

The `.env.example` file documents all required environment variables. **Never commit actual secret values.**

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `NEXT_PUBLIC_PISTON_URL` | Piston API URL (optional, defaults to public instance) |

### Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest unit/API tests |
| `npm run test:e2e` | Run Playwright E2E tests |

---

## ☁️ Deployment

The production application is deployed on **Vercel**:

🔗 **[https://code-clash-pec.vercel.app/](https://code-clash-pec.vercel.app/)**

### Deployment Notes

- All production environment variables must be configured through the Vercel dashboard
- Supabase migrations must be applied in the correct dependency order (see `docs/PRD.md`)
- Realtime publications must be enabled in the Supabase dashboard for live admin updates
- Google OAuth must be configured in both Google Cloud Console and Supabase dashboard

---

## 🧠 Engineering Highlights

### 1. Secure Server-Side Grading
Students never receive hidden test inputs, expected outputs, or solution code. The evaluate endpoint runs all test cases server-side via Piston and returns only aggregate results. This prevents any form of answer extraction through browser DevTools or network inspection.

### 2. Database-Level Security with RLS
Row Level Security policies on all 8 tables ensure students can only access their own data. SECURITY DEFINER functions handle sensitive mutations (session state transitions, submissions, violations) while bypassing RLS — but only after verifying ownership internally.

### 3. Server-Authoritative Timing
All unlock times and session deadlines use server timestamps. The client timer is display-only — a student with a manipulated browser clock cannot submit after the server-side deadline.

### 4. Idempotent Submission Handling
Duplicate submissions (double-clicks, network retries, multi-tab) return stored results without re-grading. A unique partial index on the submissions table provides database-level protection against duplicate scored rows.

### 5. Atomic Anti-Cheat Violation Tracking
The `increment_violation_count()` SECURITY DEFINER function performs atomic SQL updates, eliminating race conditions in concurrent violation recording. Server-side auto-submit uses `WHERE status = 'in_progress'` to prevent double-completion.

### 6. Piston Execution Reliability
Per-test AbortController timeouts (25s evaluate, 30s Run), source code size limits (50KB), request body limits (100KB), language validation, error classification, and graceful degradation when Piston is unavailable.

### 7. Defense-in-Depth Anti-Cheat
Client-side fullscreen/background monitoring provides deterrence, while server-side violation count threshold (5 violations) provides enforcement. Rate limiting (10 violations/60s) prevents abuse. The system honestly documents browser sandbox limitations.

### 8. Production-Grade Testing
190 unit/API tests covering all route handlers, Piston execution, anti-cheat logic, and security boundaries. Playwright E2E suite validates authentication flows, exam lifecycle, and protected routes.

---

## 🚧 Known Limitations

| Area | Limitation |
|---|---|
| **Concurrency Testing** | The platform is designed for ~100–200 concurrent students but has not been load-tested at production scale |
| **Piston Capacity** | Public Piston API may have rate limits under heavy concurrent load; self-hosted Docker Piston recommended for production |
| **Vercel Free Tier** | Limited to 10 concurrent serverless executions; may queue requests during peak load |
| **Browser Anti-Cheat** | Fullscreen exits and background-tab detection are browser-only signals; server cannot independently verify them |
| **Cold Start** | First serverless invocation may experience 1-2s cold start delay |
| **In-Memory Rate Limiting** | Violation rate limiter resets on serverless cold start |

---

## 👨‍💻 Author

**Abhiram Reddy**

- GitHub: [github.com/00abhiram](https://github.com/00abhiram)
- Project: Code Clash 2026 — Pallavi Engineering College

---

## 📄 License

All rights reserved To Abhi Ram Reddy.
