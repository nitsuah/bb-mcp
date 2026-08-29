/**
 * Parent/guardian-facing MCP tools (read-only).
 * Each tool requires role=parent and ferpa_authorized=true.
 */

import { z } from "zod";
import { bbClient } from "../bb-client.js";
import {
  checkAuthorization,
  parseIdentity,
  type CallerIdentity,
} from "../auth.js";
import { withMetrics } from "../metrics.js";

export interface ResolvedChild {
  userId: string;
  userName: string;
  name?: { given?: string; family?: string };
  relationship: string;
}

/**
 * Blackboard's public REST API does not expose an explicit parent/guardian
 * relationship resource. Children are inferred from course co-enrollment:
 * any user holding the Student role in a course where the caller holds the
 * Observer role. This is a best-effort heuristic, not a verified guardian
 * mapping — institutions that need precise parent-child association should
 * verify it through their SIS integration.
 */
export const CHILD_RELATIONSHIP_NOTE =
  "Children are inferred from course co-enrollment (Student role in a course " +
  "where the caller holds the Observer role), because Blackboard's public REST " +
  "API does not expose an explicit guardian relationship. Verify guardian " +
  "associations with your Blackboard administrator if a precise parent-child " +
  "mapping is required.";

/** Resolve the caller's children via best-effort Observer/Student co-enrollment. */
async function resolveChildren(
  identity: CallerIdentity,
): Promise<ResolvedChild[]> {
  // Get the parent's user info first to observe their children
  await bbClient.get(`/users/${encodeURIComponent(identity.userId)}`);

  const courses = await bbClient.getCourses(identity.userId);

  const children: ResolvedChild[] = [];

  for (const course of courses) {
    const enrollments = await bbClient.getEnrolledUsers(course.id);
    const isObserver = enrollments.some(
      (e) => (e.userId ?? e.id) === identity.userId && e.role === "Observer",
    );
    if (!isObserver) continue;

    for (const user of enrollments) {
      const effectiveId = user.userId ?? user.id;
      if (effectiveId === identity.userId) continue;
      // Narrow to Student-role co-enrollees to avoid surfacing instructors,
      // TAs, or other observers as "children".
      if (user.role !== "Student") continue;
      if (children.some((c) => c.userId === effectiveId)) continue;

      children.push({
        userId: effectiveId,
        userName: user.userName,
        name: user.name,
        relationship: "observed_student",
      });
    }
  }

  return children;
}

// ── get_my_children ─────────────────────────────────────────────────────────
export const GetMyChildrenInput = z.object({
  caller_identity: z.unknown(),
});

export const getMyChildrenHandler = withMetrics(
  "get_my_children",
  async (args: z.infer<typeof GetMyChildrenInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "get_my_children",
    });

    const children = await resolveChildren(identity);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              children,
              count: children.length,
              note: CHILD_RELATIONSHIP_NOTE,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const getMyChildrenSchema = {
  name: "get_my_children",
  description:
    "Returns list of children (observed students) for the parent/guardian.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
    },
    required: ["caller_identity"],
  },
};

// ── get_children_courses ────────────────────────────────────────────────────
export const GetChildrenCoursesInput = z.object({
  caller_identity: z.unknown(),
  childUserId: z.string().optional(),
});

export const getChildrenCoursesHandler = withMetrics(
  "get_children_courses",
  async (args: z.infer<typeof GetChildrenCoursesInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "get_children_courses",
    });

    // Get children first
    const children = await resolveChildren(identity);

    // Filter by childUserId if provided
    const targetChildren = args.childUserId
      ? children.filter((c) => c.userId === args.childUserId)
      : children;

    interface ChildCourseInfo {
      childUserId: string;
      childUserName: string;
      childName?: { given?: string; family?: string };
      courses: Array<{
        id: string;
        courseId: string;
        name: string;
        description?: string;
        term?: string;
        status: string;
      }>;
    }

    const childrenCourses: ChildCourseInfo[] = [];

    for (const child of targetChildren) {
      // Get courses for this child
      const courses = await bbClient.getCourses(child.userId);

      childrenCourses.push({
        childUserId: child.userId,
        childUserName: child.userName,
        childName: child.name,
        courses: courses.map((c) => ({
          id: c.id,
          courseId: c.courseId,
          name: c.name,
          description: c.description,
          term: c.term,
          status: (c.availability?.available ?? false) ? "Active" : "Inactive",
        })),
      });
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              childrenCourses,
              count: childrenCourses.length,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const getChildrenCoursesSchema = {
  name: "get_children_courses",
  description:
    "Returns courses for each child (observed student). Optionally filter by childUserId.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      childUserId: {
        type: "string",
        description: "Blackboard user ID of the child (optional)",
      },
    },
    required: ["caller_identity"],
  },
};

