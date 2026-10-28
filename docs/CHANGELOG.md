# Changelog

> 🧭 [bb-mcp](../README.md) · [Features](./FEATURES.md) · [Roadmap](./ROADMAP.md) · [Tasks](./TASKS.md) · **Changelog** · [Metrics](./METRICS.md) <!-- nav -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- `npm audit fix`: follow-redirects, vite and hono bumped in the lockfile to clear the high-severity audit gate.
- Visual docs: the manifest-drawn screenshots now come from `npm run capture:screenshots` (still `scripts/visual-docs.mjs`), a step vigil's workflow-content check recognises: `npm run showcase -- audit` grades them `ci` now, and the dashboard will once nitsuah/vigil#317 (sync reads workflow contents) is merged and deployed.

### Added (journeys and vertical short)

- Nightly journeys (`tests/journeys/`, `config/playwright.journeys.config.mjs`, `.github/workflows/journeys.yml`): API journeys with Playwright's `request` fixture against `node dist/index.js` (dummy `BB_CLIENT_ID`/`BB_CLIENT_SECRET`, loopback `HOST`, a test `MCP_API_KEY`; no real Blackboard anywhere) cover `/health`, `/manifest` (40 tools, transports), the `/mcp` 401, MCP initialize + `tools/list`, and a student denied `list_users`; a Pages-site journey checks the hero video and poster, the expand kit, links and no horizontal scroll at 375 px. The caller workflow is pinned to the current `nitsuah/.github` main commit with a matching `kit-ref`; `@playwright/test` 1.64.1 is a new devDependency.
- `bb-mcp-21s-vert`: a narrated 1080x1920, 23 s re-render of the launch spot (captions burned in, Kokoro narration committed under `promo/bb-mcp-21s-vert/vo/`), published to `docs/brag/` and the Pages vertical slot. `promo/build.sh` can now borrow a base spot's music (`"synth"`) and mix committed narration; `promo/tts/` and `promo/sheet.sh` come from the stash/vigil approach.

### Fixed (promo claims)

