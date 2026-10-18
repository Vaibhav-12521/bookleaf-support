# BookLeaf Author Support & Communication Portal

A web app that helps BookLeaf's operations team answer author queries faster and more consistently. Authors check their books and royalties and raise tickets. Admins work a prioritised queue where every ticket is **classified, prioritised and drafted by AI** using the BookLeaf knowledge base, and a human always reviews before anything reaches the author.

> **Live demo:** https://bookleaf-support-ds98.onrender.com (use **Try the demo** at the bottom-right for one-click sign-in)
> **API docs (Swagger):** https://bookleaf-support-ds98.onrender.com/api/docs  ·  OpenAPI JSON: https://bookleaf-support-ds98.onrender.com/api/openapi.json
>
> Hosted on Render's free plan: if the site has been idle, the first load can take up to a minute while it wakes up.

### Test logins

| Role | Email | Password | Why this account is interesting |
|---|---|---|---|
| Admin | `lead@bookleaf.demo` | `Admin@123` | Support lead (Aisha Khan) |
| Admin | `agent@bookleaf.demo` | `Admin@123` | Second agent, to test assignment |
| Author | `ananya.reddy@email.com` | `Author@123` | ₹0 paid since Jul 2024, has a Critical ticket |
| Author | `sneha.kulkarni@email.com` | `Author@123` | 3 books, one **in production** (Cover Design) |
| Author | `kavita.deshmukh@email.com` | `Author@123` | ₹850 pending, **below the ₹1,000 payout threshold** |
| Author | `priya.sharma@email.com` | `Author@123` | No tickets yet (empty state) |

Every author in `bookleaf_sample_data.json` can sign in with their dataset email and `Author@123`. For one-click access, use the **Try the demo** button at the bottom-right of the login page. Once signed in, the **Switch** button in the header jumps between demo accounts (author and admin) without signing out.

**Two-minute tour:** sign in as **Priya** in one browser and raise a ticket. In a second browser (or a private window) sign in as **Aisha**. Or, in a single window, use **Switch** to move between the two. The ticket appears in the queue straight away, already classified. Open it, edit the AI draft and send. Priya's page shows the reply without a refresh.

---

