# TASKS

Last Updated: 2026-03-27

## In Progress

- [/] Refactor stdio transport for MCP compliance.
  - Priority: P1
  - Context: the protocol layer still needs cleanup before the server can pass MCP Inspector reliably.
  - Acceptance Criteria: stdio transport follows MCP expectations and integrates cleanly with the SDK.

- [/] Develop the Blackboard API client wrapper.
  - Priority: P1
  - Context: OAuth2 and Blackboard REST access still need a stable typed wrapper before more tools can ship.
  - Acceptance Criteria: the client wrapper handles auth and core Blackboard requests for downstream tool work.

## P1 - High

- [ ] Ship the `list_courses` tool.
  - Priority: P1
  - Context: course discovery is the base dependency for course-scoped workflows.
  - Acceptance Criteria: a user can retrieve enrolled courses through the MCP server.

- [ ] Ship the `get_course_contents` tool.
  - Priority: P1
  - Context: content navigation is required before announcements, assignments, and grading workflows.
  - Acceptance Criteria: the tool returns usable course hierarchy data.

- [ ] Finish OAuth2 Authorization Code flow support.
  - Priority: P1
  - Context: production-safe token handling is still a blocking foundation item.
  - Acceptance Criteria: the server completes a secure OAuth2 flow and manages tokens correctly.

- [ ] Add JSON schemas for MCP tool parameters.
  - Priority: P1
  - Context: input validation and spec compliance are incomplete.
  - Acceptance Criteria: core tool inputs are schema-backed and validated.

## P2 - Medium

- [ ] Add RBAC middleware.
  - Priority: P2
  - Context: role separation is required before broader classroom workflows can ship safely.
  - Acceptance Criteria: student, instructor, and admin paths are constrained before the API call layer.

- [ ] Ship `get_announcements`.
  - Priority: P2
  - Context: announcements are a low-risk read flow that should follow course and content support.
  - Acceptance Criteria: the tool returns course and system announcements.

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

## P3 - Exploratory

- [ ] Add `search_users`.
  - Priority: P3
  - Context: admin directory lookup is useful, but not part of the initial foundation path.
  - Acceptance Criteria: administrators can query user records safely.

- [ ] Add audit logging.
  - Priority: P3
  - Context: compliance-grade audit trails depend on the earlier auth and RBAC work.
  - Acceptance Criteria: structured audit events are captured for privileged operations.

## Done

- [x] TypeScript project setup with MCP SDK and baseline tooling.

<!--
AGENT INSTRUCTIONS:
1. Keep the foundation work separate from later tools.
2. Use short task bullets with one context line and one acceptance line.
3. Move finished items to Done.
-->