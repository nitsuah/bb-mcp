# 📚 blackboard-learn-mcp Product Roadmap

**Last Updated:** 2026-03-27 | PMO audit — early-stage MCP server, foundation half-complete

---

## 2025 Q1 🔄 Partial (Architecture Foundation)

- ✅ **Project setup** — TypeScript, MCP SDK, ESLint/Prettier, Docker-ready
- 🔄 **Core Blackboard API wrapper** — OAuth2 init + REST wrapper in progress
- 🔄 **MCP stdio transport** — Refactor for protocol compliance (in progress)
- ❌ **RBAC middleware** — Not started (blocked on auth layer completion)

---

## 2025 Q2 📋 NOT STARTED (Should be complete; now overdue)

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
# ROADMAP

Last Updated: 2026-03-27

## 2025 Q1 - Foundation

- [x] Establish the TypeScript MCP server baseline.
- [/] Continue the core Blackboard API wrapper.
- [/] Continue the MCP stdio transport refactor.
- [ ] Design RBAC after auth is stable.

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

- [ ] Add announcements support.
- [ ] Add assignment submission support.
- [ ] Add assignment and grade read flows.

## 2026 Q3 - Enterprise Follow-On

- [ ] Add instructor write-back flows.
- [ ] Add audit logging and admin tools.
- [ ] Evaluate higher-volume content and course-management operations.

## Notes

- This remains a foundation-first MCP server.
- API wrapper, auth, and transport work stay ahead of every downstream tool.
- RBAC and compliance work should land before broader write-back features.

<!--
AGENT INSTRUCTIONS:
1. Keep the roadmap quarter-first and foundation-first.
2. Use short milestones, not narrative blocks.
3. Keep detailed task mechanics in TASKS.md.
-->