- `bb-mcp-21s` re-rendered at 1920x1080 (23 s) from the code, reusing the vertical cut's scenes: 40 tools split 9 student / 7 instructor / 6 grade write-back / 12 admin and webhooks / 5 parent / 1 shared, the real RBAC refusal text, the real startup line and `/health` output, and the real result shape of `get_upcoming_assignments`. The invented CLI verbs, JSON, "34 tools" and the `npm i -g bb-mcp` outro (that name is an unrelated Bitbucket package; bb-mcp is not on npm) are gone, and the outro now points at github.com/nitsuah/bb-mcp (#149, #150). The stale `storyboard.md` is removed.
- Pages site: "5 personas" is now "4 roles" in the description, Open Graph and Twitter text and the tagline; the Admin card is "Admin and Webhooks (12)" and a line adds the shared search tool, so the groups add up to the 40-tool headline (#151, #152).

### Removed

- Root `brag-output/` folder: its video and poster were byte-identical copies of `docs/brag/` (the Pages copies); the share copy moved to `promo/brag-21s/share-copy.txt`.

### Added

- Verified HTTP caller identity for remote deployments: OIDC RS256/JWKS validation, explicit role and FERPA claim mapping, request-bound identity, and direct or trusted-proxy mTLS modes. Blackboard OAuth remains a separate API-session flow.
- Generated visuals (no web UI to screenshot): `scripts/visual-docs.mjs` draws a tool catalog, an RBAC matrix and a `get_my_grades` chat turn from the real manifest and policy into `docs/screenshots/`; `docs/diagrams/{architecture,tool-call-flow}.mmd` show the real mechanism. The new `.github/workflows/visual-docs.yml` regenerates both and opens a bot PR. `promo/spots.json` now sets `"frontend": false` and links features to these visuals and the 21 s spot.
- Visual showcase ([standard](https://github.com/nitsuah/.github/blob/main/showcase/STANDARD.md)): `promo/spots.json` lists every shipped FEATURES.md entry and records the existing launch video(s); feature-to-video and screenshot links are still empty and get filled in on the next `/promo` run; the Pages site loads the shared expand kit (click-to-expand images, fullscreen button on videos). Open Graph/Twitter media tags now use absolute URLs so link previews unfurl, and the Twitter card is `summary_large_image` with the poster (a player card needs an HTML player page, not a raw MP4).
- **Admin tools** (`src/tools/admin.ts`): `list_users`, `get_user`, `list_enrollments`, `create_enrollment`, `update_enrollment`, `delete_enrollment`, `list_audit_logs`.
- **Parent tools** (`src/tools/parent.ts`, guardian-scoped read-only): `get_my_children`, `get_children_courses`, `get_children_grades`, `get_children_upcoming_assignments`, `get_children_announcements`.
- **Grade write-back tools** (`src/tools/grade-writeback.ts`): `create_grade_column`, `update_grade`, `delete_grade`, `exempt_grade`, `get_grade_column`, and `create_assignment` (creates the student-visible content item and its linked grade column in one call).
- **Webhook subscription tools** (`src/tools/webhook-tools.ts`, admin only): `list_webhook_subscriptions`, `get_webhook_subscription`, `create_webhook_subscription`, `update_webhook_subscription`, `delete_webhook_subscription`.
- Tool-output PII scrubbing (`src/output-scrub.ts`): every MCP tool response is scrubbed of email addresses (by field name and embedded pattern) before it leaves the server, applied centrally via `withMetrics()`.
- Local access-audit trail (`src/auth.ts`): bounded in-memory ring buffer of `access.granted`/`access.denied` events, queryable via the `list_audit_logs` admin tool as `localAuditTrail` — independent of whether the upstream Blackboard instance has its own audit endpoint enabled.
- `.gitattributes` pinning text files to LF line endings.
- **`MCP_API_KEY` transport gate** (#115): bearer-token check on `/mcp`; the server fails closed (refuses to start) on any non-loopback `HOST` without a key and without TLS.
- Per-request lifecycle tracing (`src/trace.ts`): every tool call now emits a structured trace entry (request ID, latency, upstream Blackboard call count, error flag) to stdout and a local 1000-entry ring buffer, wired centrally through `withMetrics()`.
- Validated `node dist/index.js --stdio` against the official `@modelcontextprotocol/inspector` CLI: 0 errors across all 40 tools' `tools/list`, plus an end-to-end `tools/call` spot-check. Added a checked-in `config/mcp-inspector.config.example.json` and `npm run inspect` / `make docker-inspect` so this is a repeatable, one-command check (documented in README under "Validating with MCP Inspector").

### Changed

- Agent instructions (`.github/copilot-instructions.md`) now require closing tracked work in the same PR: update `docs/TASKS.md`, `docs/ROADMAP.md` and this changelog before the last push, and confirm `git diff origin/main...HEAD --stat` includes them before merge; added `.github/pull_request_template.md` with a "Closes TASKS item(s)" checklist.
- Docs: closed the "JSON schemas for all shipped tool inputs" task, which the 2027-Q1 planning reset (#129) had carried forward although every tool already defines an `inputSchema`.
- `RESTRICTED_TOOLS` (FERPA gate) now includes `list_users`, `get_user`, `list_enrollments`, and `list_audit_logs` by default, on top of the existing instructor tools — these admin-surface tools previously required only role=admin.
- Dependency bumps: vitest 5.0 (#118), dotenv 18 (#127), plus grouped minor/patch updates (#122, #124, #128).
- Planning docs reset for 2027 (`pmo-ff`): completed 2026 roadmap items removed (already in FEATURES/CHANGELOG), open items carried into 2027 Q1, breadcrumb navigation + README docs index added.
- `.github/dependabot.yml`: group minor/patch npm updates and GitHub Actions updates instead of opening one PR per bump.
- `src/bb-client.ts`: Blackboard REST failures are now categorized (`BbApiError.category`) and prefixed with a clear, actionable message instead of surfacing Blackboard's often-bare error body as-is.

### Deprecated

### Removed

- Archived stale planning/handoff docs (`docs/blackboard-learn-mcp-plan.md`, `docs/blackboard-mcp-full-plan.md`, `docs/HANDOFF-mcp-provider-contract-20260403.md`) to `docs/archive/`.

### Fixed

- ROADMAP.md/TASKS.md incorrectly described PR #109 (admin/parent/grade-write-back/webhook tools) as open with failing CI and a `CHANGES_REQUESTED` review; it merged 2026-08-29. Corrected.

### Security

- Extended the FERPA gate to cover the admin directory/enrollment/audit-log tool surface (see Changed above) — these previously exposed full institutional user PII with only a role check.
- Tool-output PII scrubbing (see Added above) closes a gap flagged across the 2026-08-22 and 2026-08-28 audits: student/instructor/admin/parent tool *responses* were unscrubbed even though audit-log emission already was.
- Lockfile-only `npm audit fix` for new transitive advisories that broke the CI audit gate: `brace-expansion` 5.0.9 → 5.0.12 (high, DoS), `ip-address` 10.4.0 → 10.7.2 (moderate, SSRF/subnet-check bypass, via `@modelcontextprotocol/sdk` → `express-rate-limit`), `fast-uri` 3.1.7 → 3.1.8 (moderate).

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
