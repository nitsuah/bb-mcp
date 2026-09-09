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
 *
 *   5. Course-level entitlement: role=instructor alone is not sufficient to
 *      write grades in an arbitrary course — checkCourseEntitlement confirms
 *      the caller is actually enrolled as Instructor/TeachingAssistant/
 *      CourseBuilder in the specific courseId being written to (IDOR guard,
 *      CWE-639). role=admin is trusted org-wide and bypasses this check.
 */

import { config } from "./config.js";
import { scrubLogText, toAuditSubject } from "./privacy.js";
import { canRoleAccessTool, getAllowedRolesForTool } from "./rbac.js";

export type Role = "student" | "instructor" | "admin" | "parent";

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

export interface AuditLogEntry {
  timestamp: string;
  event: "access.granted" | "access.denied";
  tool: string;
  subject: string;
  role: Role;
  courseId: string | null;
  clientApp: string | null;
  reason: string | null;
  piiRedaction: "hashed-subject";
}

// Bounded in-memory ring buffer of the server's own structured audit trail.
// Every access.granted / access.denied event is already written to stdout
// for external log aggregators (Datadog, CloudWatch, Loki); this buffer lets
// the admin tool surface (list_audit_logs) expose that same trail directly
// through MCP instead of depending entirely on the upstream Blackboard
// /audit/logs endpoint, which is not available on every Blackboard instance.
const AUDIT_LOG_CAPACITY = 1000;
const auditLogBuffer: AuditLogEntry[] = [];

function recordAuditLogEntry(entry: AuditLogEntry): void {
  auditLogBuffer.push(entry);
  if (auditLogBuffer.length > AUDIT_LOG_CAPACITY) {
    auditLogBuffer.splice(0, auditLogBuffer.length - AUDIT_LOG_CAPACITY);
  }
}

export interface AuditLogQuery {
  limit?: number;
  offset?: number;
  eventType?: string;
  userId?: string; // matched against the hashed subject, not the raw ID
  courseId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Parses a query date boundary, distinguishing "not provided" (null, no
 * filter) from an unparseable string (throws). Date.parse returning 0 for an
 * epoch-instant date is a legitimate boundary, not an absent one — callers
 * must compare with `!== null`, not a truthiness check, or a startDate of
 * exactly the epoch would silently disable the filter.
 */
function parseAuditDateBoundary(
  value: string | undefined,
  fieldName: "startDate" | "endDate",
): number | null {
  if (value === undefined) return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new Error(
      `Invalid ${fieldName}: "${value}" is not a valid ISO 8601 date/time.`,
    );
  }
  return ms;
}

/** Read back the server's own local audit trail (most recent first). */
export function getLocalAuditLogEntries(query: AuditLogQuery = {}): {
  entries: AuditLogEntry[];
  total: number;
} {
  const { limit = 50, offset = 0 } = query;
  const startMs = parseAuditDateBoundary(query.startDate, "startDate");
  const endMs = parseAuditDateBoundary(query.endDate, "endDate");
  const subjectFilter = query.userId ? toAuditSubject(query.userId) : null;

  const filtered = auditLogBuffer
    .filter((e) => !query.eventType || e.event === query.eventType)
    .filter((e) => !query.courseId || e.courseId === query.courseId)
    .filter((e) => !subjectFilter || e.subject === subjectFilter)
    .filter((e) => startMs === null || Date.parse(e.timestamp) >= startMs)
    .filter((e) => endMs === null || Date.parse(e.timestamp) <= endMs)
    .slice()
    .reverse();

  return {
    entries: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}

export function __resetAuditLogForTests(): void {
  auditLogBuffer.length = 0;
}

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
  const entry: AuditLogEntry = {
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
  recordAuditLogEntry(entry);
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

// Blackboard course-membership roles that can legitimately manage grades.
// Excludes "Student" and "Guest" — the RBAC role check already keeps those
// out of grade-writeback tools entirely, but this is the course-scoped half
// of the check, not a restatement of the app-level role gate.
const GRADE_MANAGING_COURSE_ROLES = new Set([
  "Instructor",
  "TeachingAssistant",
  "CourseBuilder",
]);

export interface CourseMembershipLookup {
  getCourseMembership(
    courseId: string,
    userId: string,
  ): Promise<{ userId: string; courseRoleId: string } | null>;
}

/**
 * Confirms the caller is actually entitled in `courseId`, not just holding
 * role=instructor in general. checkAuthorization only validates the FERPA
 * flag and the app-level role; without this, any instructor-role caller
 * could write grades in a course they have no relationship to (IDOR,
 * CWE-639) because courseId is fully caller-controlled and the Blackboard
 * client authenticates as the app (client_credentials), not as the caller.
 * role=admin is exempt — org-wide admin is already a trusted, elevated role
 * in the RBAC model and this would otherwise block legitimate cross-course
 * admin actions.
 */
export async function checkCourseEntitlement(
  ctx: AuthContext,
  client: CourseMembershipLookup,
): Promise<void> {
  const { identity, courseId } = ctx;
  if (identity.role === "admin") return;
  if (!courseId) {
    throw new AuthorizationError(
      "checkCourseEntitlement requires a courseId on the authorization context.",
    );
  }

  const membership = await client.getCourseMembership(
    courseId,
    identity.userId,
  );

  if (
    !membership ||
    !GRADE_MANAGING_COURSE_ROLES.has(membership.courseRoleId)
  ) {
    auditLog(
      "access.denied",
      ctx,
      `not entitled in course ${courseId} (courseRoleId=${membership?.courseRoleId ?? "none"})`,
    );
    throw new AuthorizationError(
      `Caller is not entitled to manage grades in course "${courseId}". ` +
        "The caller_identity.userId must be enrolled in this course as Instructor, TeachingAssistant, or CourseBuilder.",
    );
  }
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

  const validRoles: Role[] = ["student", "instructor", "admin", "parent"];
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
