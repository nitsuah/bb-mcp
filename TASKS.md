# TASKS

Last Updated: 2026-08-28

## Done

- [x] Develop the Blackboard API client wrapper (`src/bb-client.ts`).
  - OAuth2 client credentials + auto-refresh implemented; full typed wrapper covers courses, grades, assignments, announcements, users, attempts, discussion posts, and announcement creation.

- [x] Refactor stdio transport for MCP compliance.
  - `StdioServerTransport` wired via `@modelcontextprotocol/sdk`; HTTP Streamable transport also implemented. MCP Inspector pass is tracked as a separate P2 task.

- [x] Ship `create_assignment_submission`.
  - Student write tool fully implemented in `src/tools/student.ts` with input validation, RBAC gate (student/admin), and attempt creation via `bbClient.createAttempt()`.

- [x] **[Q2-CEO] PII handling policy (audit logs)** — enforce PII scrubbing in audit log emission; raw student IDs and caller identifiers are never written to logs.
  - `src/auth.ts` audit logs emit hashed `subject` values (`anon:<sha256[:12]>`) instead of raw `userId`; `src/privacy.ts` scrubs email and long-ID patterns before any log emission.
  - `tests/auth-privacy.test.ts` verifies no raw caller identifier appears in granted/denied audit log lines.
  - Note: tool-output PII scrubbing (student names, grades, IDs returned by `src/tools/student.ts` and `src/tools/instructor.ts`) is a separate pending work item — see P2 tasks below.

- [ ] **[P2] Tool-output PII scrubbing** — add a shared output scrubber applied to all tool handler return values in `src/tools/student.ts` and `src/tools/instructor.ts`; cover student IDs, names, email addresses, grades, and feedback with tests for both modules.
  - Context: current PII policy covers only audit logs; raw student data is still returned in tool output payloads.
  - Acceptance Criteria: a shared scrubber function is applied before tool results are returned to the MCP client; tests verify no raw PII appears in student/instructor tool responses.

- [x] **[Q2-CEO] Rate limiting per role** — add per-role rate limits to prevent bulk data extraction by any authenticated client.
  - `src/auth.ts` enforces in-memory per-role per-minute limits before tool execution; denial messages include retry-after interval.
  - `RATE_LIMIT_STUDENT_PER_MINUTE` / `RATE_LIMIT_INSTRUCTOR_PER_MINUTE` / `RATE_LIMIT_ADMIN_PER_MINUTE` in `src/config.ts` and `.env.example`.
  - `tests/rate-limit.test.ts` verifies enforcement behavior.

- [x] Audit logging.
  - Structured JSON audit events (granted/denied) written to stdout via `src/auth.ts`; suitable for Datadog, CloudWatch, Loki, etc.

- [x] **[Q2-CEO] MCP provider contract** — publish discoverable manifest endpoint.
  - `src/manifest.ts` builds provider manifest from exported tool schemas; `GET /manifest` endpoint registered in HTTP server.
  - `tests/manifest.test.ts` verifies contract shape and tool coverage.

## In Progress

- [/] Pass MCP Inspector with stdio transport.
  - Priority: P2
  - Context: stdio transport implementation exists but MCP Inspector compliance has not been formally validated.
  - Acceptance Criteria: `node dist/index.js --stdio` passes MCP Inspector without errors.

## Todo

### P1 - High

### P2 - Medium

- [ ] Add JSON schemas for all shipped tool inputs.

- [ ] Improve Blackboard error mapping.
  - Priority: P2
  - Context: raw Blackboard REST errors are not yet translated into usable user messages.
  - Acceptance Criteria: common REST failures map to clear server responses.

- [ ] Add per-request lifecycle tracing.
  - Priority: P2
  - Context: Prometheus tool-call metrics exist but per-request lifecycle tracing (request ID, latency breakdown, upstream call count) is missing.
  - Acceptance Criteria: each tool call emits a structured trace entry; latency breakdown is visible.

### P3 - Exploratory

- [ ] Add `search_users` (admin directory lookup).
  - Priority: P3
  - Context: admin directory lookup is useful, but not part of the initial foundation path.
  - Acceptance Criteria: administrators can query user records safely.

- [ ] **Analytics/Product Owner tools**: event telemetry tap, engagement metrics aggregation, AI recommendation signal export.
- [ ] **Blackboard activity ingestion**: define an event schema for grade posts, submission events, login activity, and course changes.
- [ ] **Event pipeline stub**: accept Blackboard LTI/webhook events and emit structured signals for downstream consumers (analytics, alerts, agent triggers).


### P4 - Q3 Enterprise Follow-On

- [ ] Fix PR #109 (`quality-gates` CI failure, `CHANGES_REQUESTED` review) blocking admin/parent/grade-write-back/webhook-subscription tools.
  - Priority: P1
  - Context: implementation for admin tools, parent tools, grade write-back, and webhook-subscription CRUD all landed on this one branch (`feat/add-admin-parent-grade-webhook-tools`), opened 2026-08-26, but CI has been red since then and the review is unaddressed.
  - Acceptance Criteria: `quality-gates` passes, review threads resolved or replied to, PR merged to main.
- [ ] Add instructor assignment creation flow (grade write-back itself is implemented — see PR #109 above).
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
