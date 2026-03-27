# Tasks

## Todo

- [ ] Implement `list_courses` tool for retrieving user-specific course enrollments (P1, M)
- [ ] Implement `get_course_contents` tool to browse Blackboard content hierarchy (P1, L)
- [ ] Add support for Blackboard OAuth2 Authorization Code flow (P1, L)
- [ ] Develop RBAC middleware to restrict tool access based on Blackboard roles (P2, M)
- [ ] Implement `get_announcements` tool for course and system updates (P2, S)
- [ ] Add `create_assignment_submission` tool for student workflows (P2, L)
- [ ] Implement comprehensive error mapping for Blackboard REST API status codes (P2, M)
- [ ] Create JSON schema definitions for all MCP tool input parameters (P1, S)
- [ ] Add telemetry and logging for MCP request/response cycles (P3, M)
- [ ] Implement `search_users` tool for administrative directory lookups (P3, S)

## In Progress

- [ ] Refactoring stdio transport layer for MCP SDK compliance (P1, M)
- [ ] Developing core Blackboard API client wrapper in TypeScript (P1, L)

## Done

- [x] Initialize TypeScript project with MCP SDK dependencies (P1, S)
- [x] Configure ESLint and Prettier for codebase consistency (P3, S)
- [x] Define initial project structure and server entry point (P1, S)

<!--
AGENT INSTRUCTIONS:
This file tracks specific actionable tasks using a structured format.

CRITICAL FORMAT REQUIREMENTS:
1. Use EXACTLY these section names: "## Todo", "## In Progress", "## Done"
2. Tasks MUST use checkbox format: "- [ ]" for incomplete, "- [x]" for complete
3. Keep task titles on single lines`
1. Section headers must be ## (h2) level

STATUS MARKERS:
- [ ] = todo (not started)
- [/] = in-progress (actively working) - OPTIONAL, use "In Progress" section instead
- [x] = done (completed)

GOOD EXAMPLES:
## Todo
- [ ] Add user authentication
- [ ] Implement dark mode

## In Progress
- [ ] Refactor API endpoints

## Done
- [x] Set up database schema

BAD EXAMPLES (will break parser):
### Todo (wrong heading level)
* [ ] Task (wrong bullet marker)
- Task without checkbox
- [ ] Multi-line task
      with continuation (avoid this)

When updating:
1. Move tasks between sections as status changes
2. Mark completed tasks with [x] and move to "Done"
3. Add new tasks to "Todo" section
4. Keep descriptions actionable and concise
-->