// ── get_children_grades ─────────────────────────────────────────────────────
export const GetChildrenGradesInput = z.object({
  caller_identity: z.unknown(),
  childUserId: z.string().optional(),
  courseId: z.string().optional(),
});

export const getChildrenGradesHandler = withMetrics(
  "get_children_grades",
  async (args: z.infer<typeof GetChildrenGradesInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "get_children_grades",
      courseId: args.courseId,
    });

    // Get children first
    const children = await resolveChildren(identity);

    // Filter by childUserId if provided
    const targetChildren = args.childUserId
      ? children.filter((c) => c.userId === args.childUserId)
      : children;

    const childrenGrades: Array<{
      childUserId: string;
      childUserName: string;
      childName?: { given?: string; family?: string };
      courseId: string;
      courseName: string;
      grades: Array<{
        columnId: string;
        status?: string;
        score?: number | null;
        text?: string;
        feedback?: string;
      }>;
      average?: number | null;
    }> = [];

    for (const child of targetChildren) {
      // Get courses for this child
      const courses = await bbClient.getCourses(child.userId);

      // Filter by courseId if provided
      const targetCourses = args.courseId
        ? courses.filter((c) => c.id === args.courseId)
        : courses;

      for (const course of targetCourses) {
        // Get grades for this child in this course
        const grades = await bbClient.getGrades(course.id, child.userId);

        // Calculate average
        const scoredGrades = grades.filter((g) => g.score != null);
        const average =
          scoredGrades.length > 0
            ? scoredGrades.reduce((sum, g) => sum + (g.score ?? 0), 0) /
              scoredGrades.length
            : null;

        childrenGrades.push({
          childUserId: child.userId,
          childUserName: child.userName,
          childName: child.name,
          courseId: course.id,
          courseName: course.name,
          grades: grades.map((g) => ({
            columnId: g.columnId,
            status: g.status,
            score: g.score,
            text: g.text,
            feedback: g.feedback,
          })),
          average:
            average !== null && average !== undefined
              ? Number(average.toFixed(1))
              : null,
        });
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              childrenGrades,
              count: childrenGrades.length,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const getChildrenGradesSchema = {
  name: "get_children_grades",
  description:
    "Returns grades for each child (observed student). Optionally filter by childUserId or courseId.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      childUserId: {
        type: "string",
        description: "Blackboard user ID of the child (optional)",
      },
      courseId: {
        type: "string",
        description: "Blackboard course ID (optional)",
      },
    },
    required: ["caller_identity"],
  },
};

// ── get_children_upcoming_assignments ───────────────────────────────────────
export const GetChildrenUpcomingAssignmentsInput = z.object({
  caller_identity: z.unknown(),
  childUserId: z.string().optional(),
  courseId: z.string().optional(),
  daysAhead: z.number().int().min(1).max(90).default(14),
});

