# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| Older   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability, please report it privately to the maintainer using the contact details listed on [@nitsuah's GitHub profile](https://github.com/nitsuah). You can expect:

1.  **Acknowledgment**: We'll acknowledge receipt of your vulnerability report within 48 hours.
2.  **Updates**: We'll send you regular updates about our progress.
3.  **Disclosure**: We'll notify you when the vulnerability is fixed.
4.  **Credit**: We'll credit you in the release notes (unless you prefer to remain anonymous).

### What to Include

When reporting a vulnerability, please include:

-   Type of issue (e.g., buffer overflow, injection, cross-site scripting, improper authentication/authorization, information leakage, etc.)
-   Full paths of source file(s) related to the issue.
-   Location of the affected source code (tag/branch/commit or direct URL).
-   Step-by-step instructions to reproduce the issue.
-   Proof-of-concept or exploit code (if possible).
-   Impact of the issue, including how an attacker might exploit it and its potential effect on the Blackboard Learn API integration or LLM clients.

### Response Timeline

-   **Initial Response**: Within 48 hours.
-   **Status Update**: Within 7 days.
-   **Fix Timeline**: Depends on severity (critical issues prioritized).

## Security Best Practices for Contributors

When contributing to this project, please adhere to the following security best practices:

-   **Keep Dependencies Up to Date**: Regularly check for and update project dependencies to mitigate known vulnerabilities.
-   **Follow Secure Coding Practices**: Write clean, secure code, especially when handling user input, authentication, and authorization.
-   **Input Validation and Sanitization**: Thoroughly validate and sanitize all input received via HTTP endpoints or stdio to prevent injection attacks (e.g., prompt injection for LLM clients, command injection, etc.).
-   **Output Encoding**: Properly encode all output to prevent cross-site scripting (XSS) and other client-side vulnerabilities.
-   **Secure Configuration Management**: Ensure sensitive configurations are loaded securely and not hardcoded.
-   **Use Environment Variables for Sensitive Data**: Store API keys, passwords, tokens, and other sensitive information in environment variables, not directly in the codebase.
-   **Never Commit Credentials**: Absolutely avoid committing API keys, passwords, tokens, or any other sensitive credentials to the repository.
-   **Robust RBAC Implementation**: Carefully review and test all changes related to the Role-Based Access Control (RBAC) middleware to ensure proper authorization and prevent privilege escalation.
-   **Error Handling**: Implement comprehensive error handling to prevent sensitive information leakage in error messages.
-   **Review Code Changes**: Conduct thorough code reviews with a focus on security implications for all pull requests.

## Disclosure Policy

When we receive a security bug report, we will:

1.  Confirm the problem and determine affected versions.
2.  Audit code to find any similar problems.
3.  Prepare fixes for all supported versions.
4.  Release new versions as soon as possible, with appropriate security advisories.