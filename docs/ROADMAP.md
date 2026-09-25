# ROADMAP

> 🧭 [bb-mcp](../README.md) · [Features](./FEATURES.md) · **Roadmap** · [Tasks](./TASKS.md) · [Changelog](./CHANGELOG.md) · [Metrics](./METRICS.md) <!-- nav -->

Last Updated: 2026-09-24

> 2027 planning reset (2026-09-24): the 2025–2026 foundation, 2026 Q2 read/write workflows, and 2026 Q3
> enterprise follow-on are shipped. Completed items were removed and are condensed in [FEATURES](./FEATURES.md) /
> [CHANGELOG](./CHANGELOG.md). Every open 2026 item was carried into 2027 Q1 below; the separate undated
> "2027" writeups were merged into the same section so each item appears exactly once.

## 2027 Q1 - Identity, Contracts & Event Foundations (Planned)

### Committed

- [ ] **Bind `caller_identity` to verified end-user auth** — `MCP_API_KEY` proves the *client* is trusted, not that its claimed `userId`/`role`/`ferpa_authorized` is truthful; require a server-verifiable identity proof (e.g. forwarded Blackboard/SSO token) per request. Security gate for any further write-back work.
- [ ] **JSON schemas for all shipped tool inputs** *(carried from 2026 Q2 Foundation Completion)*.
- [ ] **Blackboard activity ingestion — event schema** *(carried from 2026 Q2; subscription CRUD already shipped in PR #109)*: normalized schema for grade posts, submissions, login activity, and course changes, shared by the webhook bridge and any future consumer.

### Needs scoping (subsystem-sized — carried from 2026 Q2/Q3)

These need a real subsystem — a new data store, an inbound HTTP surface, a background worker, or a published/versioned client contract — not a tool-handler-sized change. Scope each at planning before committing it to a quarter.

- [ ] **Webhook-to-SSE bridge** — needs an inbound HTTP endpoint that authenticates Blackboard's webhook callback (shared-secret or signature verification — payloads aren't self-authenticating), a subscription → active-SSE-session mapping, and backpressure/reconnect handling beyond today's single-tool (`search_course_materials`) stream. `src/tools/webhook-tools.ts` covers subscription CRUD; this is the missing "receive and fan out" half.
- [ ] **Event-driven pipeline + scaling** — depends on the event schema above plus a durable storage decision (queue vs. append log) before "scaling to high-volume submission bursts" is meaningful to evaluate.
- [ ] **Analytics / Product Owner tools** — event telemetry tap, engagement metrics aggregation, AI recommendation signal export. Downstream of the event pipeline, not parallel to it.
- [ ] **Vector store integration** for semantic course content search and AI recommendation signals — needs an embedding/indexing pipeline that enforces the same RBAC/FERPA boundaries as the read tools (a semantic index that surfaces one student's content to another would be a regression) and a re-indexing strategy.
- [ ] **Stable MCP client SDK / integration contract** — `GET /manifest` is already the discoverable contract; a published, versioned SDK on top (semver policy, changelog, consuming client to validate against) is a separate deliverable.
- [ ] **Tool call batching** — batch request/response envelope at the MCP boundary plus a partial-failure semantics decision; touches `src/index.ts` broadly enough to need its own design pass.

## Notes

- 2026 critical path (foundation → multi-persona tools → RBAC + audit logging → streaming/agent patterns) is complete: PR #109 merged 2026-08-29, MCP Inspector stdio validation 2026-09-11.
- This server is the primary demonstration of full-stack AI product engineering capability for the Anthology AI Product Engineer role.
- User safety and institutional data compliance are non-negotiable and must gate every write-back feature.
- Analytics and product-owner tooling should be built to show event-driven pipeline design (RAG-ready signal format preferred) — see 2027 Q1 below.
- Portfolio showcase UI (streaming chat, multi-persona demo) belongs in agent-board (its 2027 Q2 Blackboard showcase), not here; bb-mcp only needs a stable MCP contract and a documented integration guide.

<!--
AGENT INSTRUCTIONS:
1. Keep the roadmap quarter-first and foundation-first.
2. Use short milestones, not narrative blocks.
3. Keep detailed task mechanics in TASKS.md.
4. When an item ships, remove it here and condense it into FEATURES.md / CHANGELOG.md.
5. Before writing "open/blocked/CI failing" about a PR, verify against current PR metadata and checks (`gh pr view <n> --json state,statusCheckRollup,reviewDecision`); use git log only for merge history — a prior audit cycle documented PR #109 as open for a full week after it had actually merged.
-->
