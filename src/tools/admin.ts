/**
 * Admin-facing MCP tools.
 * All require role=admin and ferpa_authorized=true.
 */

import { z } from "zod";
import { bbClient } from "../bb-client.js";
import { checkAuthorization, parseIdentity } from "../auth.js";
import { withMetrics } from "../metrics.js";

interface BbUserListResult {
  results: Array<{
    id: string;
    userId: string;
    userName: string;
    name?: { given?: string; family?: string };
    emailAddress?: string;
    created?: string;
    modified?: string;
    institutionRoleIds?: string[];
  }>;
}

interface BbUserSingle {
  id: string;
  userName: string;
  name?: { given?: string; family?: string };
  emailAddress?: string;
  created?: string;
  modified?: string;
  institutionRoleIds?: string[];
  availability?: { available: boolean };
}

interface BbEnrollmentListResult {
  results: Array<{
    userId: string;
    courseId: string;
    user?: {
      id: string;
      userName: string;
      name?: { given?: string; family?: string };
    };
    course?: { id: string; courseId: string; name: string };
    role: string;
    availability: { available: boolean };
    created: string;
  }>;
}

interface EnrollmentResult {
  userId: string;
  courseId: string;
  role: string;
  availability: { available: boolean };
}

// ── list_users ──────────────────────────────────────────────────────────────
export const ListUsersInput = z.object({
  caller_identity: z.unknown(),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
  search: z.string().optional(),
});

export const listUsersHandler = withMetrics(
  "list_users",
  async (args: z.infer<typeof ListUsersInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "list_users",
    });

    const res = await bbClient.get<BbUserListResult>(`/users`, {
      params: {
        limit: args.limit,
        offset: args.offset,
        ...(args.search ? { search: args.search } : {}),
      },
    });

    const users = (res.data.results ?? []).map((u) => ({
      id: u.id,
      userId: u.userId,
      userName: u.userName,
      name: u.name,
      emailAddress: u.emailAddress,
      created: u.created,
      modified: u.modified,
      institutionRoleIds: u.institutionRoleIds,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              users,
              limit: args.limit,
              offset: args.offset,
              count: users.length,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const listUsersSchema = {
  name: "list_users",
  description:
    "Returns all users in system. Requires admin role and FERPA authorization.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      limit: {
        type: "number",
        description: "Max results (1-1000)",
        default: 100,
      },
      offset: { type: "number", description: "Pagination offset", default: 0 },
      search: {
        type: "string",
        description: "Search by name, userId, or email",
      },
    },
    required: ["caller_identity"],
  },
};

// ── get_user ────────────────────────────────────────────────────────────────
export const GetUserInput = z.object({
  caller_identity: z.unknown(),
  userId: z.string(),
});

export const getUserHandler = withMetrics(
  "get_user",
  async (args: z.infer<typeof GetUserInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "get_user",
    });

    const user = await bbClient.get<BbUserSingle>(
      `/users/${encodeURIComponent(args.userId)}`,
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              userId: user.data.id,
              userName: user.data.userName,
              name: user.data.name
                ? `${user.data.name.given ?? ""} ${user.data.name.family ?? ""}`.trim() ||
                  null
                : null,
              emailAddress: user.data.emailAddress,
              created: user.data.created,
              modified: user.data.modified,
              institutionRoleIds: user.data.institutionRoleIds,
              availability: user.data.availability,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const getUserSchema = {
  name: "get_user",
  description:
    "Returns a single user by ID. Requires admin role and FERPA authorization.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      userId: { type: "string", description: "Blackboard user ID" },
    },
    required: ["caller_identity", "userId"],
  },
};

// ── list_enrollments ────────────────────────────────────────────────────────
export const ListEnrollmentsInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string().optional(),
  userId: z.string().optional(),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

