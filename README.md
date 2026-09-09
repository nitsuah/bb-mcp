# blackboard-learn-mcp

<!-- Deployment Status -->
[![Deploy Status](https://github.com/nitsuah/bb-mcp/actions/workflows/deploy.yml/badge.svg)](https://github.com/nitsuah/bb-mcp/actions)
[![CI](https://github.com/nitsuah/bb-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/nitsuah/bb-mcp/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-93.7%25-brightgreen)](METRICS.md)
[![High/Critical Vulns](https://img.shields.io/badge/high%2Fcritical%20vulns-1%20high%20(transitive)-yellow)](METRICS.md)
[![Lint](https://img.shields.io/badge/lint-0%20errors%20%7C%200%20warnings-brightgreen)](METRICS.md)

A standalone [Model Context Protocol](https://modelcontextprotocol.io) server wrapping the Blackboard Learn REST API. Point any MCP-compatible client at it — Claude Desktop, Cursor, agent-board, or anything else — and get structured access to courses, grades, assignments, announcements, and more.

---

## Why standalone?

The integration logic lives here, not in the client. Tools like agent-board, Claude Desktop, and Cursor all connect the same way. Build it once, use it everywhere. Blackboard's own team could point internal tooling at this server without touching any frontend code.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│   Any MCP Client                                 │
│   (Claude Desktop · Cursor · agent-board · ...)  │
└──────────────────────┬──────────────────────────┘
                       │ MCP Protocol (HTTP or stdio)
                       ▼
┌─────────────────────────────────────────────────┐
│   blackboard-learn-mcp  (this repo)              │
│                                                  │
│   Auth layer       → OAuth2, role gate, FERPA,   │
│                      rate limiting, PII scrub     │
│   Tools (40)       → student, instructor, admin, │
│                      parent, grade write-back,   │
│                      webhook-subscription tools  │
│   Metrics          → Prometheus /metrics         │
│   Audit log        → structured JSON → stdout    │
└──────────────────────┬──────────────────────────┘
                       │ REST API
                       ▼
              Blackboard Learn
          (your instance or sandbox)
```

---

## Quick start

```bash
cp .env.example .env   # Fill in BB_CLIENT_ID, BB_CLIENT_SECRET, BB_BASE_URL
docker compose -f config/docker-compose.yml up -d
```

## Development

All checks run via Docker — no local Node.js required.

```bash
# Run all tests (151 tests, TypeScript)
docker compose -f config/docker-compose.yml --profile test run --rm test

# Full quality gate: lint + coverage + audit + complexity
make docker-test

# Individual targets
make docker-lint    # lint only
make docker-build   # production image
```

**Pre-commit hooks** (type-check on commit, tests on push):
```bash
pip install pre-commit && pre-commit install && pre-commit install --hook-type pre-push
```

See `.github/workflows/ci.yml` for the full CI pipeline.

## Makefile reference

```sh
make docker-up        # Build and start the standalone bb-mcp container
make docker-logs      # Follow container logs
make docker-doctor    # Safe env readiness report from inside the container
make docker-probe     # Validate Blackboard credentials + minimal API call
make docker-manifest  # Print the provider manifest from the built image
make docker-tools     # Print the published tool catalog from the built image
make docker-down      # Stop the standalone stack
```

### Docker (recommended)

```bash
cp .env.example .env
# Fill in BB_CLIENT_ID, BB_CLIENT_SECRET, BB_BASE_URL
docker compose -f config/docker-compose.yml up -d
```

Repo-local standalone commands:

```bash
make docker-up        # Build and start the standalone bb-mcp container
make docker-logs      # Follow container logs
make docker-doctor    # Safe env readiness report from inside the container
make docker-probe     # Validate Blackboard credentials + minimal API call
make docker-manifest  # Print the provider manifest from the built image
make docker-tools     # Print the published tool catalog from the built image
make docker-down      # Stop the standalone stack
```

The standalone compose stack keeps the same Dockerfile path used by agent-board, but now adds a more confined runtime posture: read-only filesystem, dropped Linux capabilities, `no-new-privileges`, and a small `/tmp` tmpfs for Node runtime needs.

Server is live at `http://localhost:3100`.

| Endpoint | Description |
|---|---|
| `POST /mcp` | MCP protocol entry point |
| `GET /health` | Liveness probe |
| `GET /metrics` | Prometheus text format |
| `GET /manifest` | Provider contract with capabilities and tool manifest |
| `GET /oauth/authorize` | Start the OAuth Authorization Code flow |
| `GET /oauth/callback` | Complete OAuth code exchange and return a managed session |
| `GET /sse/search-course-materials` | Dedicated SSE stream for incremental `search_course_materials` output |

```bash
cp .env.example .env
npm install
npm run dev        # tsx watch — hot reload
```

### stdio mode (Claude Desktop / Cursor)

```bash
npm run build
node dist/index.js --stdio
```

### CLI inspection commands

```bash
# Show available runtime modes and inspection commands
node dist/index.js --help

# Print the provider manifest without starting the server
node dist/index.js --manifest

# List the published tools with role coverage
node dist/index.js --tools

# Emit a safe environment readiness report (no secrets printed)
node dist/index.js --doctor

# Validate Blackboard credentials and a minimal API call
node dist/index.js --probe
```

Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "blackboard-learn": {
      "command": "node",
      "args": ["/path/to/bb-mcp/dist/index.js", "--stdio"]
    }
  }
}
```

---

## Configuration

Copy `.env.example` to `.env` and set:

| Variable | Required | Description |
|---|---|---|
| `BB_CLIENT_ID` | ✅ | OAuth2 app client ID from [developer.blackboard.com](https://developer.blackboard.com) |
| `BB_CLIENT_SECRET` | ✅ | OAuth2 app client secret |
| `BB_BASE_URL` | ✅ | Base URL of your Blackboard Learn instance |
| `BB_OAUTH_REDIRECT_URI` | — | Override the OAuth callback URL (defaults to `PUBLIC_BASE_URL + /oauth/callback`) |
| `BB_OAUTH_SCOPE` | — | Optional scope string for the authorization code flow |
| `BB_OAUTH_AUTHORIZATION_PATH` | — | Override Blackboard authorization endpoint path |
| `BB_OAUTH_TOKEN_PATH` | — | Override Blackboard token endpoint path |
| `PORT` | — | HTTP port (default `3100`) |
| `LOG_LEVEL` | — | `info` or `debug` (default `info`) |
| `PUBLIC_BASE_URL` | — | Publicly reachable base URL of this server (e.g. `https://mcp.example.com`); used in manifest generation and as the OAuth redirect base; defaults to `http://localhost:<PORT>` |
| `MCP_API_KEY` | Strongly recommended beyond localhost | Shared secret required as `Authorization: Bearer <MCP_API_KEY>` on every `/mcp` request. Without it, anyone who can reach the port can call any tool with any `caller_identity` — see [Identity & access control](#identity--access-control). The server logs a startup warning when unset. |
| `METRICS_PUSH_URL` | — | Prometheus push gateway URL (optional) |
| `RESTRICTED_TOOLS` | — | Comma-separated tool names requiring FERPA auth (default: `get_at_risk_students,get_grade_distribution,get_submission_status,get_grades,list_users,get_user,list_enrollments,list_audit_logs`) |
| `RATE_LIMIT_STUDENT_PER_MINUTE` | — | Max tool calls per minute for student role (default `60`) |
| `RATE_LIMIT_INSTRUCTOR_PER_MINUTE` | — | Max tool calls per minute for instructor role (default `120`) |
| `RATE_LIMIT_ADMIN_PER_MINUTE` | — | Max tool calls per minute for admin role (default `180`) |
| `RATE_LIMIT_PARENT_PER_MINUTE` | — | Max tool calls per minute for parent role (default `60`) |

**Getting Blackboard credentials:**  
Register a REST API application at [developer.blackboard.com](https://developer.blackboard.com/portal/applications). Use the free developer sandbox for testing — no live Blackboard instance required.

### Authorization Code flow

bb-mcp now supports an operator-driven OAuth Authorization Code flow in addition to the existing client credentials probe path.

1. Visit `GET /oauth/authorize` to start the flow.
2. Blackboard redirects back to `GET /oauth/callback`.
3. bb-mcp validates the `state`, performs PKCE-backed token exchange, and returns a managed session payload.

For non-browser operators, `GET /oauth/authorize?format=json` returns the authorization URL and redirect URI without issuing an HTTP redirect.

---

## Tools

Every tool requires a `caller_identity` argument:

```json
{
  "caller_identity": {
    "userId": "bbuser123",
    "role": "student",
    "clientApp": "agent-board"
  }
}
```

For FERPA-restricted tools, add `"ferpa_authorized": true` — the calling application is responsible for asserting this only after real identity verification.

### Student tools

| Tool | Description |
|---|---|
| `get_my_courses` | Courses the caller is enrolled in |
| `list_courses` | Alias for `get_my_courses` — compatibility name |
| `get_upcoming_assignments` | Assignments due within N days, sorted by due date |
| `get_my_grades` | Grade breakdown across all courses or one course |
| `get_course_content` | Course modules and materials, with optional keyword search |
| `get_course_contents` | Alias for `get_course_content` — compatibility name |
| `get_assignment_feedback` | Instructor comments, rubric scores, and annotations |
| `get_announcements` | Course announcements |
| `create_assignment_submission` | Submit an assignment attempt with optional student comments |

### Instructor tools

| Tool | Description | FERPA required |
|---|---|---|
| `list_roster` | Enrolled users for a course, including user IDs and usernames | — |
| `get_grades` | Course-wide or user-scoped grade details, optionally filtered to one column | ✅ |
| `get_submission_status` | Who submitted, who hasn't, timestamps | ✅ |
| `get_grade_distribution` | Mean, median, std dev, A/B/C/D/F buckets | ✅ |
| `get_discussion_summary` | Participant count and post excerpts for a thread | — |
| `get_at_risk_students` | Students with low grades or many missing submissions | ✅ |
| `draft_announcement` | AI-assisted announcement draft, optionally posted | — |

### Grade write-back tools

| Tool | Description | FERPA required |
|---|---|---|
| `create_assignment` | Creates a student-visible content item + linked grade column in one call | — |
| `create_grade_column` | Creates a gradebook column only (no content item) | — |
| `update_grade` | Updates (or creates) a student's grade attempt for a column | — |
| `delete_grade` | Deletes a student's grade attempt for a column | — |
| `exempt_grade` | Marks a student's grade as exempt for a column | — |
| `get_grade_column` | Returns details of a specific grade column | — |

All require instructor or admin role.

### Admin tools

| Tool | Description | FERPA required |
|---|---|---|
| `list_users` | Paginated user directory with optional search | ✅ |
| `get_user` | Single user record by ID | ✅ |
| `list_enrollments` | Enrollments filtered by course, user, or both | ✅ |
| `create_enrollment` | Enrolls a user in a course | — |
| `update_enrollment` | Updates an enrollment's role/availability | — |
| `delete_enrollment` | Removes an enrollment | — |
| `list_audit_logs` | Institutional audit logs — Blackboard's own (when available) plus bb-mcp's local access-audit trail | ✅ |

All require admin role.

### Parent tools (guardian-scoped, read-only)

| Tool | Description |
|---|---|
| `get_my_children` | Students the caller is a registered guardian/observer for |
| `get_children_courses` | Course enrollments for one or all children |
| `get_children_grades` | Grade summaries for one or all children |
| `get_children_upcoming_assignments` | Upcoming assignments across children |
| `get_children_announcements` | Course announcements relevant to children |

All require parent role.

### Webhook subscription tools

| Tool | Description |
|---|---|
| `list_webhook_subscriptions` | Lists registered Blackboard webhook subscriptions |
| `get_webhook_subscription` | Returns a single webhook subscription |
| `create_webhook_subscription` | Registers a new webhook subscription |
| `update_webhook_subscription` | Updates an existing subscription |
| `delete_webhook_subscription` | Removes a subscription |

All require admin role. This is subscription *registration* only — receiving inbound webhook calls and bridging them to the MCP SSE transport is tracked in `ROADMAP.md`'s 2027 section.

### Shared tools

| Tool | Description |
|---|---|
| `search_course_materials` | Full-text search across content in one or all courses |

### MCP Resources

| URI | Description |
|---|---|
| `course://{courseId}` | Full course object as JSON |

---

## Identity & access control

**Transport gate (`MCP_API_KEY`)** — the `/mcp` endpoint itself has no other credential check, so without `MCP_API_KEY` configured, anyone who can reach the port can call any tool asserting any `caller_identity`. Set it in production; the server warns on startup if it's unset. See [Configuration](#configuration).

Once past the transport gate, the auth layer enforces the following before any Blackboard API call is made:

1. **`caller_identity` is required** on every tool call — the client asserts who is asking. This identity is trusted at face value (bb-mcp does not itself verify end-user identity); `MCP_API_KEY` establishes that the *client* is one the operator issued a key to, not that the claimed `userId`/`role` is truthful — the calling application (e.g. agent-board) is responsible for that.
2. **Rate gate** — per-role, per-minute call limits prevent bulk data extraction; 429 responses include a retry-after interval
3. **Role gate** — instructor-only tools reject `role: "student"` callers
4. **FERPA gate** — tools that access protected student data require `ferpa_authorized: true`; this covers the instructor at-risk/grade/submission tools and the full admin directory surface (`list_users`, `get_user`, `list_enrollments`, `list_audit_logs`)
5. **Course entitlement gate** — the grade write-back tools (`create_assignment`, `create_grade_column`, `update_grade`, `delete_grade`, `exempt_grade`, `get_grade_column`) additionally verify the caller is enrolled in the target `courseId` as Instructor, TeachingAssistant, or CourseBuilder — role=instructor alone does not authorize writing grades in an arbitrary course. `role: "admin"` bypasses this course-scoped check (already trusted org-wide).

Every access attempt (granted or denied) is written to stdout as structured JSON, and kept in a bounded in-memory ring buffer — bb-mcp's own **local audit trail**. User identifiers in this local trail are SHA-256 hashed before emission or storage; raw user IDs are never written to bb-mcp's own logs or returned in the `localAuditTrail` portion of `list_audit_logs`'s response. This hashing does *not* apply to the separate `logs` field in that same response, which passes through the Blackboard instance's own `/audit/logs` entries (when available) unmodified, including whatever raw user identifiers Blackboard itself records — the same identifiers an admin caller can already resolve directly via `get_user`/`list_users` under the same role+FERPA gate, so this is consistent with, not a bypass of, that authorization boundary.

On top of the audit-log scrubbing above, every tool response is separately scrubbed before it reaches the MCP client — `src/output-scrub.ts` strips email addresses (by field name and by pattern) out of the actual `get_my_grades` / `list_roster` / `list_users` / etc. payloads, applied centrally via `withMetrics()` so no individual tool can skip it.

```json
{
  "timestamp": "2026-03-24T10:00:00.000Z",
  "event": "access.granted",
  "tool": "get_my_grades",
  "subject": "anon:a3f9c1e02b47",
  "role": "student",
  "courseId": null,
  "clientApp": "agent-board",
  "reason": null,
  "piiRedaction": "hashed-subject"
}
```

This format is suitable for ingestion by any log aggregator (Datadog, CloudWatch, Loki, etc.).

---

## Metrics

`GET /metrics` returns Prometheus-compatible text:

```
bb_mcp_tool_calls_total{tool="get_my_courses"} 42
bb_mcp_tool_errors_total{tool="get_my_grades"} 1
bb_mcp_tool_avg_duration_ms{tool="get_upcoming_assignments"} 238
```

Set `METRICS_PUSH_URL` to push to a Prometheus push gateway every 60 seconds.

---

## agent-board integration

The server runs as a service in agent-board's Docker stack. The connector config lives at `agent-board/config/connectors.json`:

```json
{
  "name": "Blackboard Learn",
  "mcp_server": "http://bb-mcp:3100",
  "system_prompt": "You are a helpful study assistant...",
  "safety_config": "strict",
  "guided_prompts": [
    "What do I have due this week?",
    "How am I doing in my courses?",
    "Summarize what I missed"
  ]
}
```

agent-board proxies MCP calls through `POST /api/mcp/blackboard-learn/proxy`, keeping credentials server-side.

---

## Project structure

```
bb-mcp/
├── src/
│   ├── index.ts          Entry point — HTTP + stdio transports
│   ├── config.ts         Env validation and rate-limit config
│   ├── bb-client.ts      Blackboard REST API client (OAuth2 auto-refresh)
│   ├── auth.ts           Rate limit, role gate, FERPA guard, audit logging
│   ├── rbac.ts           Tool-to-role policy map
│   ├── oauth.ts          PKCE authorization code flow + session store
│   ├── manifest.ts       Provider manifest builder (GET /manifest)
│   ├── metrics.ts        Prometheus metrics + withMetrics() wrapper
│   │                     (also applies output-scrub to every tool result)
│   ├── privacy.ts        PII scrubbing (audit logs) and subject hashing
│   ├── output-scrub.ts   PII scrubbing (tool-call responses to the client)
│   ├── schemas.ts        Shared Zod schemas
│   ├── cli.ts            CLI subcommands (--doctor, --probe, --tools, etc.)
│   ├── constants.ts      SERVER_NAME, SERVER_VERSION
│   ├── types.ts          Domain types (BbCourse, BbGrade, etc.)
│   └── tools/
│       ├── student.ts         Student-facing tools (9 incl. aliases)
│       ├── instructor.ts      Instructor-facing tools (7)
│       ├── grade-writeback.ts Grade write-back + create_assignment (6)
│       ├── admin.ts           Admin directory/enrollment/audit tools (7)
│       ├── parent.ts          Guardian-scoped read-only tools (5)
│       ├── webhook-tools.ts   Webhook subscription CRUD (5)
│       └── shared.ts          search_course_materials (1)
├── config/
│   ├── docker-compose.yml  Standalone stack (port 3100)
│   ├── vitest.config.ts    Test runner config
│   └── eslint.config.mjs   Lint config
├── Dockerfile            Multi-stage build (node:22-slim)
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Sandbox testing

No live Blackboard instance needed. Register a free developer account at [developer.blackboard.com](https://developer.blackboard.com), create a REST API application, and use the provided sandbox URL as `BB_BASE_URL`. The sandbox exposes the full API surface with pre-populated test data.

---

## License

MIT

## Community Standards

Shared community policies are centralized in https://github.com/nitsuah/.github:
- Contributing: https://github.com/nitsuah/.github/blob/main/CONTRIBUTING.md
- Code of Conduct: https://github.com/nitsuah/.github/blob/main/CODE_OF_CONDUCT.md
- Security: https://github.com/nitsuah/.github/blob/main/SECURITY.md
