# TASKS

Last Updated: 2026-06-08

## In Progress

- [/] Refactor stdio transport for MCP compliance.
  - Priority: P1
  - Context: the protocol layer still needs cleanup before the server can pass MCP Inspector reliably.
  - Acceptance Criteria: stdio transport follows MCP expectations and integrates cleanly with the SDK.

- [/] Develop the Blackboard API client wrapper.
  - Priority: P1
  - Context: OAuth2 and Blackboard REST access still need a stable typed wrapper before more tools can ship.
  - Acceptance Criteria: the client wrapper handles auth and core Blackboard requests for downstream tool work.

## Todo

### P1 - High

- [ ] Ship `create_assignment_submission`.
  - Priority: P2
  - Context: write-back submission support depends on the auth and content foundation.
  - Acceptance Criteria: a student submission path exists, including attachment handling.

- [ ] Improve Blackboard error mapping.
  - Priority: P2
  - Context: raw Blackboard REST errors are not yet translated into usable user messages.
  - Acceptance Criteria: common REST failures map to clear server responses.

- [ ] Add telemetry and request logging.
  - Priority: P2
  - Context: the server needs clearer request and response tracing before shipping more workflows.
  - Acceptance Criteria: request lifecycle tracing is documented and visible.

- [/] **[Q2-CEO] PII handling policy** — define and enforce PII scrubbing for student names, grades, and IDs in all tool outputs and server logs.
  - Priority: P2
  - Context: institutional compliance requires zero PII leakage into telemetry, audit logs, or error messages.
  - Acceptance Criteria: tool outputs have a documented PII boundary; a scrub middleware runs before any log/metric emission; tests verify PII does not appear in logs.
  - Progress: `src/auth.ts` audit logs now emit hashed `subject` values instead of raw `userId`, and `src/privacy.ts` scrubs sensitive text patterns before log emission.
  - Progress: `tests/auth-privacy.test.ts` verifies no raw caller identifier appears in granted/denied audit log lines.

- [/] **[Q2-CEO] Rate limiting per role** — add per-role rate limits to prevent bulk data extraction by any authenticated client.
  - Priority: P2
  - Context: institutional data protection requires abuse controls even for authenticated users.
  - Acceptance Criteria: student and instructor roles have enforced per-minute call limits; 429 responses include a retry-after header.
  - Progress: `src/auth.ts` now enforces in-memory per-role per-minute limits before tool execution and includes retry-after guidance in denial messages.
  - Progress: `src/config.ts` and `.env.example` now expose `RATE_LIMIT_*_PER_MINUTE` configuration; `tests/rate-limit.test.ts` verifies enforcement behavior.

### P2 - Medium

- [ ] Pass MCP Inspector with stdio transport.
  - Priority: P1

- [ ] Add JSON schemas for all shipped tool inputs.

### P3 - Exploratory

- [ ] Add `search_users`.
  - Priority: P3
  - Context: admin directory lookup is useful, but not part of the initial foundation path.
  - Acceptance Criteria: administrators can query user records safely.

- [ ] Add audit logging.
  - Priority: P3
  - Context: compliance-grade audit trails depend on the earlier auth and RBAC work.
  - Acceptance Criteria: structured audit events are captured for privileged operations.

- [ ] **Admin tools**: user management (read), enrollment management, institutional audit log access.
- [ ] **Parent tools** (read-only, guardian-scoped): student enrollment view, grade summary, upcoming assignment alerts.
- [ ] **Analytics/Product Owner tools**: event telemetry tap, engagement metrics aggregation, AI recommendation signal export.
- [ ] **Blackboard activity ingestion**: define an event schema for grade posts, submission events, login activity, and course changes.
- [ ] **Event pipeline stub**: accept Blackboard LTI/webhook events and emit structured signals for downstream consumers (analytics, alerts, agent triggers).

### P4 - Q3 Enterprise Follow-On

- [ ] Add instructor assignment creation and grade write-back flows.
- [ ] Harden audit logging and expose it via the admin tool surface.
- [ ] Evaluate event-driven pipeline scaling: handle high-volume submission bursts and grade-sync events.
- [ ] Evaluate vector store integration for semantic course content search and AI recommendation signals.
- [ ] Publish a stable MCP client SDK / integration contract so agent-board and other consumers can bind without coupling to internals.

<!--
AGENT INSTRUCTIONS:
1. Keep the foundation work separate from later tools.
2. Use short task bullets with one context line and one acceptance line.
3. Move finished items to Done.
-->
