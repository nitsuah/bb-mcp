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
 * Function).
 */
import { timingSafeEqual } from "crypto";
import type { IncomingMessage } from "http";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/** True for a host that only accepts connections from the same machine. */
export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host);
}

/**
 * Fail closed rather than open: an unauthenticated /mcp endpoint is only
 * acceptable when nothing outside the machine can reach it. Throws when the
 * configured host is not loopback and no mcpApiKey is set — call this
 * before the HTTP server starts listening, not after.
 */
export function assertSafeMcpAuthConfig(
  host: string,
  mcpApiKey: string | null,
): void {
  if (!mcpApiKey && !isLoopbackHost(host)) {
    throw new Error(
      `MCP_API_KEY is required when HOST ("${host}") is not loopback — ` +
        "the /mcp endpoint would otherwise accept unauthenticated requests " +
        "from anything that can reach this port. Set MCP_API_KEY, or set " +
        "HOST=127.0.0.1 for a genuinely local-only deployment.",
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
