/**
 * Student-facing MCP tools.
 * Each tool handler is wrapped with metrics and calls checkAuthorization.
 */

import { z } from "zod";
import { bbClient } from "../bb-client.js";
import { checkAuthorization, parseIdentity } from "../auth.js";
import { withMetrics } from "../metrics.js";
import type { BbAssignment } from "../types.js";

// ── get_my_courses ────────────────────────────────────────────────────────

export const GetMyCoursesInput = z.object({
  caller_identity: z.unknown(),
});

export const getMyCoursesHandler = withMetrics(
  "get_my_courses",
  async (args: z.infer<typeof GetMyCoursesInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({ identity, toolName: "get_my_courses" });

    const courses = await bbClient.getCourses(identity.userId);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            courses.map((c) => ({
              id: c.id,
              courseId: c.courseId,
              name: c.name,
              description: c.description ?? null,
              instructor: c.instructor ?? null,
              term: c.term ?? null,
              status: c.availability?.available ?? "Unknown",
            })),
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const getMyCoursesSchema = {
  name: "get_my_courses",
  description: "Returns all courses the caller is enrolled in.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: {
        type: "object",
        description: "Identity of the caller. Must include userId and role.",
        properties: {
          userId: { type: "string" },
          role: { type: "string", enum: ["student", "instructor", "admin"] },
          ferpa_authorized: { type: "boolean" },
          clientApp: { type: "string" },
        },
        required: ["userId", "role"],
      },
    },
    required: ["caller_identity"],
  },
};

export const ListCoursesInput = GetMyCoursesInput;

export const listCoursesHandler = withMetrics(
  "list_courses",
  async (args: z.infer<typeof ListCoursesInput>) => getMyCoursesHandler(args),
);

export const listCoursesSchema = {
  name: "list_courses",
  description:
    "Compatibility alias for get_my_courses. Returns all courses the caller is enrolled in.",
  inputSchema: getMyCoursesSchema.inputSchema,
};

// ── get_upcoming_assignments ──────────────────────────────────────────────

export const GetUpcomingAssignmentsInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string().optional(),
  daysAhead: z.number().int().min(1).max(90).default(14),
});

export const getUpcomingAssignmentsHandler = withMetrics(
  "get_upcoming_assignments",
  async (args: z.infer<typeof GetUpcomingAssignmentsInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({ identity, toolName: "get_upcoming_assignments" });

    const courses = args.courseId
      ? [await bbClient.getCourse(args.courseId)]
      : await bbClient.getCourses(identity.userId);

    const cutoff = Date.now() + args.daysAhead * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const upcoming: Array<
      BbAssignment & { courseName?: string; courseId?: string }
    > = [];
    for (const course of courses) {
      const assignments = await bbClient.getAssignments(course.id);
      for (const a of assignments) {
        if (!a.due) continue;
        const dueMs = new Date(a.due).getTime();
        if (dueMs >= now && dueMs <= cutoff) {
          upcoming.push({
            ...a,
            courseName: course.name,
            courseId: course.courseId,
          });
        }
      }
    }

    upcoming.sort(
      (a, b) => new Date(a.due!).getTime() - new Date(b.due!).getTime(),
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            upcoming.map((a) => ({
              id: a.id,
              title: a.title,
              course: a.courseName ?? null,
              courseId: a.courseId ?? null,
              due: a.due,
              dueIn: a.due
                ? `${Math.ceil((new Date(a.due).getTime() - now) / 86_400_000)} days`
                : null,
              maxScore: a.maxScore ?? null,
            })),
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const getUpcomingAssignmentsSchema = {
  name: "get_upcoming_assignments",
  description:
    "Returns assignments due within N days, sorted by due date. Optionally scoped to one course.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      courseId: {
        type: "string",
        description: "Blackboard course ID (optional)",
      },
      daysAhead: {
        type: "number",
        description: "How many days ahead to look (1–90, default 14)",
        default: 14,
      },
    },
    required: ["caller_identity"],
  },
};

// ── get_my_grades ─────────────────────────────────────────────────────────

export const GetMyGradesInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string().optional(),
});

export const getMyGradesHandler = withMetrics(
  "get_my_grades",
  async (args: z.infer<typeof GetMyGradesInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "get_my_grades",
      courseId: args.courseId,
    });

    const courses = args.courseId
      ? [await bbClient.getCourse(args.courseId)]
      : await bbClient.getCourses(identity.userId);

    const result = [];
    for (const course of courses) {
      const grades = await bbClient.getGrades(course.id, identity.userId);
      const scored = grades.filter((g) => g.score != null);
      const total = scored.reduce((s, g) => s + (g.score ?? 0), 0);
      const avg = scored.length > 0 ? (total / scored.length).toFixed(1) : null;

      result.push({
        course: course.name,
        courseId: course.courseId,
        average: avg,
        grades: grades.map((g) => ({
          columnId: g.columnId,
          status: g.status ?? null,
          score: g.score ?? null,
          text: g.text ?? null,
          feedback: g.feedback ?? null,
        })),
      });
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

export const getMyGradesSchema = {
  name: "get_my_grades",
  description: "Returns the caller's grades. Optionally scoped to one course.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      courseId: {
        type: "string",
        description: "Blackboard course ID (optional)",
      },
    },
    required: ["caller_identity"],
  },
};

