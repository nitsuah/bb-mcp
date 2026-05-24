# GitHub Copilot Instructions

This file provides custom instructions to GitHub Copilot when working in this repository.

## Project Context

**Project Name:** bb-mcp
**Description:** MCP server exposing the Blackboard Learn REST API to LLM clients via HTTP or stdio. RBAC middleware for role-based access control. Built for educational platform AI integrations.
**Tech Stack:**
*   **Primary Language:** TypeScript
*   **Runtime:** Node.js
*   **Web Framework:** Express.js
*   **Schema Validation:** Zod
*   **Testing Framework:** Jest
*   **Code Formatting/Linting:** Prettier, ESLint

**Key Files/Directories:**
*   `src/`: Contains all application source code.
    *   `src/api/`: HTTP API endpoint definitions and handlers.
    *   `src/middleware/`: RBAC logic and other Express middleware.
    *   `src/services/`: Business logic, Blackboard API client integration.
    *   `src/types/`: Custom TypeScript type definitions.
    *   `src/utils/`: Shared utility functions.
*   `tests/`: Contains unit and integration tests.
*   `config/`: Application configuration files.
*   `package.json`: Project dependencies and scripts.
*   `tsconfig.json`: TypeScript compiler configuration.

**Architectural Overview:**
The `bb-mcp` server acts as a secure intermediary between LLM clients and the Blackboard Learn REST API. It receives requests via HTTP or stdio, applies Role-Based Access Control (RBAC) defined in its middleware, translates/forwards requests to the Blackboard API, and returns the structured responses to the LLM client. Its core function is to provide a controlled and secure interface for AI agents to interact with educational platform data.

## Guardrails

### Coding Style & Conventions
*   **TypeScript First:** Always prioritize strong typing. Ensure all new code has explicit types for function parameters, return values, and complex objects. Avoid `any` unless absolutely necessary and justified.
*   **Readability:** Write clear, self-documenting code. Use meaningful variable and function names.
*   **ESLint & Prettier:** Adhere strictly to the project's `.eslintrc.js` and `.prettierrc.js` configurations. Code should be automatically formatted and linted before committing.
*   **Functional Programming:** Favor pure functions and immutability where appropriate, especially in utility and service layers.
*   **Error Handling:** Implement robust error handling. Return specific error types or well-structured error objects. Do not expose internal server errors directly to clients.

### File Paths & Structure
*   **Logical Grouping:** Place related code together. New API endpoints should go into `src/api/`. New RBAC rules or checks belong in `src/middleware/`.
*   **Modularity:** Keep files and modules focused on a single responsibility.
*   **Configuration:** All environment-specific or sensitive configurations must be loaded from `config/` or environment variables, never hardcoded.

### Testing
*   **Test-Driven Development (TDD):** For new features or bug fixes, write tests *before* or *concurrently* with the implementation.
*   **Coverage:** Aim for high unit test coverage for business logic (`src/services/`, `src/utils/`, `src/middleware/`). Integration tests should cover API endpoints (`src/api/`).
*   **Jest:** Use Jest for all testing. Leverage its mocking capabilities to isolate units of code.

### Commit Conventions
*   **Conventional Commits:** Follow the Conventional Commits specification. Use prefixes like `feat:`, `fix:`, `chore:`, `docs:`, `style:`, `refactor:`, `test:`, `build:`, `ci:`.
    *   Example: `feat: add new endpoint for course roster`
    *   Example: `fix: correct RBAC check for student role`
*   **Clear Messages:** Provide concise, descriptive commit messages.

### What to Avoid
*   **Hardcoding Credentials/Sensitive Information:** Never hardcode API keys,