# TASKS

**Last Updated:** 2026-03-27 | PMO audit — MCP server, early-stage, half architecture complete

## Status

### In Progress (Foundation)

- [/] **Refactor stdio transport for MCP compliance** (P1, M) — Core protocol layer
- [/] **Develop Blackboard API client wrapper** (P1, L) — TypeScript wrapper for OAuth2 + REST endpoints

### P1 — High Priority (Shipping Multiplier)

- [ ] **`list_courses` tool** (P1, M) — Retrieve user's enrolled courses (foundation for all course-scoped tools)
- [ ] **`get_course_contents` tool** (P1, M) — Browse Blackboard course hierarchy (content modules, items)
- [ ] **OAuth2 Authorization Code flow** (P1, L) — Secure token handling for production
- [ ] **JSON schemas for MCP tool parameters** (P1, S) — Spec compliance; input validation

### P2 — Medium Priority (Polish & Security)

- [ ] **RBAC middleware** (P2, M) — Role-based access control (Student vs. Instructor vs. Admin); FERPA compliance
- [ ] **`get_announcements` tool** (P2, S) — Course and system announcements
- [ ] **`create_assignment_submission` tool** (P2, L) — Student workflow; attachment support
- [ ] **Error mapping** (P2, M) — Blackboard REST API status codes → user-friendly errors
- [ ] **Telemetry & logging** (P3, M) — MCP request/response lifecycle tracing

### P3 — Low Priority (Admin & Exploratory)

- [ ] **`search_users` tool** (P3, S) — Admin directory lookup
- [ ] **Audit logging** (P3, M) — Structured JSON audit trail for regulatory compliance

### Done

- [x] TypeScript project setup + MCP SDK + ESLint/Prettier

---

<!--
AGENT INSTRUCTIONS:
Prioritization reflects MCP foundation-first approach:
1. Foundation (transport, API wrapper) enables all tools
2. P1 tools (courses, contents, OAuth) unlock base LLM workflows
3. P2 tools (announcements, submissions, RBAC) enable real-world use
4. P3 (admin, audit) = enterprise/governance features
-->
1. Move tasks between sections as status changes
2. Mark completed tasks with [x] and move to "Done"
3. Add new tasks to "Todo" section
4. Keep descriptions actionable and concise
-->