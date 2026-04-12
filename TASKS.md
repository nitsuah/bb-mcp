# TASKS

Last Updated: 2026-04-11

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

- [ ] **[Q2-CEO] Multi-persona tools** — ship student, instructor, admin, and parent tool variants sequentially after the OAuth2 and RBAC foundations are in place.
  - Priority: P1
  - Context: the Anthology AI Product Engineer role requires demonstrating full-stack coverage across all Blackboard user personas; this is the primary differentiator.
  - Acceptance Criteria: at minimum, student (`list_courses`, `get_course_contents`, `get_announcements`, `create_assignment_submission`) and instructor (`list_roster`, `get_grades`) tools pass MCP Inspector, have JSON schemas, and are gated behind their respective roles.

- [x] **[Q2-CEO] MCP provider contract** — publish a stable tool manifest and capability schema so agent-board can bind to bb-mcp as a declared MCP provider.
  - Priority: P1
  - Context: agent-board treats bb-mcp as an optional MCP container; a published contract allows the frontend to load tool definitions without coupling to internals.
  - Acceptance Criteria: a discoverable manifest endpoint exists; agent-board can list bb-mcp tools dynamically.
  - Completed: 2026-04-03
  - Evidence: `GET /manifest` now returns provider capabilities + dynamic tool manifest generated from exported tool schemas.

- [x] **[Q2-CEO] HTTP SSE transport** — expose a dedicated HTTP SSE endpoint from the MCP server so downstream clients can stream tool output.
  - Priority: P1
  - Context: the Anthology role explicitly requires streaming AI responses; this is the server-side half for agent-board over HTTP, while the MCP stdio transport remains in place for SDK/MCP Inspector compatibility.
  - Acceptance Criteria: at least one tool streams incremental results via the HTTP SSE endpoint; agent-board streaming UI can consume it without buffering the full payload first; existing MCP stdio transport behavior continues to pass Inspector.
  - Completed: 2026-04-11
  - Evidence: `src/index.ts` now exposes `GET /sse/search-course-materials` and streams incremental `chunk` events for `search_course_materials` results.
  - Evidence: `README.md` documents the dedicated SSE endpoint alongside existing MCP/health/metrics/manifest routes.

- [x] Backport standalone Docker/compose commands from agent-board.
  - Priority: P1
  - Context: agent-board currently carries the most practical bb-mcp compose wiring (`BB_MCP_ENABLED`, opt-in profile, sibling-repo env loading); bb-mcp should gain its own confined standalone commands/config without removing the agent-board integration.
  - Acceptance Criteria: bb-mcp documents and ships a standalone container path with repo-local compose commands/env expectations, while agent-board can keep its existing integration unchanged.
  - Completed: 2026-04-11
  - Evidence: `docker-compose.yml` now defines a more confined standalone runtime with read-only filesystem, dropped capabilities, `no-new-privileges`, and repo-local `PUBLIC_BASE_URL` defaults.
  - Evidence: `Makefile` now exposes `docker-up`, `docker-down`, `docker-logs`, `docker-doctor`, `docker-probe`, `docker-manifest`, and `docker-tools`.
  - Evidence: `README.md` and `.env.example` document the standalone command set and env expectations.

- [x] Ship the `list_courses` tool.
  - Priority: P1
  - Context: course discovery is the base dependency for course-scoped workflows.
  - Acceptance Criteria: a user can retrieve enrolled courses through the MCP server.
  - Completed: 2026-04-11
  - Evidence: `src/tools/student.ts` now exposes `list_courses` as a compatibility alias backed by the existing course retrieval handler.
  - Evidence: `src/index.ts`, `src/manifest.ts`, and manifest/schema tests now publish and validate the alias tool.

- [x] Ship the `get_course_contents` tool.
  - Priority: P1
  - Context: content navigation is required before announcements, assignments, and grading workflows.
  - Acceptance Criteria: the tool returns usable course hierarchy data.
  - Completed: 2026-04-11
  - Evidence: `src/tools/student.ts` now exposes `get_course_contents` as a compatibility alias backed by the existing course content handler.
  - Evidence: `src/index.ts`, `src/manifest.ts`, and manifest/schema tests now publish and validate the alias tool.

- [ ] Finish OAuth2 Authorization Code flow support.
  - Priority: P1
  - Context: production-safe token handling is still a blocking foundation item.
  - Acceptance Criteria: the server completes a secure OAuth2 flow and manages tokens correctly.

- [/] Add JSON schemas for MCP tool parameters.
  - Priority: P1
  - Context: input validation and spec compliance are incomplete.
  - Acceptance Criteria: core tool inputs are schema-backed and validated.
  - Progress: `src/manifest.ts` now publishes a shared `outputSchema` for every tool so clients can parse a typed text-content envelope consistently.
  - Progress: `tests/manifest.test.ts` now validates output schema presence for published tools.

### P2 - Medium

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

- [x] Add RBAC middleware.
  - Priority: P2
  - Context: role separation is required before broader classroom workflows can ship safely.
  - Acceptance Criteria: student, instructor, and admin paths are constrained before the API call layer.
  - Evidence: `src/rbac.ts` now defines a shared role-policy matrix used by both `src/auth.ts` enforcement and `src/manifest.ts` role publication; auth now denies unknown/unregistered tools by default.

- [x] Ship `get_announcements`.
  - Priority: P2
  - Context: announcements are a low-risk read flow that should follow course and content support.
  - Acceptance Criteria: the tool returns course and system announcements.
  - Completed: 2026-04-12
  - Evidence: `src/tools/student.ts` exports `getAnnouncementsHandler` with full auth/metrics wrapping and zod schema; tool is registered in `src/index.ts` and `src/manifest.ts`; RBAC policy includes `get_announcements: ['student', 'instructor', 'admin']`; Docker test suite passes.

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

### P3 - Exploratory

- [ ] Add `search_users`.
  - Priority: P3
  - Context: admin directory lookup is useful, but not part of the initial foundation path.
  - Acceptance Criteria: administrators can query user records safely.

- [ ] Add audit logging.
  - Priority: P3
  - Context: compliance-grade audit trails depend on the earlier auth and RBAC work.
  - Acceptance Criteria: structured audit events are captured for privileged operations.

## Done

- [x] Add CLI inspection and doctor commands.
  - Completed: 2026-04-11
  - Evidence: `src/cli.ts` now supports `--help`, `--version`, `--manifest`, `--tools`, and `--doctor` without requiring Blackboard credentials.
  - Evidence: `tests/cli.test.ts` validates argument parsing, safe doctor reporting, and tool catalog formatting.

- [x] Add Blackboard probe command.
  - Completed: 2026-04-11
  - Evidence: `src/cli.ts` now supports `--probe` to validate Blackboard credentials and a minimal API request.
  - Evidence: `tests/cli.test.ts` covers probe CLI parsing and formatted probe output.

- [x] TypeScript project setup with MCP SDK and baseline tooling.

<!--
AGENT INSTRUCTIONS:
1. Keep the foundation work separate from later tools.
2. Use short task bullets with one context line and one acceptance line.
3. Move finished items to Done.
-->