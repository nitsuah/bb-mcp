# ROADMAP

Last Updated: 2026-09-02

## 2025–2026 Q1 ✅

> Foundation complete — TypeScript MCP server, RBAC, OAuth2, student/instructor tools, CLI, standalone Docker. See FEATURES.md for shipped capabilities.

## 2026 Q2 - Read and Write Workflows ✅

### Multi-Persona Tool Coverage

- [x] **Student tools**: all core read and write tools shipped — `get_my_courses`, `get_upcoming_assignments`, `get_my_grades`, `get_course_content`, `get_assignment_feedback`, `get_announcements`, `create_assignment_submission`.
- [x] **Teacher/Instructor tools**: read tools shipped — `list_roster`, `get_grades`, `get_submission_status`, `get_grade_distribution`, `get_discussion_summary`, `get_at_risk_students`, `draft_announcement`. Grade write-back (`create_grade_column`, `update_grade`, `delete_grade`, `exempt_grade`, `get_grade_column`) shipped on [PR #109](https://github.com/nitsuah/bb-mcp/pull/109), merged 2026-08-29.
- [x] **Admin tools**: user management (read), enrollment management (CRUD), institutional audit log access. `src/tools/admin.ts`, shipped on PR #109.
- [x] **Parent tools** (read-only, guardian-scoped): student enrollment view, grade summary, upcoming assignment alerts, announcements. `src/tools/parent.ts`, shipped on PR #109.
- [ ] **Analytics/Product Owner tools**: event telemetry tap, engagement metrics aggregation, AI recommendation signal export. Not started — see 2027.

### AI Orchestration Surface

- [x] **MCP provider contract**: `GET /manifest` endpoint ships a stable provider manifest and tool catalog; `src/manifest.ts` builds it dynamically from exported schemas.

#### Event-Driven Pipeline

- [~] **Blackboard activity ingestion**: webhook *subscription* CRUD shipped (`src/tools/webhook-tools.ts`, PR #109) — admin-gated register/list/update/delete against Blackboard's webhook API. Defining a normalized event schema and actually consuming inbound events is not started — see 2027.
- [ ] **Event pipeline stub**: accept Blackboard LTI/webhook events and emit structured signals for downstream consumers (analytics, alerts, agent triggers). See 2027.

### User Safety & Institutional Compliance

- [x] **RBAC enforcement**: student, instructor, admin, and parent roles enforced via `src/rbac.ts` + `src/auth.ts`; deny-by-default for unregistered tools.
- [x] **Data access audit logging**: structured JSON audit events (access.granted / access.denied) written to stdout; suitable for Datadog, CloudWatch, Loki, etc.
- [x] **PII handling policy — audit logs**: `src/privacy.ts` scrubs sensitive text before log emission; audit log subjects are SHA-256 hashed; raw user IDs are never written to logs.
- [x] **PII handling policy — tool outputs** (2026-09): `src/output-scrub.ts` scrubs email addresses out of every MCP tool response before it leaves the server, wired centrally into `withMetrics()` so no handler can forget it. This closes the gap flagged in the 2026-08-22 and 2026-08-28 audits — student/instructor/admin/parent tool *responses* were unscrubbed even though log emission was. See `docs/archive/` note below on why this doesn't also strip embedded long-ID tokens from free text.
- [x] **Rate limiting and abuse protection**: per-role per-minute call limits in `src/auth.ts`; configurable via `RATE_LIMIT_*_PER_MINUTE`; exceeded limit returns an `AuthorizationError` with retry guidance (see `src/auth.ts` for the actual error shape).
- [x] **FERPA gate coverage for the admin tool surface** (2026-09): `list_users`, `get_user`, `list_enrollments`, and `list_audit_logs` now require `ferpa_authorized: true` by default, not just role=admin — closing a gap where the full user/enrollment/audit directory was reachable with only a role check.
- [x] **Audit logging hardening + admin tool surface exposure** (2026-09): `src/auth.ts` keeps a bounded (1000-entry) in-memory access-audit trail; `list_audit_logs` now returns it (`localAuditTrail`) alongside the upstream Blackboard `/audit/logs` response, and as a real fallback — not just an explanatory note — when that endpoint isn't available on a given Blackboard instance.

### Foundation Completion

> Note: Implementation is complete; MCP Inspector validation ([/]) remains in-progress.

- [/] Pass MCP Inspector with stdio transport.
- [ ] Add JSON schemas for all shipped tool inputs.

## 2026 Q3 - Enterprise Follow-On

- [x] **Instructor assignment creation flow** (2026-09): `create_assignment` (`src/tools/grade-writeback.ts`) creates the student-visible content item and its linked, gradable grade column in one call — the gap left after grade write-back (`create_grade_column`, `update_grade`, etc.) shipped without a way to create the assignment itself.
- [x] Grade write-back flows (`create_grade_column`, `update_grade`, `delete_grade`, `exempt_grade`, `get_grade_column`) — shipped on PR #109.
- [x] Harden audit logging and expose it via the admin tool surface — see User Safety section above.
- [ ] Evaluate event-driven pipeline scaling: handle high-volume submission bursts and grade-sync events. See 2027.
- [ ] Evaluate vector store integration for semantic course content search and AI recommendation signals. See 2027.
- [ ] Publish a stable MCP client SDK / integration contract so agent-board and other consumers can bind without coupling to internals. See 2027.
- [ ] **Webhook-to-SSE bridge** — accept incoming Blackboard LTI/REST webhook events and broadcast them as SSE events on the MCP transport so agents can react to grade posts, submissions, and roster changes in real time without polling. Building block landed on PR #109: `src/tools/webhook-tools.ts` adds admin-gated CRUD for *registering* webhook subscriptions with Blackboard, but nothing yet receives an inbound webhook call or bridges it to the existing SSE transport (`src/index.ts` SSE is currently only wired to `search_course_materials`). See 2027.
- [ ] **Tool call batching** — allow a single agent request to specify multiple tool calls against the same courseId (e.g., contents + announcements + grades in one round-trip) and receive a combined response; reduces latency for multi-context agent queries. See 2027.

## 2027

Items below need a real subsystem — a new data store, an inbound HTTP surface, a background worker, or a published/versioned client contract — not a tool-handler-sized change. Rather than half-build these under Q3, they're written up here for scoping when the quarter starts.

- **Webhook-to-SSE bridge**. Requires: an inbound HTTP endpoint that authenticates Blackboard's webhook callback (shared-secret or signature verification — Blackboard's webhook payloads aren't self-authenticating), a mapping from webhook subscription → active SSE session(s), and backpressure/reconnect handling on the SSE side beyond the current single-tool (`search_course_materials`) stream. `src/tools/webhook-tools.ts` already covers subscription CRUD; this is the missing "receive and fan out" half.
- **Event-driven pipeline / Blackboard activity ingestion**. Requires a normalized event schema (grade posts, submissions, login activity, course changes) shared between the webhook bridge above and any future consumer, plus a decision on durable storage (queue vs. append log) before "scaling to high-volume submission bursts" is even meaningful to evaluate.
- **Analytics / Product Owner tools**. Event telemetry tap + engagement metrics aggregation implies the event pipeline above exists first; this is downstream of it, not parallel to it.
- **Vector store integration** for semantic course content search and AI recommendation signals. Requires picking and standing up a vector store, an embedding/indexing pipeline for course content (with the same RBAC/FERPA boundaries the existing read tools enforce — a semantic index that lets one student's query surface another student's content would be a regression, not a feature), and a re-indexing strategy as Blackboard content changes.
- **Stable MCP client SDK / integration contract**. `GET /manifest` already gives agent-board and other consumers a discoverable contract; a published, versioned SDK on top of it is a separate deliverable (semver policy, changelog, a consuming client to validate against) rather than a bb-mcp-only change.
- **Tool call batching**. Combining multiple tool calls against one courseId into a single round-trip needs a batch request/response envelope at the MCP boundary and a decision on partial-failure semantics (one call in the batch fails — does the whole batch fail, or does the caller get a per-call status array?). Small in isolation, but touches the transport layer (`src/index.ts`) broadly enough to warrant its own design pass rather than folding into this cycle.

## Notes

- Q2 critical path: foundation completion → multi-persona read tools → RBAC + audit logging → streaming + agent patterns. Complete as of 2026-08-29 (PR #109 merged).
- This server is the primary demonstration of full-stack AI product engineering capability for the Anthology AI Product Engineer role.
- User safety and institutional data compliance are non-negotiable and must gate every write-back feature.
- Analytics and product-owner tooling should be built to show event-driven pipeline design (RAG-ready signal format preferred) — deferred to 2027, see above.
- Portfolio showcase UI (streaming chat, multi-persona demo) belongs in agent-board Q3, not here; bb-mcp only needs a stable MCP contract and a documented integration guide.

<!--
AGENT INSTRUCTIONS:
1. Keep the roadmap quarter-first and foundation-first.
2. Use short milestones, not narrative blocks.
3. Keep detailed task mechanics in TASKS.md.
4. Before writing "open/blocked/CI failing" about a PR, verify against git log — a prior audit cycle documented PR #109 as open for a full week after it had actually merged.
-->