// ── get_course_content ────────────────────────────────────────────────────

export const GetCourseContentInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string(),
  searchQuery: z.string().optional(),
});

export const getCourseContentHandler = withMetrics(
  "get_course_content",
  async (args: z.infer<typeof GetCourseContentInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "get_course_content",
      courseId: args.courseId,
    });

    const content = await bbClient.getCourseContent(args.courseId);

    let items = content;
    if (args.searchQuery) {
      const q = args.searchQuery.toLowerCase();
      items = content.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.body?.toLowerCase().includes(q),
      );
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            items.map((c) => ({
              id: c.id,
              title: c.title,
              type: c.contentHandler?.id ?? "unknown",
              available: c.availability?.available ?? "Unknown",
              body: c.body ?? null,
            })),
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const getCourseContentSchema = {
  name: "get_course_content",
  description:
    "Returns course modules and materials. Supports optional keyword search.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      courseId: { type: "string", description: "Blackboard course ID" },
      searchQuery: { type: "string", description: "Keyword search (optional)" },
    },
    required: ["caller_identity", "courseId"],
  },
};

export const GetCourseContentsInput = GetCourseContentInput;

export const getCourseContentsHandler = withMetrics(
  "get_course_contents",
  async (args: z.infer<typeof GetCourseContentsInput>) =>
    getCourseContentHandler(args),
);

export const getCourseContentsSchema = {
  name: "get_course_contents",
  description:
    "Compatibility alias for get_course_content. Returns course modules and materials.",
  inputSchema: getCourseContentSchema.inputSchema,
};

// ── get_assignment_feedback ───────────────────────────────────────────────

export const GetAssignmentFeedbackInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string(),
  columnId: z.string(),
});

export const getAssignmentFeedbackHandler = withMetrics(
  "get_assignment_feedback",
  async (args: z.infer<typeof GetAssignmentFeedbackInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "get_assignment_feedback",
      courseId: args.courseId,
    });

    const grades = await bbClient.getGrades(args.courseId, identity.userId);
    const grade = grades.find((g) => g.columnId === args.columnId);

    if (!grade) {
      return {
        content: [
          { type: "text", text: "No grade found for this assignment." },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              score: grade.score ?? null,
              status: grade.status ?? null,
              feedback: grade.feedback ?? null,
              instructorNotes: grade.instructor_notes ?? null,
              studentComments: grade.attempt?.studentComments ?? null,
              attemptFeedback: grade.attempt?.feedback ?? null,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const getAssignmentFeedbackSchema = {
  name: "get_assignment_feedback",
  description:
    "Returns instructor comments, rubric scores, and feedback for an assignment.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      courseId: { type: "string" },
      columnId: {
        type: "string",
        description: "Grade column ID for the assignment",
      },
    },
    required: ["caller_identity", "courseId", "columnId"],
  },
};

// ── get_announcements ─────────────────────────────────────────────────────

export const GetAnnouncementsInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string(),
  unreadOnly: z.boolean().default(false),
});

export const getAnnouncementsHandler = withMetrics(
  "get_announcements",
  async (args: z.infer<typeof GetAnnouncementsInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "get_announcements",
      courseId: args.courseId,
    });

    const announcements = await bbClient.getAnnouncements(args.courseId);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            announcements.map((a) => ({
              id: a.id,
              title: a.title,
              body: a.body,
              created: a.created ?? null,
              modified: a.modified ?? null,
              author: a.creator?.userName ?? null,
            })),
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const getAnnouncementsSchema = {
  name: "get_announcements",
  description: "Returns announcements for a course.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      courseId: { type: "string" },
      unreadOnly: { type: "boolean", default: false },
    },
    required: ["caller_identity", "courseId"],
  },
};

// ── create_assignment_submission ──────────────────────────────────────────

export const CreateAssignmentSubmissionInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string(),
  columnId: z.string().describe("Grade column ID for the assignment"),
  studentComments: z.string().optional().describe("Optional student comments"),
});

export const createAssignmentSubmissionHandler = withMetrics(
  "create_assignment_submission",
  async (args: z.infer<typeof CreateAssignmentSubmissionInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "create_assignment_submission",
      courseId: args.courseId,
    });

    const attempt = await bbClient.createAttempt(
      args.courseId,
      args.columnId,
      identity.userId,
      args.studentComments,
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              id: attempt.id,
              userId: attempt.userId,
              status: attempt.status ?? null,
              created: attempt.created ?? null,
              modified: attempt.modified ?? null,
              studentComments: attempt.studentComments ?? null,
              feedback: attempt.feedback ?? null,
              score: attempt.score ?? null,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const createAssignmentSubmissionSchema = {
  name: "create_assignment_submission",
  description:
    "Creates a new assignment attempt submission for the caller. Returns the created attempt with ID and timestamp.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      courseId: { type: "string", description: "Blackboard course ID" },
      columnId: {
        type: "string",
        description: "Grade column ID for the assignment",
      },
      studentComments: {
        type: "string",
        description: "Optional student comments to attach to the submission",
      },
    },
    required: ["caller_identity", "courseId", "columnId"],
  },
};
