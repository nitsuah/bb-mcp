# GitHub Copilot Instructions

This file provides custom instructions to GitHub Copilot when working in this repository.

## Project Context

**Project Name:** bb-mcp
**Description:** MCP server exposing the Blackboard Learn REST API to LLM clients via HTTP or stdio. RBAC middleware for role-based access control. Built for educational platform AI integrations.
**Tech Stack:**
*   **Primary Language:** TypeScript
*   **Runtime:** Node.js
*   **Server/Transport:** Node.js `http` server with Model Context Protocol SDK transports (HTTP Streamable and stdio)
*   **Schema Validation:** Zod
*   **Testing Framework:** Vitest
*   **Code Formatting/Linting:** ESLint via `npm run lint`; Prettier and ESLint hooks via `.pre-commit-config.yaml`

**Key Files/Directories:**
*   `src/`: Contains all application source code.
    *   `src/index.ts`: Main server entry point for HTTP and stdio modes.
    *   `src/cli.ts`: CLI parsing, help text, and diagnostic/report helpers.
    *   `src/bb-client.ts`: Blackboard Learn API integration.
    *   `src/oauth.ts`, `src/auth.ts`, `src/privacy.ts`, `src/rbac.ts`: Authentication, privacy, and authorization logic.
    *   `src/tools/`: Tool definitions grouped into `student.ts`, `instructor.ts`, and `shared.ts`.
*   `tests/`: Contains unit and integration tests.
*   `.pre-commit-config.yaml`: Repository formatting, linting, and type-check hooks.
*   `package.json`: Project dependencies and scripts.
*   `tsconfig.json`: TypeScript compiler configuration.

**Architectural Overview:**
The `bb-mcp` server exposes Blackboard Learn capabilities as MCP tools over HTTP or stdio. The main entry point in `src/index.ts` wires the MCP server, HTTP endpoints, OAuth handlers, metrics, and tool registration. Supporting modules in `src/` handle Blackboard API access, manifests, schemas, and auth/privacy/RBAC checks, while role-specific tool implementations live under `src/tools/`.

## Guardrails

### Coding Style & Conventions
*   **TypeScript First:** Always prioritize strong typing. Ensure all new code has explicit types for function parameters, return values, and complex objects. Avoid `any` unless absolutely necessary and justified.
*   **Readability:** Write clear, self-documenting code. Use meaningful variable and function names.
*   **ESLint & Prettier:** Use the repository's `npm run lint` and `npm run build` scripts, and keep files compatible with the formatting/lint hooks defined in `.pre-commit-config.yaml`.
*   **Functional Programming:** Favor pure functions and immutability where appropriate, especially in utility and service layers.
*   **Error Handling:** Implement robust error handling. Return specific error types or well-structured error objects. Do not expose internal server errors directly to clients.

### File Paths & Structure
*   **Logical Grouping:** Place related code with the existing flat `src/` modules. New Blackboard capability implementations usually belong in `src/tools/`, while shared auth/config/schema logic belongs in focused top-level `src/*.ts` modules.
*   **Modularity:** Keep files and modules focused on a single responsibility.
*   **Configuration:** Load environment-specific or sensitive configuration from environment variables and the existing config helpers in `src/config.ts`; never hardcode secrets.

### Testing
*   **Test-Driven Development (TDD):** For new features or bug fixes, write tests *before* or *concurrently* with the implementation.
*   **Coverage:** Aim for high unit coverage in `tests/` for CLI, config, schema, auth/privacy, OAuth, manifest, and other behavioral modules you change.
*   **Vitest:** Use Vitest for testing and leverage its mocking capabilities to isolate units of code.

### Commit Conventions
*   **Conventional Commits:** Follow the Conventional Commits specification. Use prefixes like `feat:`, `fix:`, `chore:`, `docs:`, `style:`, `refactor:`, `test:`, `build:`, `ci:`.
    *   Example: `feat: add new endpoint for course roster`
    *   Example: `fix: correct RBAC check for student role`
*   **Clear Messages:** Provide concise, descriptive commit messages.

### What to Avoid
*   **Hardcoding Credentials/Sensitive Information:** Never hardcode API keys,