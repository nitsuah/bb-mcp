/**
 * Transport-level authentication for the /mcp HTTP endpoint.
 *
 * Every tool call trusts the client-supplied `caller_identity` (userId,
 * role, ferpa_authorized) with no other identity verification — see
 * auth.ts's module docstring. This is the one gate standing between
 * "anyone who can reach this port" and "a client the operator has actually
 * issued a key to."
 *
 * mcpApiKey is unset ("opt-in") only for a server explicitly bound to
 * loopback — index.ts's startHttpServer refuses to start otherwise
 * (assertSafeMcpAuthConfig below), so isAuthorizedMcpRequest allowing every
 * request when mcpApiKey is unset never actually happens on a
 * network-reachable bind (CWE-306: Missing Authentication for Critical
 * Function). A non-loopback bind additionally requires TLS — either served
 * directly or via an operator-acknowledged reverse proxy — since a bearer
 * token sent over plain HTTP can be captured and replayed (CWE-319:
 * Cleartext Transmission of Sensitive Information).
 */
import { timingSafeEqual } from "crypto";
import type { IncomingMessage } from "http";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/** True for a host that only accepts connections from the same machine. */
export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host);
}

export interface McpAuthConfigCheck {
  host: string;
  mcpApiKey: string | null;
  /** True when both TLS_CERT_PATH and TLS_KEY_PATH are configured. */
  tlsConfigured: boolean;
  /** Operator's explicit acknowledgment of an external TLS-terminating proxy. */
  trustProxyTls: boolean;
}

/**
 * Fail closed rather than open, for a server reachable beyond the machine
 * it's running on:
 *  - An unauthenticated /mcp endpoint is never acceptable — MCP_API_KEY is
 *    required.
 *  - A bearer token sent over plain HTTP can be captured and replayed by
 *    an on-path attacker, so MCP_API_KEY alone isn't sufficient either —
 *    the deployment must also either serve real HTTPS (tlsConfigured) or
 *    have the operator explicitly acknowledge a trusted TLS-terminating
 *    reverse proxy in front of it (trustProxyTls). Neither is assumed by
 *    default.
 *
 * Throws on the first unmet requirement. Call this before the HTTP server
 * starts listening, not after — nothing here is enforced at request time.
 */
export function assertSafeMcpAuthConfig(check: McpAuthConfigCheck): void {
  const { host, mcpApiKey, tlsConfigured, trustProxyTls } = check;
  if (isLoopbackHost(host)) return;

  if (!mcpApiKey) {
    throw new Error(
      `MCP_API_KEY is required when HOST ("${host}") is not loopback — ` +
        "the /mcp endpoint would otherwise accept unauthenticated requests " +
        "from anything that can reach this port. Set MCP_API_KEY, or set " +
        "HOST=127.0.0.1 for a genuinely local-only deployment.",
    );
  }

  if (!tlsConfigured && !trustProxyTls) {
    throw new Error(
      `HOST ("${host}") is not loopback, and this server speaks plain ` +
        "HTTP — an on-path attacker could capture and replay the " +
        "MCP_API_KEY bearer token. Set TLS_CERT_PATH and TLS_KEY_PATH to " +
        "serve HTTPS directly, or set TRUST_PROXY_TLS=true if a trusted " +
        "TLS-terminating reverse proxy already sits in front of this " +
        "server.",
    );
  }
}

/**
 * Validates the Authorization: Bearer header against the configured
 * mcpApiKey. Returns true when mcpApiKey is unset — safe only because
 * assertSafeMcpAuthConfig has already refused to start the server in that
 * state on a non-loopback host.
 */
export function isAuthorizedMcpRequest(
  req: Pick<IncomingMessage, "headers">,
  mcpApiKey: string | null,
): boolean {
  if (!mcpApiKey) return true;

  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return false;

  const provided = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(mcpApiKey);
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}
