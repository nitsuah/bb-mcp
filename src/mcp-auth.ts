/**
 * Transport-level authentication for the /mcp HTTP endpoint.
 *
 * Every tool call trusts the client-supplied `caller_identity` (userId,
 * role, ferpa_authorized) with no other identity verification — see
 * auth.ts's module docstring. This is the one gate standing between
 * "anyone who can reach this port" and "a client the operator has actually
 * issued a key to."
 */
import { timingSafeEqual } from "crypto";
import type { IncomingMessage } from "http";

/**
 * Validates the Authorization: Bearer header against the configured
 * mcpApiKey. Returns true when mcpApiKey is unset, since the gate is
 * opt-in (see config.ts's security.mcpApiKey) rather than breaking
 * deployments that predate it.
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
