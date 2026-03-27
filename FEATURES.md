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