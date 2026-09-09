# TASKS

Last Updated: 2026-09-09

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

- [x] **[P2] Tool-output PII scrubbing** (2026-09) — shared output scrubber applied to every tool handler's return value before it reaches the MCP client.
  - `src/output-scrub.ts` scrubs email addresses (by field name — `email`/`emailAddress` — and by embedded pattern in any string field) out of the MCP `{ content: [...] }` envelope; wired centrally into `withMetrics()` in `src/metrics.ts` so every tool in `src/tools/*.ts` gets it automatically, not just student/instructor.
  - Deliberately does **not** reuse `privacy.ts`'s long-ID regex against free-form prose (discussion post bodies, feedback, instructor notes, student comments): a real test run against the existing `get_discussion_summary` fixture showed that pattern truncating a legitimate 300-character post body down to a single 13-character `[redacted-id]` token. Log `reason` strings are short and server-generated; tool-output prose is user-authored and can legitimately contain long unbroken tokens (URLs, pasted hashes). Only structured/embedded email addresses are scrubbed from tool output.
  - Opaque chaining identifiers (`userId`, `courseId`, `columnId`, `threadId`, `authorId`, ...) are left untouched — `list_roster`'s `userId` output feeds directly into `get_grades(userId=...)`, and masking it would break that workflow for no privacy benefit (RBAC + the FERPA gate already authorize the response).
  - Tests: `tests/output-scrub.test.ts` (unit), plus response-level assertions (no raw email survives in the serialized payload) added to `tests/tools-instructor.test.ts`, `tests/tools-student.test.ts`, `tests/tools-admin.test.ts`.

- [x] **[Q2-CEO] Rate limiting per role** — add per-role rate limits to prevent bulk data extraction by any authenticated client.
  - `src/auth.ts` enforces in-memory per-role per-minute limits before tool execution; denial messages include retry-after interval.
  - `RATE_LIMIT_STUDENT_PER_MINUTE` / `RATE_LIMIT_INSTRUCTOR_PER_MINUTE` / `RATE_LIMIT_ADMIN_PER_MINUTE` in `src/config.ts` and `.env.example`.
  - `tests/rate-limit.test.ts` verifies enforcement behavior.

- [x] Audit logging.
  - Structured JSON audit events (granted/denied) written to stdout via `src/auth.ts`; suitable for Datadog, CloudWatch, Loki, etc.

- [x] **[Q2-CEO] MCP provider contract** — publish discoverable manifest endpoint.
  - `src/manifest.ts` builds provider manifest from exported tool schemas; `GET /manifest` endpoint registered in HTTP server.
  - `tests/manifest.test.ts` verifies contract shape and tool coverage.

