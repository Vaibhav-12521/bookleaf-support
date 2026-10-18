# Notes: assumptions, trade-offs, limitations, next steps

## Assumptions
| # | Gap in the brief | Assumption | Why |
|---|---|---|---|
| 1 | Dataset has no passwords | Every author signs in with their dataset email + `Author@123` | Lets reviewers use "these exact records" without a sign-up flow. |
| 2 | Dataset has no staff users | Two admins seeded (`lead@` / `agent@bookleaf.demo`, `Admin@123`) | Two people are needed to show that "assign to myself" means something. |
| 3 | "My Books: published books", but 2 books are in production | Show **all** books; in-production books show a stage tracker and "Set at publication" instead of null MRP/royalties | The brief's note asks for these edge cases to be handled gracefully; hiding them would confuse an author who is waiting on one. |
| 4 | Dataset payouts are all in 2025; it is now Oct 2026 | "Next payout date" is calculated from the policy against the real current date. The AI gets the facts but is told not to declare a payment overdue beyond what the data shows | Hard-coding a date would go stale. |
| 5 | Dataset uses a flat royalty per copy, while the KB describes an 80/20 net-profit split | Show the dataset figures as-is; the AI explains the 80/20 policy when asked | We were told to use these records. Arithmetic was audited: earned = copies × per-copy and paid + pending = earned for all 18 books. |
| 6 | ISBNs contain `5XXXX` placeholders | Only uniqueness is enforced, no checksum | Real-looking validation would reject the provided data. |
| 7 | Attachment: "UI only, upload is a bonus" | Real file picker with type/size validation; file name, size and type are stored and shown on the ticket; the bytes are not uploaded | Render's free disk is wiped on each deploy; doing it properly needs object storage (see Next steps). |
| 8 | When to generate the draft | When the admin first opens the ticket; cached; regenerated on demand or when the thread/category changes | Matches "when an admin opens a ticket" and avoids paying for drafts nobody reads. |
| 9 | Status semantics | Admin's first reply: Open → In Progress. "Send & resolve" is one action. An author follow-up reopens a Resolved ticket. Closed is final (409) | Matches how support desks usually behave; avoids lost follow-ups. |
| 10 | Author follow-ups | Authors can reply on their own open/resolved tickets | Not in the brief, but a one-shot form forces authors to open duplicate tickets. |
| 11 | "Assign tickets to themselves" | Assign to me / unassign in the UI; the API also accepts any admin id. A first reply auto-assigns | Covers the brief; auto-assign removes a click. |
| 12 | Is the ₹1,000 minimum per book or per author? | Per author: it applies to the total pending across all of the author's books | The KB says "if *accumulated* royalties are below this, they roll over", and payouts are one bank transfer per author. In the dataset no author has several small balances, so the seeded data looks the same either way; the rule only differs for multi-book authors. |

## Trade-offs
- **Single process: API + SPA + SSE + in-memory triage queue.** One URL, no CORS, simple to deploy and reason about. The cost is horizontal scaling: the SSE hub and triage queue are per-process. With more than one instance, events would go through Postgres `LISTEN/NOTIFY` or Redis, and triage through a durable queue (pg-boss/BullMQ). Pending triage *is* recovered on restart, so a crash doesn't lose work.
- **SSE over WebSockets.** Updates only flow server → client (actions go through REST), so SSE is enough, simpler, and survives proxies. Clients fall back to 20 s polling while disconnected and refresh after reconnecting.
- **Rule-based triage first, AI second.** Every ticket gets a reasonable category/priority instantly and the app keeps working with no AI at all. The rules are only a fallback; keyword matching is clearly weaker than the model on nuanced tickets.
- **Groq + gpt-oss-120b.** Fast, cheap, a free tier, and strict JSON-schema output. The trade-off is that an open-weight model may be slightly weaker at matching tone than a frontier model; the Anthropic provider is one env var away if evals showed draft-quality gaps.
- **JWT sessions without server-side revocation.** The user is re-loaded on each request (deleted users lose access immediately) and tokens expire after 12 h, but a stolen token can't be revoked early. A sessions table would fix that.
- **Prisma.** Typed, safe queries and migrations; a little less control over SQL than a query builder. The queue's urgency sort relies on Postgres ordering enums by declaration order, which is documented in the code.
- **Monorepo with shared Zod schemas.** Some setup (bundling a TS workspace package) in exchange for validation, types and API docs that cannot drift apart.

## Known limitations
- **Model output still needs a human.** Verified against the real model on every demo scenario, drafts are grounded and on-voice, but gpt-oss occasionally embellishes, e.g. describing BookLeaf as offering "ebook and audio distribution", which the KB doesn't state. The design assumes review: every draft is editable, unknowns become blocking `[placeholders]`, names and titles are corrected in code, and nothing is sent automatically. The smaller fallback model (gpt-oss-20b) is somewhat looser with rules (it once invented a typesetting duration), and the UI shows which model wrote each draft.
- **Groq free-tier quotas are small** (about 8k tokens/minute per model). One draft is ~1.7k tokens, so a burst of activity can exhaust both the primary and fallback models; requests then degrade to templates until the window resets. A paid tier or a third fallback model would remove this for production.
- Cost and latency figures in the README are measured from test runs (`AiEvent`), not guaranteed; they vary with ticket length and model load.
- No password reset, sign-up or account settings (out of scope).
- File attachments are metadata only (see assumption 7).
- No email notifications. Authors see updates in the portal only.
- No SLA configuration; the 48-hour "overdue" highlight is a constant taken from the knowledge base.
- The rules fallback is English-only and keyword-based.
- Rate limiting is in-memory (per instance).
- Frontend tests are a scripted Playwright run (52 checks, see README), not part of `npm test`. Wiring them into CI with a disposable database is the next step.

## What I'd do next
1. **Measure AI quality:** build a small eval set (the brief's sample queries plus anonymised real tickets) and score classification accuracy and draft quality (tone checklist, factual grounding, placeholder rate), so prompt changes are measured rather than eyeballed. Track the "draft sent unedited vs edited" rate (`fromAiDraft` is already recorded) as a production signal.
2. **Close the loop with agents:** "Approve / Edit / Rewrite" feedback on drafts, and use the most-edited drafts to improve the prompt.
3. **Author-side deflection:** before a ticket is submitted, suggest the KB answer for common questions (e.g. "when is my next payout?") using the same knowledge base. Could cut volume noticeably.
4. **Durable infrastructure:** a job queue for triage, Redis/`LISTEN/NOTIFY` for multi-instance realtime, object storage (S3/R2) with signed URLs for attachments, and a server-side session store.
5. **Ops features:** SLA policies per priority with breach alerts, canned responses, bulk actions, an assignment round-robin, email notifications to authors, and an audit log of every status/priority change.
6. **Royalty breakdown per platform** (the KB says authors can see it), once per-platform sales data exists.
7. **Observability:** structured logs to a log store, request IDs, and alerting on the AI failure rate from `AiEvent`.
