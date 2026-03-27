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