- [x] **Admin, parent, grade write-back, and webhook-subscription tools** — [PR #109](https://github.com/nitsuah/bb-mcp/pull/109), merged 2026-08-29.
  - Admin (`src/tools/admin.ts`): `list_users`, `get_user`, `list_enrollments`, `create_enrollment`, `update_enrollment`, `delete_enrollment`, `list_audit_logs`.
  - Parent (`src/tools/parent.ts`): `get_my_children`, `get_children_courses`, `get_children_grades`, `get_children_upcoming_assignments`, `get_children_announcements`.
  - Grade write-back (`src/tools/grade-writeback.ts`): `create_grade_column`, `update_grade`, `delete_grade`, `exempt_grade`, `get_grade_column`.
  - Webhook subscriptions (`src/tools/webhook-tools.ts`): `list_webhook_subscriptions`, `get_webhook_subscription`, `create_webhook_subscription`, `update_webhook_subscription`, `delete_webhook_subscription`.
  - Note: a prior audit cycle (2026-08-28) documented this PR as open with a failing `quality-gates` check and a `CHANGES_REQUESTED` review, blocking the roadmap. That was accurate at the time but stale by the 2026-09-02 audit — git history shows it merged 2026-08-29. Corrected in this pass.

- [x] **Instructor assignment creation flow** (2026-09).
  - `create_assignment` in `src/tools/grade-writeback.ts` creates the student-visible content item (`POST /courses/{courseId}/contents`, `contentHandler: resource/x-bb-assignment`) and its linked grade column (`POST /courses/{courseId}/gradebook/columns` with `contentId`) in one call. Wired through `src/rbac.ts` (instructor/admin), `src/manifest.ts`, `src/index.ts`.
  - If the grade-column step fails after the content item is created, the error message includes the orphaned `contentId` so the caller isn't left guessing why grading doesn't work.
  - Tests in `tests/tools-grade-writeback.test.ts` cover the success path and the partial-failure path.

- [x] **Harden audit logging and expose it via the admin tool surface** (2026-09).
  - `src/auth.ts` adds a bounded (1000-entry) in-memory ring buffer of the server's own access-audit trail (`access.granted`/`access.denied`, hashed subject only) with `getLocalAuditLogEntries()` (filterable by eventType/userId/courseId/date range).
  - `list_audit_logs` (`src/tools/admin.ts`) now returns this trail as `localAuditTrail` — always alongside a successful upstream Blackboard response, and as the actual fallback data (not just an explanatory note) when Blackboard's `/audit/logs` endpoint isn't available on a given instance.
  - `list_users`, `get_user`, `list_enrollments`, and `list_audit_logs` now require `ferpa_authorized: true` by default (`src/config.ts` `RESTRICTED_TOOLS`) — previously only role=admin gated these, meaning the full user/enrollment/audit directory was reachable without the FERPA assertion required of every other PII-bearing tool.
  - Tests in `tests/auth-privacy.test.ts` (local trail recording, filtering, bounded growth, FERPA gate coverage) and `tests/tools-admin.test.ts` (local trail surfaced through `list_audit_logs`).

## In Progress

- [/] Pass MCP Inspector with stdio transport.
  - Priority: P2
  - Context: stdio transport implementation exists but MCP Inspector compliance has not been formally validated.
  - Acceptance Criteria: `node dist/index.js --stdio` passes MCP Inspector without errors.

## Todo

### P1 - High

### P2 - Medium

- [ ] Bind `caller_identity` to real end-user authentication instead of trusting the client's claim.
  - Priority: P2
  - Context: `auth.ts` intentionally delegates end-user identity verification to the calling MCP client (documented in its module docstring) — `parseIdentity` trusts whatever `userId`/`role`/`ferpa_authorized` the request supplies. `MCP_API_KEY` (PR #115) closes the transport-level gap for any non-loopback deployment (the server refuses to start without a key at all beyond loopback, so a client without one can't reach `/mcp`) but doesn't verify that a client *holding* the key is telling the truth about who's asking — and a loopback-bound deployment still allows any local client through with no key at all, by design. The OAuth authorization-code flow in `oauth.ts` produces application-level Blackboard API sessions, not per-end-user identity tokens usable for this. Flagged by CodeRabbit on PR #115 (2026-09-09); deliberately deferred rather than redesigning the identity model blind under a review pass — needs a real design decision (e.g. requiring the calling client to forward a verified Blackboard/SSO identity token bb-mcp can validate per request) rather than a rushed fix.
  - Acceptance Criteria: a request's `caller_identity` claims are checked against some server-verifiable proof of the actual end user, not accepted as-is from the request body.

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

- [ ] **Analytics/Product Owner tools**: event telemetry tap, engagement metrics aggregation, AI recommendation signal export. See ROADMAP.md 2027 section — depends on the event pipeline below.
- [ ] **Blackboard activity ingestion**: define an event schema for grade posts, submission events, login activity, and course changes. See ROADMAP.md 2027 section.

### 2027 (moved from Q3 — needs a real subsystem, not a tool-sized change)

See ROADMAP.md `## 2027` for the full writeup on each of these.

- [ ] Webhook-to-SSE bridge — receive and authenticate inbound Blackboard webhook calls, fan out to active SSE sessions.
- [ ] Event-driven pipeline scaling — normalized event schema + durable storage decision, ahead of "scaling" being a meaningful question.
- [ ] Vector store integration for semantic course content search and AI recommendation signals — needs an RBAC/FERPA-safe indexing pipeline, not just a vector store.
- [ ] Publish a stable MCP client SDK / integration contract — a versioned deliverable on top of `GET /manifest`, separate from bb-mcp itself.
- [ ] Tool call batching — needs a batch envelope + partial-failure semantics decision at the transport layer.

<!--
AGENT INSTRUCTIONS:
1. Keep the foundation work separate from later tools.
2. Use short task bullets with one context line and one acceptance line.
3. Move finished items to Done.
4. Before describing a PR's CI/review state, check `git log` — don't trust the last audit's snapshot without re-verifying.
-->
