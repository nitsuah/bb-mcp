# ROADMAP

Last Updated: 2026-08-22

## 2025–2026 Q1 ✅

> Foundation complete — TypeScript MCP server, RBAC, OAuth2, student/instructor tools, CLI, standalone Docker. See FEATURES.md for shipped capabilities.

## 2026 Q2 - Read and Write Workflows ✅ (mostly complete)

### Multi-Persona Tool Coverage

- [x] **Student tools**: all core read and write tools shipped — `get_my_courses`, `get_upcoming_assignments`, `get_my_grades`, `get_course_content`, `get_assignment_feedback`, `get_announcements`, `create_assignment_submission`.
- [x] **Teacher/Instructor tools**: read tools shipped — `list_roster`, `get_grades`, `get_submission_status`, `get_grade_distribution`, `get_discussion_summary`, `get_at_risk_students`, `draft_announcement`. Grade write-back deferred to Q3.
- [ ] **Admin tools**: user management (read), enrollment management, institutional audit log access.
- [ ] **Parent tools** (read-only, guardian-scoped): student enrollment view, grade summary, upcoming assignment alerts.
- [ ] **Analytics/Product Owner tools**: event telemetry tap, engagement metrics aggregation, AI recommendation signal export.

### AI Orchestration Surface

- [x] **MCP provider contract**: `GET /manifest` endpoint ships a stable provider manifest and tool catalog; `src/manifest.ts` builds it dynamically from exported schemas.

#### Event-Driven Pipeline

- [ ] **Blackboard activity ingestion**: define an event schema for grade posts, submission events, login activity, and course changes.
- [ ] **Event pipeline stub**: accept Blackboard LTI/webhook events and emit structured signals for downstream consumers (analytics, alerts, agent triggers).

### User Safety & Institutional Compliance

- [x] **RBAC enforcement**: student, instructor, and admin roles enforced via `src/rbac.ts` + `src/auth.ts`; deny-by-default for unregistered tools.
- [x] **Data access audit logging**: structured JSON audit events (access.granted / access.denied) written to stdout; suitable for Datadog, CloudWatch, Loki, etc.
- [x] **PII handling policy**: `src/privacy.ts` scrubs sensitive text before log emission; audit log subjects are SHA-256 hashed; raw user IDs are never written to logs.
- [x] **Rate limiting and abuse protection**: per-role per-minute call limits in `src/auth.ts`; configurable via `RATE_LIMIT_*_PER_MINUTE`; 429 responses include retry-after interval.

### Foundation Completion

> Note: Implementation is complete; MCP Inspector validation ([/]) remains in-progress.

- [/] Pass MCP Inspector with stdio transport.
- [ ] Add JSON schemas for all shipped tool inputs.

## 2026 Q3 - Enterprise Follow-On

- [ ] Add instructor assignment creation and grade write-back flows.
- [ ] Harden audit logging and expose it via the admin tool surface.
- [ ] Evaluate event-driven pipeline scaling: handle high-volume submission bursts and grade-sync events.
- [ ] Evaluate vector store integration for semantic course content search and AI recommendation signals.
- [ ] Publish a stable MCP client SDK / integration contract so agent-board and other consumers can bind without coupling to internals.
- [ ] **Webhook-to-SSE bridge** — accept incoming Blackboard LTI/REST webhook events and broadcast them as SSE events on the MCP transport so agents can react to grade posts, submissions, and roster changes in real time without polling.
- [ ] **Tool call batching** — allow a single agent request to specify multiple tool calls against the same courseId (e.g., contents + announcements + grades in one round-trip) and receive a combined response; reduces latency for multi-context agent queries.

## Notes

- Q2 critical path: foundation completion → multi-persona read tools → RBAC + audit logging → streaming + agent patterns.
- This server is the primary demonstration of full-stack AI product engineering capability for the Anthology AI Product Engineer role.
- User safety and institutional data compliance are non-negotiable and must gate every write-back feature.
- Analytics and product-owner tooling should be built to show event-driven pipeline design (RAG-ready signal format preferred).
- Portfolio showcase UI (streaming chat, multi-persona demo) belongs in agent-board Q3, not here; bb-mcp only needs a stable MCP contract and a documented integration guide.

<!--
AGENT INSTRUCTIONS:
1. Keep the roadmap quarter-first and foundation-first.
2. Use short milestones, not narrative blocks.
3. Keep detailed task mechanics in TASKS.md.
-->