## Contents
1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Architecture](#architecture)
4. [AI integration](#ai-integration) (prompts, knowledge base, failure handling, cost)
5. [API](#api)
6. [Data model](#data-model)
7. [Running locally](#running-locally)
8. [Testing](#testing)
9. [Known limitations and next steps](#known-limitations-and-next-steps)
10. [Deployment](#deployment)
11. [Project structure](#project-structure)

Assumptions, trade-offs, limitations and next steps are in **[NOTES.md](NOTES.md)**. The one-page approach note is **[WRITEUP.md](WRITEUP.md)**.

---

## Features

**Author portal**
- Email/password sign-in; every query is scoped to the signed-in author on the server.
- **My Books:** title, ISBN, genre, publication date, status, MRP, copies sold, and royalty earned/paid/pending for every book, plus a portfolio summary and the **next payout date** calculated from the policy (quarterly, within 45 days).
  - Books **in production** show a 9-stage tracker instead of empty numbers.
  - When the author's **total** pending royalty is below ₹1,000, it is flagged as rolling over (the minimum applies to accumulated royalties, not each book).
  - Books with **no payout yet** say so explicitly.
- **Get Help:** book dropdown (including "General / Account Level"), subject, details, and a file attachment picker with type/size validation (metadata only; see NOTES). It can be opened pre-filled from any book card.
- **My Tickets:** status, the original query and team replies, **updating live** via Server-Sent Events. Authors can post follow-ups. A follow-up reopens a resolved ticket; closed tickets are final.

**Admin portal**
- **Queue:** sorted by urgency (Critical first, then oldest).
  - Filter by status, category, priority, date range, assignee and free-text search (subject, author, book or `BL-00042`).
  - Filters live in the URL, so a view can be bookmarked or shared.
  - Critical rows are tinted. Tickets waiting over 48 hours for a reply are flagged red. Overview tiles show Critical/High counts, awaiting reply, unassigned, oldest unresolved, and AI calls and spend.
- **AI classification + priority** on every new ticket, with the model's reasoning and confidence shown. Admins can override either value; overrides are marked and **never overwritten** by a later AI run.
- **AI-drafted reply**, generated when the ticket is opened and grounded in the knowledge base and the author's real data.
  - Fully editable before sending.
  - Gaps the model can't know are left as `[bracketed placeholders]`, and **Send is blocked until they are filled**. The API enforces the same rule (422), so a placeholder can't reach an author through a direct API call either.
  - "Send & resolve" is a single action.
- **Ticket management:** status changes, internal notes (never sent to authors, enforced in the database query), assign to me / unassign. The first reply auto-assigns the ticket and moves it from Open to In Progress.
- **Graceful degradation:** with the AI down or not configured, tickets still get rule-based triage, drafts fall back to policy-correct templates, and a banner tells the team.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS 4, TanStack Query, React Router | TanStack Query handles caching and loading/error states, and realtime events just invalidate queries. |
| Backend | Node 22, Express 5, TypeScript | Explicit middleware chain (auth, role, validation, handler). Express 5 forwards async errors natively. |
| Database | PostgreSQL + Prisma 6 | Relational data (author → books → tickets → messages), typed queries, migrations, parameterised SQL. |
| Validation | Zod 4, **shared** between API and web | One schema drives server validation, form validation, TypeScript types *and* the OpenAPI spec. |
| Auth | JWT in an httpOnly, SameSite=Lax cookie; bcrypt | XSS can't read the token. The cookie also works for `EventSource`, which can't send headers. A Bearer token is accepted for API clients. |
| Realtime | Server-Sent Events, with 20 s polling as fallback | Updates only flow server → client. SSE is simpler than WebSockets and proxy-friendly, and reconnects automatically. |
| AI | **Groq** running **`openai/gpt-oss-120b`**, behind a provider interface (Anthropic Claude Haiku also supported via `AI_PROVIDER=anthropic`) | See [model choice](#model-choice). |
| Tests | Vitest + Supertest | 58 unit and 20 integration tests, plus a scripted end-to-end run against the real model (see [Testing](#testing)). |

---

## Architecture

```
            ┌──────────────── one origin (no CORS) ─────────────────┐
 Browser ──►│ Express                                               │
  React SPA │  ├─ /api/v1/*   REST API ─┐                           │
  (cookie)  │  ├─ /api/v1/events  SSE   │                           │
            │  ├─ /api/docs   Swagger   │                           │
            │  └─ /*          built SPA │                           │
            └───────────────────────────┼───────────────────────────┘
                                        ▼
   routes (thin) ─► services (rules, lifecycle) ─► repository / Prisma ─► PostgreSQL
                          │
                          ├─► ai/triage.service ─► LlmProvider ─► Groq API
                          ├─► ai/draft.service  ─┘   (or rules / templates on failure)
                          └─► realtime/sseHub ─► connected browsers
```

**Layers (`apps/api/src`)**
- `modules/*/…routes.ts`: HTTP only (middleware and a service call).
- `modules/*/…service.ts`: business rules: lifecycle, auto-assign, first-response tracking, override stickiness.
- `tickets.repository.ts`: query building and **access scoping**. Authors can only ever be given their own rows, and internal notes are filtered *in the query*, so a missed check in a controller can't leak data.
- `ai/`: everything model-related, behind `LlmProvider`. Business code never imports a vendor SDK; `groqProvider.ts` and `anthropicProvider.ts` are interchangeable.
- `domain/`: pure functions (royalty calendar, production stages, mappers), unit-tested.
- `middleware/`: authentication, role guard, Zod validation, rate limits, and the **single error handler** that maps errors to `{ error: { code, message, details } }` with the right status (401/403/404/409/413/422/429). Unexpected errors are logged and return a generic 500 without internals.

**Key decisions**
- **Ticket creation never waits on the AI.** The ticket is saved immediately with a rule-based category and priority, the request returns `201`, and AI triage runs in a background queue that pushes a realtime update when done. An AI outage can't lose or block a ticket.
- **404 instead of 403** for another author's ticket, so ticket IDs can't be probed.
- **Realtime events carry no data:** only `{ type, ticketId }`. Clients refetch through the normal authorised endpoints, so the stream can never leak content.
- **Monorepo with a shared package** (`packages/shared`): enums, Zod schemas and DTO types are written once and used by both apps.

---

## AI integration

There are three AI touchpoints, all in `apps/api/src/ai/`:

| Feature | When | Call | Output |
|---|---|---|---|
| Classification + priority | Ticket created (async) | 1 call, structured output | `{ category, priority, confidence, reasoning }` validated by Zod |
| Reply draft | Admin opens the ticket (cached) | 1 call, text | Plain-text email in BookLeaf's voice |
| Re-run triage | Admin clicks it (e.g. after an outage) | 1 call | as above |

### Prompt strategy (`ai/prompts.ts`)
- **Role and voice:** the draft prompt encodes BookLeaf's tone guidelines as explicit rules:
  - acknowledge the concern first
  - be specific with real numbers and dates
  - own BookLeaf's mistakes without deflecting
  - give concrete timelines ("within 48 hours")
  - end with a clear next step
  - never blame the author
- **Grounding:** the prompt says to use only facts from `<knowledge_base>`, `<account_facts>` and the thread. Unknowable details (bank details linked? exact production date?) become a `[placeholder]` for the agent rather than an invented answer. Out-of-scope questions are handled honestly ("the BookLeaf team will look into it and reply within 48 hours"), without naming teams or services that aren't in the KB. The user turn ends with a short self-check (every date, amount and timeline must come from the facts or the KB; answer only what was asked; end with a next step), because models follow rules restated last most reliably.
- **Real data, pre-computed:** each prompt carries a compact fact sheet: the author's first name and the ticket's book (status, ISBN, copies, platforms and, for royalty/general tickets, royalty per copy, earned/paid/pending, last payout). It also includes today's date, the **next payout date** and the ₹1,000 threshold, all as readable dates. It also adds a plain-language **payout status** computed in code (`fully paid up` / `author's total below the ₹1,000 minimum, rolls over` / `OVERDUE: ₹2,546 payable, never paid since 5 Jul 2024`), so the model states facts instead of inferring them, e.g. "your ₹850 is below the ₹1,000 minimum, so it rolls over".
- **Calibration:** the brief's sample query → response guidance is included for the ticket's category.
- **Triage rubric:** each category is defined, and each priority level has concrete criteria. The model is told to judge severity from the account facts, not tone ("an angry message about a minor issue is still minor").
- **Prompt-injection hygiene:** author text is wrapped in `<ticket>` tags and labelled untrusted, and the model is told never to follow instructions inside it. Internal notes are passed as labelled private context and the model is told never to quote them.
- **Policy guardrails after the model** (`ai/rules.ts`): BookLeaf rules that must always hold are enforced in code, not left to the prompt:
  - ISBN errors and physical print defects are never below High.
  - An overdue royalty is never below High; a book never paid for over a year is Critical.
  - If a floor changes the model's answer, the reasoning says so ("Raised from High to Critical by Royalty & Payments policy").
- **Output guardrails** (`ai/text.ts`): every draft is normalised before an admin sees it.
  - Typographic Unicode (non-breaking hyphens and spaces) becomes plain text, and markdown is stripped.
  - Near-miss spellings of the author's first name and book titles are corrected to the database values. In testing the model produced "Hi Sneja" and "Howow Nights"; a 1-3 character edit-distance check against known names fixes these deterministically, with no false corrections across every draft generated in testing.
  - The greeting always uses the exact first name.

### Knowledge-base usage (`ai/knowledge/knowledgeBase.ts`)
The brief's knowledge base is split into sections (company, royalty, ISBN, printing, distribution, production) plus per-category example guidance. A draft for a **royalty** ticket gets *company + royalty policy + royalty examples*, not the printing or distribution sections. General inquiries get everything, because they can touch any topic and the full KB is small.

### Failure handling and graceful degradation
| Failure | What happens |
|---|---|
| No API key configured | App runs fully: rule-based triage, template drafts, banner in the admin queue. |
| Rate-limited (429) | Groq quotas are per model, so the provider immediately retries on a **fallback model** (`openai/gpt-oss-20b`, configurable via `AI_FALLBACK_MODEL`) before giving up. The UI shows which model wrote each draft. Verified live: when a burst exceeded the free tier's 8k tokens/minute on gpt-oss-120b, triage and drafts were served by gpt-oss-20b instead of templates. |
| 5xx / network / timeout | SDK retries with exponential backoff (2 retries for background triage, 1 for drafts because an admin is waiting), with a 20 s timeout per attempt. |
| Still failing (both models) | Triage: ticket keeps its rule-based values, `triageStatus=FAILED`, the reason is shown, and an admin can re-run it later. Draft: a **category template** written to the same tone rules, filled with the author's name, book and next payout date, labelled "Template", with the reason shown. |
| Model refuses / truncated / bad JSON | Treated as a failure and handled as above. Structured output is schema-validated, so a malformed category can never reach the database. |
| Server restarts mid-triage | Tickets still `PENDING` are re-queued on boot. |
| Admin overrode the AI | Later AI runs update the *suggestion* fields but never the admin's value (enforced with conditional `WHERE categorySource != 'ADMIN'` writes, which also covers the race where an admin edits while the model is thinking). |

Every model call, successful or not, is recorded in `AiEvent` with tokens, cache hits, latency and error code, and summarised on the admin dashboard.

### Cost awareness
- **No full history and KB on every call.**
  - Only the category's KB sections are sent: the printing slice is ~290 tokens vs ~750 for the full KB.
  - Only the ticket's book, not the author's whole catalogue.
  - Only the original query plus the **last 6 messages**, each truncated (description at 3,000 chars, messages at 1,200).
- **Prompt caching:** prompts are laid out as `[static instructions] → [category KB] → [ticket-specific user turn]`, so the stable prefix comes first. Everything volatile (dates, ticket text) is in the user turn, so the prefix is byte-identical across tickets in a category. Groq caches matching prefixes automatically on gpt-oss models and bills cached input at 50% off (the Anthropic provider sets explicit cache breakpoints instead, ~90% off). Cached tokens are recorded per call.
- **Draft caching:** a draft is stored per ticket and reused when the ticket is reopened. It's regenerated only when a new message arrives, the category changes, or the admin clicks Regenerate. Sending a reply doesn't trigger an unrequested regeneration.
- **One call does two jobs:** classification and priority come from a single structured call.
- **Right-sized effort:** triage and drafting both run at `reasoning_effort: low` (quality checked by reading every generated draft), and `max_tokens` is capped per call.
- **Context by category:** draft prompts for non-money tickets omit royalty data entirely: fewer tokens, and the model doesn't raise payouts nobody asked about.
- **Abuse limits:** per-user rate limits on ticket creation (20/hour) and on AI work (regenerate draft / re-run triage: 30 per 10 minutes). Opening a ticket's draft, usually a cache hit, has a looser 300 per 10 minutes so admins working the queue aren't blocked.
- **Measured, not estimated** (from `AiEvent` logs of the end-to-end test runs, gpt-oss-120b on Groq at $0.15 in / $0.60 out per million tokens, cached input 50% off):

  | Call | Avg input tokens | Cached | Avg output | Avg latency |
  |---|---|---|---|---|
  | Triage | ~1,190 | 72% (21/21 calls hit the cache) | 98 | 0.9 s |
  | Draft | ~1,570 | 22% (per-category KB, 8/9 hit) | 178 | 1.1 s |

  That's about **$0.0005 per ticket** (triage + one draft), so 10,000 tickets/month costs about **$5**. Live usage and cost are shown on the admin dashboard.

### Model choice
**Groq + `openai/gpt-oss-120b`** (configurable via `AI_PROVIDER` / `AI_MODEL`):
- **Strict structured outputs:** Groq enforces a JSON schema on gpt-oss models, so classification always comes back as valid `{ category, priority, confidence, reasoning }`. The schema is generated from the same Zod schema, and the result is re-validated before it's trusted.
- **Quality for the job:** a 120B open-weight reasoning model is more than enough for short classification and 100–200 word grounded emails. `reasoning_effort: low` keeps it fast and cheap.
- **Speed:** Groq's inference is very fast, which matters because an admin waits for the draft.
- **Cost:** $0.15 / $0.60 per million tokens, automatic prefix caching at 50% off, and a free developer tier, which keeps a public demo cheap to run.
- **No lock-in:** all model code sits behind `LlmProvider`. An Anthropic provider (Claude Haiku 5.5, the option the brief suggests) is included and selected with `AI_PROVIDER=anthropic`; tests use an injected fake.

---

## API

Base path `/api/v1`. Interactive docs at **`/api/docs`** (Swagger UI, generated from the same Zod schemas used for validation). All routes except login/logout, `/api/health` and the docs require a session cookie or `Authorization: Bearer <token>` (returned by login).

| Method | Path | Who | Description |
|---|---|---|---|
| POST | `/auth/login` | public | Sign in; sets httpOnly cookie, returns `{ user, token }` |
| POST | `/auth/logout` | public | Clears the cookie (204) |
| GET | `/auth/me` | any | Current user |
| GET | `/books` | author / admin | Author: own books + royalty summary. Admin: all books |
| GET | `/books/:bookId` | author / admin | One book (404 if not yours) |
| GET | `/tickets` | author / admin | List with `status`, `category`, `priority` (comma-separated), `assignee=me\|unassigned`, `from`, `to`, `q`, `sort=urgency\|oldest\|newest\|updated`, `page`, `pageSize` |
| POST | `/tickets` | author | Raise a ticket → 201 (AI triage runs async) |
| GET | `/tickets/:id` | author / admin | Ticket + messages. Authors never get internal notes or triage data |
| PATCH | `/tickets/:id` | admin | `status`, `category`, `priority` (overrides), `assigneeId` |
| POST | `/tickets/:id/messages` | author / admin | Author follow-up; admin `kind: REPLY\|NOTE`, optional `status` ("send & resolve") |
| GET | `/tickets/:id/draft` | admin | Cached or fresh AI draft; template fallback |
| POST | `/tickets/:id/draft` | admin | Regenerate the draft |
| POST | `/tickets/:id/triage` | admin | Re-run AI triage → 202 |
| GET | `/admin/overview` | admin | Queue counts, urgency breakdown, AI usage and cost |
| GET | `/events` | author / admin | SSE stream: `ticket.created`, `ticket.updated`, `message.created` |

**Errors** always have the shape `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [{ "path": "subject", "message": "..." }] } }`. Codes: `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409 (e.g. replying to a closed ticket), `VALIDATION_ERROR` 422, `RATE_LIMITED` 429, `INVALID_JSON` 400, `PAYLOAD_TOO_LARGE` 413, `INTERNAL_ERROR` 500.

---

## Data model

```
User (id, email, passwordHash, name, role AUTHOR|ADMIN)
 └─1:1─ Author (id = AUTH001…, phone, city, joinedDate)
          ├─1:n─ Book (id = BK001…, isbn unique, status, mrp?, royalty fields, lastPayoutDate?, platforms[])
          └─1:n─ Ticket (number → BL-00001, subject, description, attachment json?, status,
                         category, priority, categorySource/prioritySource AI|RULES|ADMIN,
                         triageStatus, aiCategory, aiPriority, aiConfidence, aiReasoning,
                         assignee → User?, awaitingTeam, firstResponseAt, resolvedAt)
                   ├─1:n─ TicketMessage (type AUTHOR_MESSAGE|ADMIN_REPLY|INTERNAL_NOTE, body, fromAiDraft)
                   ├─1:1─ AiDraft (content, model, category, messageCount → staleness check)
                   └─1:n─ AiEvent (operation, model, tokens, cache tokens, latency, success, errorCode)
```
- Dataset IDs (`AUTH001`, `BK001`) are used as primary keys, so the seed is idempotent and IDs match the brief.
- Money is whole rupees (`Int`); nullable columns are null exactly where the dataset is (books in production).
- Effective category/priority are stored separately from what the AI said, so overrides stay auditable.
- Index on `(status, priority, createdAt)` for the queue.

---

## Running locally

**Prerequisites:** Node 20.19+ (22 recommended), PostgreSQL 14+.

```bash
# 1. Install
npm install

# 2. Configure: create apps/api/.env from the template
cp .env.example apps/api/.env
#    then set DATABASE_URL and JWT_SECRET (and GROQ_API_KEY to enable AI)

# 3. Create the schema and seed the dataset (both safe to re-run)
npm run db:deploy
npm run db:seed          # 10 authors, 18 books, 2 admins, 7 demo tickets

# 4. Run API (http://localhost:4000) + web (http://localhost:5173) with hot reload
npm run dev
```
Open http://localhost:5173. Vite proxies `/api` to the API, so there's no CORS setup.

**Production-like run:** `npm run build && npm start`, then open http://localhost:4000 (the API serves the built SPA).

**Without an API key** everything works in degraded mode (rule-based triage, template drafts). This is also the easiest way to see the fallback path.

Useful scripts: `npm run db:seed -- --no-demo-tickets` (catalogue only) · `npm run db:reset` (drops all data and recreates the dev DB) · `npm run typecheck`.

---

## Testing

```bash
# Unit tests only (no database needed)
npm test

# Unit + integration (needs an empty, throwaway Postgres database; it is migrated and wiped)
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/bookleaf_test npm test
```

**78 tests** (58 unit, 20 integration):
- **Rules triage:** categories, priority signals, the ISBN/print-defect policy floors.
- **Royalty calendar:** payout windows across quarter boundaries and on the payout day itself; the ₹1,000 threshold applied to the author's total; overdue detection.
- **Production stages.**
- **Dataset:** the provided JSON parses, contains the edge cases, and passes the arithmetic audit.
- **Prompts:** KB selection by category, a cache-stable system prefix, ticket text kept only in the user turn, injection wrapping, no `null` leaking into prompts for in-production books.
- **API:** 401/403/404/409/422 responses, author isolation (404 on others' tickets), admin-only endpoints, the full lifecycle (reply → auto-assign → resolve → author reopens → close), internal notes hidden from authors, filter and sort.
- **AI (fake provider):** results applied with usage logged; policy floors over model output; **rate-limit fallback keeps the ticket on rules**; admin overrides survive re-triage; draft cache hit/miss; the model gets only the relevant book and KB, and no royalty data for non-money drafts; template fallback when the AI is down.
- **Groq provider (stubbed client):** strict JSON-schema request shape, reasoning effort, cached-token accounting, invalid/off-schema/truncated output rejected, **fallback model on 429 only**, each SDK error mapped to the right failure type.
- **Output guardrails:** Unicode/markdown normalisation, name and title spelling correction (and no false corrections), exact greeting.

### End-to-end verification (real Groq model, real browser)
Beyond the automated suite, the whole app was exercised end to end against `gpt-oss-120b`, on fresh databases, with scripted HTTP and browser (Playwright) runs:
- **API/security/AI (57 checks):**
  - 401/403/404/413/422 handling, HttpOnly/SameSite/Secure cookies, security headers, and confirming the API key is absent from the web bundle.
  - Every seeded field for all 18 books matches the JSON.
  - Real AI classified all 7 demo tickets into the correct categories.
  - Prompt injection didn't change a priority.
  - Drafts were grounded (amounts, the 48-hour timeline, the reprint process, the threshold rule), with no internal-note leaks.
  - Live realtime streams were checked for author scoping.
  - The login rate limit triggers in production mode.
  - With an **invalid key**: the ticket is still created, falls back to rules and a template, and the admin can still reply.
- **Browser (52 checks):** every author and admin flow above. That includes the live queue update (~100 ms), admin reply to author (~55 ms), polling fallback with the stream blocked (~20 s), filters persisting across reload, pagination, and no horizontal scroll at 390 px on every page.

---

## Known limitations and next steps

Summary; the full list with reasoning is in [NOTES.md](NOTES.md).

- **Single instance:** realtime streams, the triage queue and rate limits are in-process, so several instances wouldn't share them. Next step: Postgres `LISTEN/NOTIFY` or Redis, and a durable job queue.
- **Attachments are metadata only:** the file name, size and type are validated and stored, but the bytes aren't uploaded. Next step: object storage with signed URLs.
- **AI drafts still need a human:** drafts are grounded, but the model occasionally embellishes. Every draft is editable, placeholders block sending (UI and API), and nothing is sent automatically. Next step: an eval set and tracking of edit rates.
- **Groq free-tier quotas** (~8k tokens per minute per model) can be exhausted by bursts. The fallback model and then templates take over; production would use a paid tier.
- **Live model testing covered Groq only.** The Anthropic provider is covered by tests with a fake model, not live calls.
- **Demo credentials** (`Author@123` / `Admin@123`) and the one-click demo launcher and switcher are for review only. Build with `VITE_DEMO_MODE=false` to remove the shortcuts. There's no sign-up or password reset.
- **Authors' ticket API responses include priority, category and assignee name.** The UI doesn't show them; hiding them in the API is a product decision.

---

## Deployment

The repo includes a **Render Blueprint** (`render.yaml`): one web service (API + SPA on one origin) and a managed Postgres.
1. Push the repo to GitHub, then in Render choose **New → Blueprint** and select the repo.
2. Set `GROQ_API_KEY` in the service's Environment tab (free key at https://console.groq.com/keys). `JWT_SECRET` is generated automatically.
3. On every start the service runs `prisma migrate deploy` and the idempotent seed, then boots. The deployed app is therefore always pre-seeded with the brief's dataset.

The app runs anywhere Node and Postgres do (Railway, Fly, a VPS). If the web app is hosted on a different origin, set `CORS_ORIGIN`.

**Environment variables** (template: [`.env.example`](.env.example); copy it to `apps/api/.env`):

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | | PostgreSQL connection string |
| `JWT_TTL_HOURS` | no | `12` | Session length (JWT and cookie lifetime) |
| `JWT_SECRET` | yes | | Signs session tokens; at least 32 characters. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `AI_PROVIDER` | no | `groq` | `groq` or `anthropic` |
| `GROQ_API_KEY` | no | | Groq key ([console.groq.com/keys](https://console.groq.com/keys)). Without a key the app runs in AI-unavailable mode (rules + templates) |
| `ANTHROPIC_API_KEY` | no | | Used when `AI_PROVIDER=anthropic` |
| `AI_MODEL` | no | `openai/gpt-oss-120b` (Groq), `claude-haiku-5-5` (Anthropic) | Model override |
| `AI_FALLBACK_MODEL` | no | `openai/gpt-oss-20b` | Groq only: used when the main model is rate-limited; `none` disables it |
| `AI_TIMEOUT_MS` | no | `20000` | Per-call timeout before falling back |
| `PORT` | no | `4000` | API port (also serves the built web app) |
| `CORS_ORIGIN` | no | | Only if the web app is hosted on another origin (comma-separated) |
| `NODE_ENV` | no | `development` | `production` enables Secure cookies and the stricter login rate limit |
| `VITE_DEMO_MODE` | no | on | **Web app, read at build time.** Set to `false` to remove the "Try the demo" launcher and account switcher from a real deployment |

Secrets are only ever read on the server; the API key is never sent to the browser (the web bundle has no access to it, and AI calls happen only in `apps/api`).

---

## Project structure

```
bookleaf-support/
├─ apps/
│  ├─ api/
│  │  ├─ prisma/            schema.prisma, migrations, seed.ts
│  │  ├─ src/
│  │  │  ├─ ai/             provider interface, Groq + Anthropic providers, prompts, knowledge base,
│  │  │  │                  rules fallback, templates, triage/draft services, usage logging
│  │  │  ├─ config/         env validation (fails fast on boot)
│  │  │  ├─ docs/           OpenAPI document
│  │  │  ├─ domain/         royalty calendar, production stages, mappers
│  │  │  ├─ lib/            errors, prisma client, logger
│  │  │  ├─ middleware/     authenticate, requireRole, validate, rate limits, error handler
│  │  │  ├─ modules/        auth, books, tickets (routes/service/repository/mapper), admin
│  │  │  ├─ realtime/       SSE hub + endpoint
│  │  │  └─ seed/           dataset schema + audit, demo tickets, seed runner
│  │  └─ tests/             unit/, integration/, helpers/
│  └─ web/src/
│     ├─ api/               fetch client + typed endpoints + query keys
│     ├─ hooks/             session, realtime (SSE → query invalidation)
│     ├─ components/        UI primitives, badges, thread, production tracker, shell
│     └─ pages/             login, author/*, admin/*
├─ packages/shared/         enums, Zod schemas, DTO types (used by both apps)
├─ data/                    bookleaf_sample_data.json (seed source)
├─ render.yaml              deployment blueprint
└─ .env.example
```
