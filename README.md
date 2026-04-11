# blackboard-learn-mcp


<!-- Deployment Status -->
[![Deploy Status](https://github.com/nitsuah/bb-mcp/actions/workflows/deploy.yml/badge.svg)](https://github.com/nitsuah/bb-mcp/actions)

A standalone [Model Context Protocol](https://modelcontextprotocol.io) server wrapping the Blackboard Learn REST API. Point any MCP-compatible client at it — Claude Desktop, Cursor, agent-board, or anything else — and get structured access to courses, grades, assignments, announcements, and more.

---

## Why standalone?

The integration logic lives here, not in the client. agent-board, Claude Desktop, and Cursor all connect the same way. Build it once, use it everywhere. Blackboard's own team could point internal tooling at this server without touching any frontend code.

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
│   Auth layer       → OAuth2, role gate, FERPA    │
│   Tools (11)       → student + instructor tools  │
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


## Makefile & Docker-based DevOps

### Local test, lint, build

```sh
make test        # Run all tests
make lint        # Lint code
make build       # Build TypeScript
```

### Docker-based test/build

```sh
make docker-test   # Build Docker image and run tests
make docker-build  # Build production Docker image
```

### CI/CD
- See .github/workflows/ci.yml for full pipeline: lint, test, build, Docker, artifact.

### Docker (recommended)

```bash
cp .env.example .env
# Fill in BB_CLIENT_ID, BB_CLIENT_SECRET, BB_BASE_URL
docker compose up -d
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
| `PORT` | — | HTTP port (default `3100`) |
| `LOG_LEVEL` | — | `info` or `debug` (default `info`) |
| `METRICS_PUSH_URL` | — | Prometheus push gateway URL (optional) |
| `RESTRICTED_TOOLS` | — | Comma-separated tool names requiring FERPA auth |

**Getting Blackboard credentials:**  
Register a REST API application at [developer.blackboard.com](https://developer.blackboard.com/portal/applications). Use the free developer sandbox for testing — no live Blackboard instance required.

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
| `get_upcoming_assignments` | Assignments due within N days, sorted by due date |
| `get_my_grades` | Grade breakdown across all courses or one course |
| `get_course_content` | Course modules and materials, with optional keyword search |
| `get_assignment_feedback` | Instructor comments, rubric scores, and annotations |
| `get_announcements` | Course announcements |

### Instructor tools

| Tool | Description | FERPA required |
|---|---|---|
| `get_submission_status` | Who submitted, who hasn't, timestamps | ✅ |
| `get_grade_distribution` | Mean, median, std dev, A/B/C/D/F buckets | ✅ |
| `get_discussion_summary` | Participant count and post excerpts for a thread | — |
| `get_at_risk_students` | Students with low grades or many missing submissions | ✅ |
| `draft_announcement` | AI-assisted announcement draft, optionally posted | — |

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

The auth layer enforces three things before any Blackboard API call is made:

1. **`caller_identity` is required** on every tool call — the client asserts who is asking
2. **Role gate** — instructor-only tools reject `role: "student"` callers
3. **FERPA gate** — tools that access protected student data require `ferpa_authorized: true`

Every access attempt (granted or denied) is written to stdout as structured JSON:

```json
{
  "timestamp": "2026-03-24T10:00:00.000Z",
  "event": "access.granted",
  "tool": "get_my_grades",
  "userId": "bbuser123",
  "role": "student",
  "courseId": null,
  "clientApp": "agent-board",
  "reason": null
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
│   ├── config.ts         Env validation
│   ├── bb-client.ts      Blackboard REST API client (OAuth2 auto-refresh)
│   ├── auth.ts           Role gate, FERPA guard, audit logging
│   ├── metrics.ts        Prometheus metrics + withMetrics() wrapper
│   ├── types.ts          Domain types (BbCourse, BbGrade, etc.)
│   └── tools/
│       ├── student.ts    Student-facing tools
│       ├── instructor.ts Instructor-facing tools
│       └── shared.ts     search_course_materials
├── Dockerfile            Multi-stage build (node:22-slim)
├── docker-compose.yml    Standalone stack (port 3100)
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
