# Roadmap

## Q1 2025 (Near Term)

- [x] **Project setup and architecture**: Establish the Node.js TypeScript environment and MCP server structure.
    - **Goal**: Create a scalable foundation for MCP tool and resource definitions.
    - **Rationale**: Ensures type safety and protocol compliance from the start.
    - **Scope**: Project scaffolding, TS config, MCP SDK integration.
    - **Success Criteria**: Successful build and "Hello World" MCP response.
    - **Risks**: Rapidly evolving MCP SDK specifications.

- [/] **Core Blackboard API Integration**: Implement basic GET functionality for Courses and Users.
    - **Goal**: Enable LLMs to browse educational hierarchies.
    - **Rationale**: Fundamental data required for all other Blackboard operations.
    - **Scope**: Courses, Memberships, and User Profile endpoints.
    - **Success Criteria**: LLM can accurately list a user's enrolled courses.
    - **Risks**: Variability in Blackboard REST API versions across institutions.

- [ ] **Secure RBAC Middleware**: Develop a middleware layer to enforce Role-Based Access Control.
    - **Goal**: Ensure the LLM only accesses data the authenticated user is permitted to see.
    - **Rationale**: Privacy and security are paramount in educational data (FERPA compliance).
    - **Scope**: Token validation, role mapping (Instructor vs. Student), and scope enforcement.
    - **Success Criteria**: Unauthorized API calls are blocked before reaching Blackboard.
    - **Risks**: Complexity in mapping Blackboard's granular permissions to MCP tools.

## Q2 2025 (Mid Term)

- [ ] **Content & Gradebook Tools**: Add write capabilities for assignments and grades.
    - **Goal**: Allow LLMs to assist in grading and content distribution.
    - **Rationale**: High-value automation for educators to reduce administrative burden.
    - **Scope**: Gradebook columns, score submission, and content upload endpoints.
    - **Success Criteria**: LLM can successfully update a student's grade via a tool call.
    - **Risks**: Data integrity and accidental overwrites of student records.

- [ ] **Dual Transport Support (Stdio/HTTP)**: Finalize support for both local and remote connection modes.
    - **Goal**: Flexibility in deployment (local desktop vs. cloud-hosted).
    - **Rationale**: Different clients (Claude Desktop vs. custom web apps) require different transports.
    - **Scope**: SSE (Server-Sent Events) implementation for HTTP and standard I/O for local.
    - **Success Criteria**: Server passes MCP Inspector tests for both transport types.
    - **Risks**: Handling state and session persistence over HTTP.

## Q3 - Q4 2025 (Long Term)

- [ ] **Enterprise Audit Logging**: Implement comprehensive logging for all LLM-driven actions.
    - **Goal**: Provide a clear