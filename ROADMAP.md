# ROADMAP

Last Updated: 2026-06-08

## 2025–2026 Q1 ✅

> Foundation complete — TypeScript MCP server, RBAC, OAuth2, student/instructor tools, CLI, standalone Docker. See FEATURES.md for shipped capabilities.

## 2026 Q2 - Read and Write Workflows (In Progress)

### Multi-Persona Tool Coverage
- [/] **Student tools**: assignment submission, grade read-back, and announcement read still need completion.
- [/] **Teacher/Instructor tools**: assignment management, grade write-back, and course announcement publish still need completion.
- [ ] **Admin tools**: user management (read), enrollment management, institutional audit log access.
- [ ] **Parent tools** (read-only, guardian-scoped): student enrollment view, grade summary, upcoming assignment alerts.
- [ ] **Analytics/Product Owner tools**: event telemetry tap, engagement metrics aggregation, AI recommendation signal export.

### AI Orchestration Surface
- [ ] **MCP provider contract**: publish a stable tool manifest and capability schema so agent-board can bind to bb-mcp as a first-class MCP provider without internal coupling.

#### Event-Driven Pipeline
- [ ] **Blackboard activity ingestion**: define an event schema for grade posts, submission events, login activity, and course changes.
- [ ] **Event pipeline stub**: accept Blackboard LTI/webhook events and emit structured signals for downstream consumers (analytics, alerts, agent triggers).

### User Safety & Institutional Compliance
- [ ] **RBAC enforcement**: student, instructor, admin, parent, and analytics roles must each see only their permitted data.
- [ ] **Data access audit logging**: structured audit events for every privileged read/write operation; institutional compliance ready.
- [/] **PII handling policy**: define and enforce PII boundaries (student names, grades, IDs) in all tool outputs; scrub and redact in logs.
- [/] **Rate limiting and abuse protection**: per-role rate limits to prevent bulk data extraction.

### Foundation Completion
- [ ] Pass MCP Inspector with stdio transport.
- [ ] Add JSON schemas for all shipped tool inputs.

## 2026 Q3 - Enterprise Follow-On

- [ ] Add instructor assignment creation and grade write-back flows.
- [ ] Harden audit logging and expose it via the admin tool surface.
- [ ] Evaluate event-driven pipeline scaling: handle high-volume submission bursts and grade-sync events.
- [ ] Evaluate vector store integration for semantic course content search and AI recommendation signals.
- [ ] Publish a stable MCP client SDK / integration contract so agent-board and other consumers can bind without coupling to internals.

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
