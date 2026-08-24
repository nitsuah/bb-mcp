# Features

## Core Functionality
- **MCP Protocol Implementation** - Full support for the Model Context Protocol (MCP) to bridge LLMs with Blackboard Learn.
- **Course Metadata Retrieval** - Specialized tools for LLMs to fetch course descriptions, IDs, and enrollment status.
- **Announcement Management** - Ability to read, create, and search through institutional and course-level announcements.
- **Content Tree Navigation** - Hierarchical traversal of course content folders and learning modules via the REST API.
- **Assignment & Assessment Discovery** - Tools to identify upcoming deadlines, instructions, and submission requirements.
- **Gradebook Integration** - Secure access to student grades and feedback for personalized academic assistance.
- **User Directory Access** - Capability to look up user profiles and contact information within the Blackboard environment.

## Integrations
- **Blackboard Learn REST API Bridge** - Native integration with the official Blackboard developer APIs for real-time data access.
- **Stdio Transport Support** - Low-latency communication for local LLM clients like Claude Desktop.
- **HTTP/SSE Transport Support** - Remote connectivity options for web-based LLM interfaces and cloud deployments.
- **Standardized Tool Schema** - Provides JSON-RPC 2.0 compliant schemas that LLMs can interpret as actionable functions.

## Security
- **RBAC Middleware** - Robust Role-Based Access Control to ensure LLM interactions respect institutional permission levels.
- **OAuth2 Authentication** - Secure handling of Blackboard REST API tokens and session management.
- **Secure Proxy Layer** - Masks sensitive Blackboard infrastructure details from the LLM client through a controlled middleware.
- **Credential Isolation** - Environment-based configuration to prevent API keys from being exposed in the client-side context.

## Shipped Tools

### Student tools (9)

- **get_my_courses** — Returns all courses the caller is enrolled in (RBAC gated; student/instructor/admin)
- **list_courses** — Compatibility alias for `get_my_courses`
- **get_upcoming_assignments** — Assignments due within N days, sorted by due date; optional course filter
- **get_my_grades** — Grade breakdown across all courses or one course; computes running average
- **get_course_content** — Course modules and materials with optional keyword search
- **get_course_contents** — Compatibility alias for `get_course_content`
- **get_assignment_feedback** — Instructor comments, rubric scores, and attempt annotations
- **get_announcements** — Course announcements with optional unread-only filter
- **create_assignment_submission** — Creates an assignment attempt via `bbClient.createAttempt()`; RBAC gated to student/admin

### Instructor tools (7)

- **list_roster** — Enrolled user list for a course including usernames and display names; instructor/admin only
- **get_grades** — Course-wide or user-scoped grade details; optional column filter; FERPA restricted
- **get_submission_status** — Who has and has not submitted an assignment, with timestamps; FERPA restricted
- **get_grade_distribution** — Mean, median, std dev, min/max, and A/B/C/D/F buckets for a grade column; FERPA restricted
- **get_discussion_summary** — Participant count and post excerpts for a discussion thread; instructor/admin
- **get_at_risk_students** — Students below a grade threshold or with excess missing assignments; FERPA restricted
- **draft_announcement** — AI-assisted announcement draft with tone control; optionally posts to Blackboard

### Shared tools (1)

- **search_course_materials** — Full-text search across course content titles and bodies; all roles; dedicated SSE stream at `GET /sse/search-course-materials`

### MCP Resources (1)

- **course://{courseId}** — Full Blackboard course object as JSON

## Security & Compliance

- **PII Scrubbing Middleware** - `src/privacy.ts` scrubs sensitive text patterns before log emission; audit logs emit hashed subject values instead of raw user IDs
- **Per-Role Rate Limiting** - In-memory per-role per-minute call limits via `src/auth.ts`; configurable via `RATE_LIMIT_*_PER_MINUTE` env vars; 429 responses include retry-after guidance
- **PKCE OAuth2 Flow** - `src/oauth.ts` implements PKCE-backed authorization URL generation, state validation, code exchange, and refresh-aware in-memory session storage

## CLI & Operations

- **CLI Inspection Tool** - `--help`, `--version`, `--manifest`, `--tools`, `--doctor` subcommands validate the server environment without requiring Blackboard credentials
- **Blackboard Probe Command** - `--probe` validates credential readiness and exercises a minimal Blackboard API call for standalone operator checks
- **Standalone Docker Compose** - Hardened runtime with read-only filesystem, dropped capabilities, and `no-new-privileges`; `Makefile` targets for `docker-up`, `docker-down`, `docker-logs`, `docker-doctor`, `docker-probe`, `docker-manifest`, `docker-tools`

## Developer Experience
- **TypeScript Type Safety** - Fully typed codebase ensuring reliable data structures when interacting with complex Blackboard objects.
- **Auto-generated Tool Definitions** - Dynamically generates MCP tool descriptions based on available Blackboard API endpoints.
- **Structured Debug Logging** - Comprehensive logs for troubleshooting request/response cycles between the LLM and Blackboard.
- **Environment Configuration** - Simple setup via `.env` files for managing API URLs and client credentials.

## DevOps & Infrastructure
- **Node.js Optimized** - Lightweight runtime footprint designed for high-concurrency API proxying.
- **Docker Ready** - Containerization support for consistent deployment across development and production environments.
- **Rate Limit Handling** - Built-in logic to respect Blackboard API throttling and prevent service interruptions.
- **Error Mapping** - Translates Blackboard-specific HTTP errors into standardized MCP error codes for better LLM recovery.