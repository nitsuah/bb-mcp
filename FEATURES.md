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

### Grade write-back tools (6)

- **create_assignment** — Creates a student-visible content item and its linked, gradable grade column in one call; instructor/admin only
- **create_grade_column** — Creates a gradebook column (without a paired content item); instructor/admin only
- **update_grade** — Updates (or creates, if none exists) a student's grade attempt for a column; instructor/admin only
- **delete_grade** — Deletes a student's grade attempt for a column; instructor/admin only
- **exempt_grade** — Marks a student's grade as exempt for a column; instructor/admin only
- **get_grade_column** — Returns details of a specific grade column; instructor/admin only

### Admin tools (7)

- **list_users** — Paginated user directory with optional name/userId/email search; admin only, FERPA restricted
- **get_user** — Single user record by ID; admin only, FERPA restricted
- **list_enrollments** — Enrollments filtered by course, user, or both; admin only, FERPA restricted
- **create_enrollment** — Enrolls a user in a course with a given role; admin only
- **update_enrollment** — Updates an enrollment's role or availability; admin only
- **delete_enrollment** — Removes a user's enrollment from a course; admin only
- **list_audit_logs** — Institutional audit logs, merging Blackboard's own `/audit/logs` (when available) with bb-mcp's local access-audit trail; admin only, FERPA restricted

### Parent tools (5, guardian-scoped read-only)

- **get_my_children** — Students the caller is a registered guardian/observer for
- **get_children_courses** — Course enrollments for one or all of the caller's children
- **get_children_grades** — Grade summaries for one or all of the caller's children
- **get_children_upcoming_assignments** — Upcoming assignments across the caller's children
- **get_children_announcements** — Course announcements relevant to the caller's children

### Webhook subscription tools (5, admin only)

- **list_webhook_subscriptions** — Lists registered Blackboard webhook subscriptions
- **get_webhook_subscription** — Returns a single webhook subscription
- **create_webhook_subscription** — Registers a new webhook subscription with Blackboard
- **update_webhook_subscription** — Updates an existing webhook subscription
- **delete_webhook_subscription** — Removes a webhook subscription

  Note: this is subscription *registration* only. Receiving inbound webhook calls and bridging them to the MCP SSE transport is a separate, larger piece of work — see the "Webhook-to-SSE bridge" writeup in `ROADMAP.md`'s 2027 section.

### Shared tools (1)

- **search_course_materials** — Full-text search across course content titles and bodies; all roles; dedicated SSE stream at `GET /sse/search-course-materials`

### MCP Resources (1)

- **course://{courseId}** — Full Blackboard course object as JSON

## Security & Compliance

- **PII Scrubbing — Audit Logs** - `src/privacy.ts` scrubs sensitive text patterns before log emission; audit logs emit hashed subject values instead of raw user IDs
- **PII Scrubbing — Tool Outputs** - `src/output-scrub.ts` scrubs email addresses out of every MCP tool response before it leaves the server, applied centrally via `withMetrics()` in `src/metrics.ts` so no individual tool handler can forget it. Opaque chaining identifiers (userId, courseId, columnId, ...) are preserved since callers depend on them; only contact-PII fields and embedded email addresses are redacted.
- **FERPA Gate on the Admin Tool Surface** - `list_users`, `get_user`, `list_enrollments`, and `list_audit_logs` require `ferpa_authorized: true` by default, not just role=admin
- **Local Audit Trail on the Admin Tool Surface** - `src/auth.ts` keeps a bounded in-memory access-audit trail (hashed subject only); `list_audit_logs` surfaces it directly, independent of whether the upstream Blackboard instance has its own audit endpoint enabled
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