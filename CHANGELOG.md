# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Admin tools** (`src/tools/admin.ts`): `list_users`, `get_user`, `list_enrollments`, `create_enrollment`, `update_enrollment`, `delete_enrollment`, `list_audit_logs`.
- **Parent tools** (`src/tools/parent.ts`, guardian-scoped read-only): `get_my_children`, `get_children_courses`, `get_children_grades`, `get_children_upcoming_assignments`, `get_children_announcements`.
- **Grade write-back tools** (`src/tools/grade-writeback.ts`): `create_grade_column`, `update_grade`, `delete_grade`, `exempt_grade`, `get_grade_column`, and `create_assignment` (creates the student-visible content item and its linked grade column in one call).
- **Webhook subscription tools** (`src/tools/webhook-tools.ts`, admin only): `list_webhook_subscriptions`, `get_webhook_subscription`, `create_webhook_subscription`, `update_webhook_subscription`, `delete_webhook_subscription`.
- Tool-output PII scrubbing (`src/output-scrub.ts`): every MCP tool response is scrubbed of email addresses (by field name and embedded pattern) before it leaves the server, applied centrally via `withMetrics()`.
- Local access-audit trail (`src/auth.ts`): bounded in-memory ring buffer of `access.granted`/`access.denied` events, queryable via the `list_audit_logs` admin tool as `localAuditTrail` — independent of whether the upstream Blackboard instance has its own audit endpoint enabled.
- `.gitattributes` pinning text files to LF line endings.

### Changed

- `RESTRICTED_TOOLS` (FERPA gate) now includes `list_users`, `get_user`, `list_enrollments`, and `list_audit_logs` by default, on top of the existing instructor tools — these admin-surface tools previously required only role=admin.
- `.github/dependabot.yml`: group minor/patch npm updates and GitHub Actions updates instead of opening one PR per bump.

### Deprecated

### Removed

- Archived stale planning/handoff docs (`docs/blackboard-learn-mcp-plan.md`, `docs/blackboard-mcp-full-plan.md`, `docs/HANDOFF-mcp-provider-contract-20260403.md`) to `docs/archive/`.

### Fixed

- ROADMAP.md/TASKS.md incorrectly described PR #109 (admin/parent/grade-write-back/webhook tools) as open with failing CI and a `CHANGES_REQUESTED` review; it merged 2026-08-29. Corrected.

### Security

- Extended the FERPA gate to cover the admin directory/enrollment/audit-log tool surface (see Changed above) — these previously exposed full institutional user PII with only a role check.
- Tool-output PII scrubbing (see Added above) closes a gap flagged across the 2026-08-22 and 2026-08-28 audits: student/instructor/admin/parent tool *responses* were unscrubbed even though audit-log emission already was.

## [0.1.0] - 2026-06-08

### Added

- TypeScript MCP server wrapping the Blackboard Learn REST API.
- HTTP Streamable transport (default, port 3100) and stdio transport (`--stdio`) via `@modelcontextprotocol/sdk`.
- **Student tools**: `get_my_courses`, `list_courses`, `get_upcoming_assignments`, `get_my_grades`, `get_course_content`, `get_course_contents`, `get_assignment_feedback`, `get_announcements`, `create_assignment_submission`.
- **Instructor tools**: `list_roster`, `get_grades`, `get_submission_status`, `get_grade_distribution`, `get_discussion_summary`, `get_at_risk_students`, `draft_announcement`.
- **Shared tool**: `search_course_materials` with dedicated SSE stream at `GET /sse/search-course-materials`.
- MCP Resource: `course://{courseId}` — full course object as JSON.
- RBAC middleware (`src/rbac.ts`) with deny-by-default policy; roles: student, instructor, admin.
- FERPA gate — restricted tools require `ferpa_authorized: true` on every call.
- Per-role rate limiting (`src/auth.ts`) with configurable per-minute limits; 429 responses include retry-after interval.
- PII scrubbing middleware (`src/privacy.ts`); audit log subjects are SHA-256 hashed, raw user IDs never written to logs.
- Structured JSON audit log (access.granted / access.denied) to stdout.
- Prometheus metrics endpoint (`GET /metrics`); optional push gateway support.
- Provider manifest endpoint (`GET /manifest`) built dynamically from exported tool schemas.
- PKCE OAuth Authorization Code flow (`src/oauth.ts`); `GET /oauth/authorize` and `GET /oauth/callback` endpoints.
- CLI inspection subcommands: `--help`, `--version`, `--manifest`, `--tools`, `--doctor`, `--probe`.
- Hardened standalone Docker Compose stack: read-only filesystem, dropped capabilities, `no-new-privileges`, tmpfs for `/tmp`.
- Makefile targets: `docker-up`, `docker-down`, `docker-logs`, `docker-doctor`, `docker-probe`, `docker-manifest`, `docker-tools`.

[Unreleased]: https://github.com/nitsuah/bb-mcp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nitsuah/bb-mcp/releases/tag/v0.1.0