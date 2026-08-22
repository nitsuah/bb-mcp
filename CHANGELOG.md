# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

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