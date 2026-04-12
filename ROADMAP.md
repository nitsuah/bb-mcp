# ROADMAP

Last Updated: 2026-04-11

## 2025 Q1 - Foundation

- [x] Establish the TypeScript MCP server baseline.
- [/] Continue the core Blackboard API wrapper.
- [/] Continue the MCP stdio transport refactor.
- [x] Design RBAC after auth is stable.

## 2025 Q2 - First Core Tools

- [ ] Ship `list_courses` and `get_course_contents`.
- [ ] Finish OAuth2 flow support for production use.
- [ ] Decide how dual transport fits after stdio is stable.
- [ ] Improve error mapping for Blackboard API failures.

## 2026 Q1 - Foundation Reset

- [ ] Complete the API wrapper and OAuth2 path.
- [ ] Pass MCP Inspector with the stdio transport.
- [ ] Add JSON schemas for the first tools.
- [ ] Keep RBAC, telemetry, and error mapping ready behind the foundation work.

## 2026 Q2 - Read and Write Workflows

### CEO Priority — Anthology AI Product Engineer Alignment
> Build bb-mcp beyond a prototype and into a demonstration-grade MCP server that shows full-stack AI product engineering across every Blackboard user persona.

#### Multi-Persona Tool Coverage
- [/] **Student tools**: course discovery and content navigation now ship via `list_courses` / `get_course_contents` aliases; assignment submission, grade read-back, and announcement read still need completion.
- [ ] **Teacher/Instructor tools**: assignment management, grade write-back, course announcement publish, attendance/roster read.
- [ ] **Admin tools**: user management (read), enrollment management, institutional audit log access.
- [ ] **Parent tools** (read-only, guardian-scoped): student enrollment view, grade summary, upcoming assignment alerts.
- [ ] **Analytics/Product Owner tools**: event telemetry tap, engagement metrics aggregation, AI recommendation signal export.

#### AI Orchestration Surface
- [x] **Streaming response support**: emit SSE / chunked-transfer responses from the MCP server layer so downstream clients can stream results.
- [ ] **Structured output schemas**: emit typed, schema-validated outputs for every tool so agent clients can reliably parse results.
- [ ] **MCP provider contract**: publish a stable tool manifest and capability schema so agent-board can bind to bb-mcp as a first-class MCP provider without internal coupling.
- [x] **CLI inspection surface**: support manifest/tool inspection and environment doctor commands so implementers can validate the server without booting a full MCP client.
- [x] **Blackboard probe command**: validate credential readiness and a minimal Blackboard API call from the CLI for standalone operator checks.
- [x] **Standalone container backport**: keep agent-board's integration intact while giving bb-mcp its own repo-local compose commands and a more confined standalone runtime.

#### Event-Driven Pipeline
- [ ] **Blackboard activity ingestion**: define an event schema for grade posts, submission events, login activity, and course changes.
- [ ] **Event pipeline stub**: accept Blackboard LTI/webhook events and emit structured signals for downstream consumers (analytics, alerts, agent triggers).

#### User Safety & Institutional Compliance
- [ ] **RBAC enforcement**: student, instructor, admin, parent, and analytics roles must each see only their permitted data.
- [ ] **Data access audit logging**: structured audit events for every privileged read/write operation; institutional compliance ready.
- [/] **PII handling policy**: define and enforce PII boundaries (student names, grades, IDs) in all tool outputs; scrub and redact in logs.
- [/] **Rate limiting and abuse protection**: per-role rate limits to prevent bulk data extraction.

#### Foundation Completion
- [x] Finish `list_courses` and `get_course_contents` tools (carry from prior roadmap).
- [ ] Finish OAuth2 Authorization Code flow for production token handling.
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