/**
 * Centralized runtime configuration loaded from environment variables.
 */
import "dotenv/config";

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const config = {
  bb: {
    clientId: required("BB_CLIENT_ID"),
    clientSecret: required("BB_CLIENT_SECRET"),
    baseUrl: (
      process.env.BB_BASE_URL ?? "https://developer.blackboard.com"
    ).replace(/\/$/, ""),
  },
  oauth: {
    authorizationPath:
      process.env.BB_OAUTH_AUTHORIZATION_PATH ??
      "/learn/api/public/v1/oauth2/authorizationcode",
    tokenPath:
      process.env.BB_OAUTH_TOKEN_PATH ?? "/learn/api/public/v1/oauth2/token",
    redirectUri: process.env.BB_OAUTH_REDIRECT_URI ?? null,
    scope: process.env.BB_OAUTH_SCOPE ?? null,
  },
  server: {
    port: parseInt(process.env.PORT ?? "3100", 10),
    // Unchanged default (all interfaces) so existing Docker deployments —
    // which rely on `-p 3100:3100` port publishing reaching the container's
    // non-loopback interface — keep working. Set HOST=127.0.0.1 for a
    // genuinely local-only deployment. index.ts's startHttpServer resolves
    // the *actual* listen host from this plus trustProxyTls (see
    // mcp-auth.ts's resolveListenHost) and requires MCP_API_KEY on any
    // resulting non-loopback host, failing closed instead of silently
    // serving an unauthenticated /mcp endpoint. That non-loopback host also
    // requires real TLS (below) — a bare MCP_API_KEY alone doesn't satisfy
    // the startup check, since a key sent over plain HTTP can still be
    // captured and replayed by an on-path attacker.
    host: process.env.HOST ?? "0.0.0.0",
    // Optional: serve HTTPS directly instead of plain HTTP. Both must be
    // set together (a PEM cert chain and its matching private key file).
    tls: {
      certPath: process.env.TLS_CERT_PATH ?? null,
      keyPath: process.env.TLS_KEY_PATH ?? null,
    },
    // Confirms a trusted TLS-terminating reverse proxy (nginx, Traefik,
    // Caddy, etc.) shares this process's network namespace — this
    // overrides `host` above to force an actual loopback bind (see
    // resolveListenHost), since only a proxy in the same namespace (same
    // container, Docker's network_mode: service:<name>, a Kubernetes
    // sidecar, etc.) can then reach this server at all. Not just an
    // unverified assertion: a configured `host` would otherwise remain a
    // second, unprotected path straight to this plain-HTTP listener.
    trustProxyTls: process.env.TRUST_PROXY_TLS === "true",
    logLevel: process.env.LOG_LEVEL ?? "info",
    // Trusted base URL for manifest endpoint generation (e.g. https://mcp.example.com).
    // Falls back to http://localhost:<PORT> when not set.
    publicBaseUrl: process.env.PUBLIC_BASE_URL ?? null,
  },
  metrics: {
    pushUrl: process.env.METRICS_PUSH_URL ?? null,
  },
  security: {
    // Shared secret required on the /mcp transport (Authorization: Bearer
    // <key>) before any session is created. Without this, the entire
    // caller_identity model (role, ferpa_authorized) is only as trustworthy
    // as "whatever the HTTP request claims" — anyone who can reach the port
    // can assert any role/identity, since bb-mcp's own auth model
    // deliberately delegates end-user verification to the calling client
    // (see auth.ts's module docstring). Optional (null when unset) rather
    // than required so existing local/dev deployments aren't broken by this
    // gate's introduction, but strongly recommended for anything reachable
    // beyond localhost — startHttpServer logs a warning when it's unset.
    mcpApiKey: process.env.MCP_API_KEY ?? null,
    // Any tool that returns another person's PII (names, IDs, emails,
    // grades) requires an explicit ferpa_authorized=true assertion from the
    // calling client, on top of the role check. This set is mandatory and
    // non-overridable: RESTRICTED_TOOLS only ever *adds* to it. Letting an
    // env override fully replace this list would let a misconfigured
    // deployment silently drop the FERPA gate from any tool omitted here —
    // closed as part of the 2026-09 audit logging hardening pass.
    restrictedTools: Array.from(
      new Set([
        "get_at_risk_students",
        "get_grade_distribution",
        "get_submission_status",
        "get_grades",
        "list_users",
        "get_user",
        "list_enrollments",
        "list_audit_logs",
        ...(process.env.RESTRICTED_TOOLS ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ]),
    ),
    rateLimitPerMinute: {
      student: parseInt(process.env.RATE_LIMIT_STUDENT_PER_MINUTE ?? "60", 10),
      instructor: parseInt(
        process.env.RATE_LIMIT_INSTRUCTOR_PER_MINUTE ?? "120",
        10,
      ),
      admin: parseInt(process.env.RATE_LIMIT_ADMIN_PER_MINUTE ?? "180", 10),
      parent: parseInt(process.env.RATE_LIMIT_PARENT_PER_MINUTE ?? "60", 10),
    },
  },
} as const;
