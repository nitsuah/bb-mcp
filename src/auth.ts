/**
 * Identity & authorization layer.
 *
 * The MCP spec does not define end-user identity (that lives in the calling
 * client — Claude Desktop, agent-board, Cursor, etc.).  This module enforces:
 *
 *   1. A required `caller_identity` parameter on every tool call — the client
 *      MUST pass who is asking (userId or service account name).
 *
 *   2. Role-based access control: "instructor" vs "student" tools are scoped
 *      via the `role` claim.
 *
 *   3. FERPA guardrails: tools marked `restricted` require the caller to
 *      assert an explicit `ferpa_authorized: true` flag, which the calling
 *      client (e.g. agent-board) must gate behind real identity verification.
 *      If the flag is absent or false the tool call is rejected before any
 *      Blackboard API call is made.
 *
 *   4. All access attempts are logged to stdout in a structured JSON format
 *      suitable for ingestion by any log aggregator.
 */

import { config } from "./config.js";
import { scrubLogText, toAuditSubject } from "./privacy.js";
import { canRoleAccessTool, getAllowedRolesForTool } from "./rbac.js";

export type Role = "student" | "instructor" | "admin";

export interface CallerIdentity {
  userId: string; // opaque identifier — Blackboard user ID or service account
  role: Role;
  ferpa_authorized?: boolean; // must be true to call restricted tools
  clientApp?: string; // "agent-board", "claude-desktop", "cursor", etc.
}

export interface AuthContext {
  identity: CallerIdentity;
  toolName: string;
  courseId?: string;
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

interface RateWindow {
  startedAt: number;
  count: number;
}

const RATE_WINDOW_MS = 60_000;
const rateWindows = new Map<string, RateWindow>();

function getRateLimit(role: Role): number {
  return config.security.rateLimitPerMinute[role] ?? 60;
}

function assertWithinRateLimit(identity: CallerIdentity): void {
  const now = Date.now();
  const key = `${identity.role}:${identity.userId}`;
  const limit = getRateLimit(identity.role);
  const existing = rateWindows.get(key);

  if (!existing || now - existing.startedAt >= RATE_WINDOW_MS) {
    rateWindows.set(key, { startedAt: now, count: 1 });
    return;
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.startedAt + RATE_WINDOW_MS - now) / 1000),
    );
    throw new AuthorizationError(
      `Rate limit exceeded for role "${identity.role}". Retry after ${retryAfterSeconds}s.`,
    );
  }

  existing.count += 1;
  rateWindows.set(key, existing);
}

export function __resetRateLimiterForTests(): void {
  rateWindows.clear();
}

/** Structured audit log — write to stdout for log aggregator pickup */
function auditLog(
  event: "access.granted" | "access.denied",
  ctx: AuthContext,
  reason?: string,
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    tool: ctx.toolName,
    subject: toAuditSubject(ctx.identity.userId),
    role: ctx.identity.role,
    courseId: ctx.courseId ?? null,
    clientApp: ctx.identity.clientApp ?? null,
    reason: reason ? scrubLogText(reason) : null,
    piiRedaction: "hashed-subject",
  };
  process.stdout.write(JSON.stringify(entry) + "\n");
}

export function checkAuthorization(ctx: AuthContext): void {
  const { identity, toolName } = ctx;
  const isRestricted = config.security.restrictedTools.includes(toolName);

  try {
    assertWithinRateLimit(identity);
  } catch (error) {
    auditLog(
      "access.denied",
      ctx,
      error instanceof Error ? error.message : "rate limit exceeded",
    );
    throw error;
  }

  // FERPA gate
  if (isRestricted && !identity.ferpa_authorized) {
    auditLog("access.denied", ctx, "FERPA authorization required");
    throw new AuthorizationError(
      `Tool "${toolName}" accesses protected student data. ` +
        "The calling application must assert ferpa_authorized=true after verifying user identity.",
    );
  }

  // Role gate for all tools (deny by default when a tool is missing from policy).
  if (!canRoleAccessTool(identity.role, toolName)) {
    const allowed = getAllowedRolesForTool(toolName);
    const message =
      allowed.length > 0
        ? `role "${identity.role}" cannot access tool "${toolName}"`
        : `tool "${toolName}" is not registered in RBAC policy`;

    auditLog("access.denied", ctx, message);

    const allowedText =
      allowed.length > 0 ? ` Allowed roles: ${allowed.join(", ")}.` : "";
    throw new AuthorizationError(
      `Tool "${toolName}" is not available to role "${identity.role}".${allowedText}`,
    );
  }

  auditLog("access.granted", ctx);
}

/**
 * Parse the `caller_identity` argument that every tool must include.
 * Returns a validated CallerIdentity or throws a descriptive error.
 */
export function parseIdentity(raw: unknown): CallerIdentity {
  if (!raw || typeof raw !== "object") {
    throw new AuthorizationError(
      "caller_identity is required. Provide { userId, role } at minimum.",
    );
  }

  const obj = raw as Record<string, unknown>;

  if (!obj.userId || typeof obj.userId !== "string") {
    throw new AuthorizationError(
      "caller_identity.userId must be a non-empty string.",
    );
  }

  const validRoles: Role[] = ["student", "instructor", "admin"];
  if (!validRoles.includes(obj.role as Role)) {
    throw new AuthorizationError(
      `caller_identity.role must be one of: ${validRoles.join(", ")}.`,
    );
  }

  return {
    userId: obj.userId,
    role: obj.role as Role,
    ferpa_authorized: obj.ferpa_authorized === true,
    clientApp: typeof obj.clientApp === "string" ? obj.clientApp : undefined,
  };
}