export const getChildrenUpcomingAssignmentsHandler = withMetrics(
  "get_children_upcoming_assignments",
  async (args: z.infer<typeof GetChildrenUpcomingAssignmentsInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "get_children_upcoming_assignments",
    });

    // Get children first
    const children = await resolveChildren(identity);

    // Filter by childUserId if provided
    const targetChildren = args.childUserId
      ? children.filter((c) => c.userId === args.childUserId)
      : children;

    const now = Date.now();
    const cutoff = now + args.daysAhead * 24 * 60 * 60 * 1000;

    const childrenUpcoming: Array<{
      childUserId: string;
      childUserName: string;
      childName?: { given?: string; family?: string };
      courseId: string;
      courseName: string;
      upcomingAssignments: Array<{
        id: string;
        title: string;
        due: string;
        daysUntilDue: number;
        maxScore?: number;
      }>;
    }> = [];

    for (const child of targetChildren) {
      // Get courses for this child
      const courses = await bbClient.getCourses(child.userId);

      // Filter by courseId if provided
      const targetCourses = args.courseId
        ? courses.filter((c) => c.id === args.courseId)
        : courses;

      for (const course of targetCourses) {
        // Get assignments for this course
        const assignments = await bbClient.getAssignments(course.id);

        // Filter upcoming assignments
        const upcomingAssignments: Array<{
          id: string;
          title: string;
          due: string;
          daysUntilDue: number;
          maxScore?: number;
        }> = [];

        for (const assignment of assignments) {
          if (!assignment.due) continue;

          const dueMs = new Date(assignment.due).getTime();
          if (dueMs >= now && dueMs <= cutoff) {
            const daysUntilDue = Math.ceil(
              (dueMs - now) / (24 * 60 * 60 * 1000),
            );

            upcomingAssignments.push({
              id: assignment.id,
              title: assignment.title,
              due: assignment.due,
              daysUntilDue,
              maxScore: assignment.maxScore,
            });
          }
        }

        // Sort by due date
        upcomingAssignments.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

        childrenUpcoming.push({
          childUserId: child.userId,
          childUserName: child.userName,
          childName: child.name,
          courseId: course.id,
          courseName: course.name,
          upcomingAssignments,
        });
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              childrenUpcoming,
              count: childrenUpcoming.length,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const getChildrenUpcomingAssignmentsSchema = {
  name: "get_children_upcoming_assignments",
  description:
    "Returns upcoming assignments for each child (observed student) within N days. Optionally filter by childUserId or courseId.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      childUserId: {
        type: "string",
        description: "Blackboard user ID of the child (optional)",
      },
      courseId: {
        type: "string",
        description: "Blackboard course ID (optional)",
      },
      daysAhead: {
        type: "number",
        description: "How many days ahead to look (1-90, default 14)",
        default: 14,
      },
    },
    required: ["caller_identity"],
  },
};

// ── get_children_announcements ─────────────────────────────────────────────
export const GetChildrenAnnouncementsInput = z.object({
  caller_identity: z.unknown(),
  childUserId: z.string().optional(),
  courseId: z.string().optional(),
  unreadOnly: z.boolean().default(false),
});

export const getChildrenAnnouncementsHandler = withMetrics(
  "get_children_announcements",
  async (args: z.infer<typeof GetChildrenAnnouncementsInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "get_children_announcements",
      courseId: args.courseId,
    });

    if (args.unreadOnly) {
      // Blackboard's announcement API exposes no per-parent read state; a
      // shared "modified" timestamp is not a substitute and would report an
      // arbitrary subset as "unread".
      throw new Error(
        "unreadOnly is not supported: Blackboard does not expose per-parent read state for announcements.",
      );
    }

    // Get children first
    const children = await resolveChildren(identity);

    // Filter by childUserId if provided
    const targetChildren = args.childUserId
      ? children.filter((c) => c.userId === args.childUserId)
      : children;

    const childrenAnnouncements: Array<{
      childUserId: string;
      childUserName: string;
      childName?: { given?: string; family?: string };
      courseId: string;
      courseName: string;
      announcements: Array<{
        id: string;
        title: string;
        body: string;
        created?: string;
        modified?: string;
        author?: string;
      }>;
    }> = [];

    for (const child of targetChildren) {
      // Get courses for this child
      const courses = await bbClient.getCourses(child.userId);

      // Filter by courseId if provided
      const targetCourses = args.courseId
        ? courses.filter((c) => c.id === args.courseId)
        : courses;

      for (const course of targetCourses) {
        // Get announcements for this course
        const announcements = await bbClient.getAnnouncements(course.id);

        childrenAnnouncements.push({
          childUserId: child.userId,
          childUserName: child.userName,
          childName: child.name,
          courseId: course.id,
          courseName: course.name,
          announcements: announcements.map((a) => ({
            id: a.id,
            title: a.title,
            body: a.body,
            created: a.created,
            modified: a.modified,
            author: a.creator?.userName ?? undefined,
          })),
        });
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              childrenAnnouncements,
              count: childrenAnnouncements.length,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const getChildrenAnnouncementsSchema = {
  name: "get_children_announcements",
  description:
    "Returns announcements for each child (observed student). Optionally filter by childUserId or courseId.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      childUserId: {
        type: "string",
        description: "Blackboard user ID of the child (optional)",
      },
      courseId: {
        type: "string",
        description: "Blackboard course ID (optional)",
      },
      unreadOnly: {
        type: "boolean",
        description:
          "Not supported: Blackboard exposes no per-parent read state for announcements. Passing true fails the request.",
        default: false,
      },
    },
    required: ["caller_identity"],
  },
};
