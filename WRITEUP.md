# Approach (one-page write-up)

**The problem.** BookLeaf's bottleneck isn't answering one question; it's answering thousands consistently, in the right order, without re-deriving policy and royalty figures each time. I designed for **triage you can trust**, **drafts that are right the first time**, and **a system that keeps working when the AI doesn't**.

**What I prioritised**
1. **The core ticket loop.** Author raises a ticket → it's classified and prioritised → it appears in an urgency-sorted queue → the admin opens an AI draft grounded in policy and the author's real numbers → edits and sends → the author sees it live.
2. **AI that behaves like a careful colleague.**
   - Prompts encode BookLeaf's tone rules, send only the knowledge-base sections for the ticket's category, and include facts computed in code: next payout date, the ₹1,000 threshold, overdue status.
   - Anything the model can't know becomes a `[placeholder]`; the UI and the API both refuse to send a reply until it's filled.
   - Hard rules (ISBN errors are at least High) are enforced in code after the model. Admin overrides are never overwritten by a later AI run.
3. **Graceful degradation.**
   - Tickets are saved before any AI call, with rule-based triage.
   - A rate-limited model falls over to a second model.
   - If both fail, drafts fall back to policy-correct templates, and the queue tells the team the AI is offline.
4. **Visible cost control.** Category-scoped context, cached drafts, one call for category and priority, and per-call token and cost logging. Measured: about $0.0005 per ticket and ~1 s per call on Groq's gpt-oss-120b.
5. **Security by construction.** httpOnly cookie sessions, and access scoping inside database queries (another author's ticket is a 404). Internal notes are filtered in the query, every input goes through Zod, and the API key stays on the server.

**Trade-offs I made deliberately**
- **One Node process** serves the API, web app and SSE stream with an in-memory triage queue. It's simple to deploy and reason about, but can't scale horizontally as-is.
- **SSE instead of WebSockets**, because updates only flow one way.
- **Attachments are metadata only**, since real storage on an ephemeral free host would be a demo-only hack.
- **Groq gpt-oss-120b rather than a frontier model:** narrow tasks, fast responses, strict JSON output and a free tier. Claude is one environment variable away.
- **Testing focus:** 78 API/AI tests (lifecycle, isolation, every AI failure path) plus a scripted browser run, rather than frontend unit tests.

**How I'd evolve it into a production system**
- **Quality loop:** an eval set from real tickets to score classification and drafts. Track how often drafts are sent unedited (already recorded per reply) and feed edits back into the prompts.
- **Scale:** a durable job queue, Postgres `LISTEN/NOTIFY` or Redis for multi-instance realtime, object storage for attachments, server-side sessions, and alerting on the AI failure rate.
- **Fewer tickets:** answer common questions ("when is my next payout?") from the same knowledge base before a ticket is raised, and add per-platform royalty breakdowns.
- **Ops tooling:** SLAs per priority, round-robin assignment, canned responses, an audit trail and email notifications.

Details: [README.md](README.md) · [NOTES.md](NOTES.md)
