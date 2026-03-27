# 📚 blackboard-learn-mcp Product Roadmap

**Last Updated:** 2026-03-27 | PMO audit — early-stage MCP server, foundation half-complete

---

## 2025 Q1 🔄 Partial (Architecture Foundation)

- ✅ **Project setup** — TypeScript, MCP SDK, ESLint/Prettier, Docker-ready
- 🔄 **Core Blackboard API wrapper** — OAuth2 init + REST wrapper in progress
- 🔄 **MCP stdio transport** — Refactor for protocol compliance (in progress)
- ❌ **RBAC middleware** — Not started (blocked on auth layer completion)

---

## 2025 Q2 📋 NOT STARTED (Should be complete; now 3 months overdue)

- [ ] **`list_courses` & `get_course_contents`** — Foundation tools (blocked on API wrapper)
- [ ] **OAuth2 flow** — Secure token handling for production
- [ ] **Dual transport** — Stdio + HTTP (SSE) for CLI and web clients
- [ ] **Error mapping** — Blackboard API status → user messages

---

## 2026 Q1 🚀 RESET (Current Quarter — Critical Path)

**Goal:** Unblock foundation, ship first 4 core tools.

1. **Complete API wrapper & OAuth2** (P1) — Enable all downstream tools
2. **`list_courses` tool** (P1) — User can see their courses
3. **`get_course_contents` tool** (P1) — User can navigate course structure
4. **MCP stdio compliance** (P1) — Pass MCP Inspector tests
5. **JSON schemas** (P1) — Input validation + spec compliance

**Secondary:**
- RBAC middleware setup (blocks tools from shipping)
- Error mapping framework
- Telemetry hooks

---

## 2026 Q2 📋 Read/Write Workflows

- **`get_announcements`** — Course + system-level
- **`create_assignment_submission`** — Student workflow with attachments
- **Assignment tools** — Query assignments, check due dates
- **Grade checking** — Student can view their scores (read-only)

---

## 2026 Q3+ 🏫 Enterprise & Write-Back

- **Grades write-back** (for instructors) — Update scores, provide feedback
- **Audit logging** — Compliance logging for FERPA/HIPAA
- **Admin tools** — `search_users`, directory imports
- **Advanced features** — Content creation, course cloning, bulk operations

---

## Architecture

```
Clients (Claude Desktop, Cursor, agent-board, ...)
              ↓ (MCP protocol)
        bb-mcp Server (this repo)
  ├─ MCP Transport layer (stdio / HTTP)
  ├─ Auth layer (OAuth2, session management)
  ├─ Tools (11 planned: courses, content, assignments, grades, announcements, etc.)
  ├─ RBAC (role checking, FERPA fencing)
  └─ Metrics (Prometheus format)
              ↓ (REST API)
        Blackboard Learn
    (customer instance or sandbox)
```

---

## Known Blockers

| Blocker | Impact | Mitigation |
|---|---|---|
| API wrapper incomplete | All tools blocked | Complete by April 1 |
| OAuth2 token handling | Can't handle production auth | Implement Authorization Code flow |
| MCP transport needs refactor | Client integration blocked | Follow SDK v1.0 spec |
| RBAC not designed | Security gap (Instructor can see all students) | Design matrix + middleware |

---

## Success Metrics

- MCP Inspector: Stdio transport passes full compliance suite
- First 4 tools functional (courses, content, schemas, OAuth)
- Docker deployment working (env-based config)
- Zero FERPA violations (RBAC enforced before API call)

---

<!--
AGENT INSTRUCTIONS:
2025 timeline now stale (12+ months old).
2026 Q1 serves as reset with realistic prioritization.
Foundation-first approach: API wrapper → auth → tools → RBAC → write-back.
-->