export const listEnrollmentsHandler = withMetrics(
  "list_enrollments",
  async (args: z.infer<typeof ListEnrollmentsInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "list_enrollments",
      courseId: args.courseId,
    });

    let url: string;
    const params: Record<string, unknown> = {
      limit: args.limit,
      offset: args.offset,
      fields: "userId,courseId,user,course,role,availability,created",
    };

    const singleEnrollment = Boolean(args.courseId && args.userId);

    if (singleEnrollment) {
      url = `/courses/${encodeURIComponent(args.courseId!)}/users/${encodeURIComponent(args.userId!)}`;
    } else if (args.courseId) {
      url = `/courses/${encodeURIComponent(args.courseId)}/users`;
    } else if (args.userId) {
      url = `/users/${encodeURIComponent(args.userId)}/courses`;
    } else {
      url = "/enrollments";
    }

    const res = await bbClient.get(url, { params });

    type BbEnrollment = BbEnrollmentListResult["results"][number];

    const mapEnrollment = (e: BbEnrollment) => ({
      userId: e.userId,
      courseId: e.courseId,
      user: e.user
        ? {
            id: e.user.id,
            userName: e.user.userName,
            name: e.user.name,
          }
        : undefined,
      course: e.course
        ? {
            id: e.course.id,
            courseId: e.course.courseId,
            name: e.course.name,
          }
        : undefined,
      role: e.role,
      availability: { available: e.availability?.available ?? false },
      created: e.created,
    });

    let enrollments: Array<ReturnType<typeof mapEnrollment>> = [];

    if (
      singleEnrollment &&
      res.data &&
      typeof res.data === "object" &&
      "userId" in res.data
    ) {
      // The courseId+userId endpoint returns a single enrollment object, not
      // a { results: [...] } envelope.
      enrollments = [mapEnrollment(res.data as BbEnrollment)];
    } else if (
      res.data &&
      typeof res.data === "object" &&
      "results" in res.data
    ) {
      const result = res.data as BbEnrollmentListResult;
      enrollments = result.results.map(mapEnrollment);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              enrollments,
              limit: args.limit,
              offset: args.offset,
              count: enrollments.length,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const listEnrollmentsSchema = {
  name: "list_enrollments",
  description:
    "Returns enrollments. Filter by courseId, userId, or both. Requires admin role and FERPA authorization.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      courseId: {
        type: "string",
        description: "Blackboard course ID (optional)",
      },
      userId: { type: "string", description: "Blackboard user ID (optional)" },
      limit: {
        type: "number",
        description: "Max results (1-1000)",
        default: 100,
      },
      offset: { type: "number", description: "Pagination offset", default: 0 },
    },
    required: ["caller_identity"],
  },
};

// ── create_enrollment ───────────────────────────────────────────────────────
export const CreateEnrollmentInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string(),
  userId: z.string(),
  role: z.enum([
    "Student",
    "Instructor",
    "TeachingAssistant",
    "CourseBuilder",
    "Grader",
    "Guest",
    "Observer",
  ]),
  availability: z.enum(["Yes", "No"]).default("Yes"),
});

export const createEnrollmentHandler = withMetrics(
  "create_enrollment",
  async (args: z.infer<typeof CreateEnrollmentInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "create_enrollment",
      courseId: args.courseId,
    });

    interface EnrollmentResult {
      userId: string;
      courseId: string;
      role: string;
      availability: { available: boolean };
    }

    const res = await bbClient.post<EnrollmentResult>(
      `/courses/${encodeURIComponent(args.courseId)}/users/${encodeURIComponent(args.userId)}`,
      {
        role: args.role,
        availability: { available: args.availability === "Yes" },
      },
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              enrollment: {
                userId: res.data.userId,
                courseId: args.courseId,
                role: res.data.role,
                availability: res.data.availability,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const createEnrollmentSchema = {
  name: "create_enrollment",
  description:
    "Creates an enrollment for a user in a course. Requires admin role and FERPA authorization.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      courseId: { type: "string", description: "Blackboard course ID" },
      userId: { type: "string", description: "Blackboard user ID" },
      role: {
        type: "string",
        enum: [
          "Student",
          "Instructor",
          "TeachingAssistant",
          "CourseBuilder",
          "Grader",
          "Guest",
          "Observer",
        ],
        description: "Course role to assign",
      },
      availability: { type: "string", enum: ["Yes", "No"], default: "Yes" },
    },
    required: ["caller_identity", "courseId", "userId", "role"],
  },
};

// ── update_enrollment ───────────────────────────────────────────────────────
export const UpdateEnrollmentInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string(),
  userId: z.string(),
  role: z
    .enum([
      "Student",
      "Instructor",
      "TeachingAssistant",
      "CourseBuilder",
      "Grader",
      "Guest",
      "Observer",
    ])
    .optional(),
  availability: z.enum(["Yes", "No"]).optional(),
});

export const updateEnrollmentHandler = withMetrics(
  "update_enrollment",
  async (args: z.infer<typeof UpdateEnrollmentInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "update_enrollment",
      courseId: args.courseId,
    });

    const updatePayload: Record<string, unknown> = {};
    if (args.role) updatePayload.role = args.role;
    if (args.availability)
      updatePayload.availability = { available: args.availability === "Yes" };

    if (Object.keys(updatePayload).length === 0) {
      throw new Error(
        "update_enrollment requires at least one of: role, availability.",
      );
    }

    const res = await bbClient.patch<EnrollmentResult>(
      `/courses/${encodeURIComponent(args.courseId)}/users/${encodeURIComponent(args.userId)}`,
      updatePayload,
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              enrollment: {
                userId: res.data.userId,
                courseId: args.courseId,
                role: res.data.role,
                availability: res.data.availability,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const updateEnrollmentSchema = {
  name: "update_enrollment",
  description:
    "Updates an enrollment for a user in a course. Requires admin role and FERPA authorization.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      courseId: { type: "string", description: "Blackboard course ID" },
      userId: { type: "string", description: "Blackboard user ID" },
      role: {
        type: "string",
        enum: [
          "Student",
          "Instructor",
          "TeachingAssistant",
          "CourseBuilder",
          "Grader",
          "Guest",
          "Observer",
        ],
        description: "Course role to assign",
      },
      availability: { type: "string", enum: ["Yes", "No"] },
    },
    required: ["caller_identity", "courseId", "userId"],
  },
};

// ── delete_enrollment ───────────────────────────────────────────────────────
export const DeleteEnrollmentInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string(),
  userId: z.string(),
});

export const deleteEnrollmentHandler = withMetrics(
  "delete_enrollment",
  async (args: z.infer<typeof DeleteEnrollmentInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "delete_enrollment",
      courseId: args.courseId,
    });

    await bbClient.delete(
      `/courses/${encodeURIComponent(args.courseId)}/users/${encodeURIComponent(args.userId)}`,
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              userId: args.userId,
              courseId: args.courseId,
              message: "Enrollment removed",
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const deleteEnrollmentSchema = {
  name: "delete_enrollment",
  description:
    "Removes user's enrollment from a course. Requires admin role and FERPA authorization.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      courseId: { type: "string", description: "Blackboard course ID" },
      userId: { type: "string", description: "Blackboard user ID" },
    },
    required: ["caller_identity", "courseId", "userId"],
  },
};

// ── list_audit_logs ─────────────────────────────────────────────────────────
export const ListAuditLogsInput = z.object({
  caller_identity: z.unknown(),
  limit: z.number().int().min(1).max(500).default(50),
  offset: z.number().int().min(0).default(0),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  eventType: z.string().optional(),
  userId: z.string().optional(),
  courseId: z.string().optional(),
});

export const listAuditLogsHandler = withMetrics(
  "list_audit_logs",
  async (args: z.infer<typeof ListAuditLogsInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "list_audit_logs",
    });

    try {
      const params: Record<string, unknown> = {
        limit: args.limit,
        offset: args.offset,
        ...(args.startDate ? { startDate: args.startDate } : {}),
        ...(args.endDate ? { endDate: args.endDate } : {}),
        ...(args.eventType ? { eventType: args.eventType } : {}),
        ...(args.userId ? { userId: args.userId } : {}),
        ...(args.courseId ? { courseId: args.courseId } : {}),
      };

      interface AuditLogResult {
        results?: Array<Record<string, unknown>>;
      }

      const res = await bbClient.get<AuditLogResult>(`/audit/logs`, { params });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                count: res.data.results?.length ?? 0,
                limit: args.limit,
                offset: args.offset,
                logs: res.data.results ?? [],
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const status =
        (error as { status?: number; response?: { status?: number } }).status ??
        (error as { response?: { status?: number } }).response?.status;
      if (status !== 404 && status !== 501) {
        throw error;
      }
      // Audit log endpoint might not be available on all Blackboard instances
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                count: 0,
                limit: args.limit,
                offset: args.offset,
                logs: [],
                note: "Audit log endpoint not available on Blackboard instance. Enable audit logging in Blackboard admin panel or check server stdout structured audit events.",
              },
              null,
              2,
            ),
          },
        ],
      };
    }
  },
);

export const listAuditLogsSchema = {
  name: "list_audit_logs",
  description:
    "Returns institutional audit logs. Requires admin role and FERPA authorization.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      limit: {
        type: "number",
        description: "Max results (1-500)",
        default: 50,
      },
      offset: { type: "number", description: "Pagination offset", default: 0 },
      startDate: {
        type: "string",
        description: "ISO 8601 start date (optional)",
      },
      endDate: { type: "string", description: "ISO 8601 end date (optional)" },
      eventType: {
        type: "string",
        description: "Filter by event type (optional)",
      },
      userId: { type: "string", description: "Filter by user ID (optional)" },
      courseId: {
        type: "string",
        description: "Filter by course ID (optional)",
      },
    },
    required: ["caller_identity"],
  },
};
