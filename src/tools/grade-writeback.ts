/**
 * Instructor grade write-back MCP tools.
 * Each tool requires role=instructor or role=admin and ferpa_authorized=true.
 */

import { z } from "zod";
import { bbClient } from "../bb-client.js";
import type { BbAttemptUpdatePayload } from "../bb-client.js";
import { checkAuthorization, parseIdentity } from "../auth.js";
import { withMetrics } from "../metrics.js";
import type { BbAttempt } from "../types.js";

/** Parse a Blackboard timestamp, returning null instead of throwing on an invalid date. */
function toIsoOrNull(value?: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

interface BbGradeColumn {
  id: string;
  columnId: string;
  name: string;
  description?: string;
  pointsPossible?: number;
  weight?: number;
  gradingType?: string;
  contentId?: string;
}

interface BbContentItem {
  id: string;
  title: string;
  body?: string;
  contentHandler?: { id: string };
  availability?: { available: string };
}

// ── create_assignment ───────────────────────────────────────────────────────
// Full instructor assignment-creation flow: unlike create_grade_column (which
// only adds a gradebook column), this creates the student-visible course
// content item *and* its paired, linked grade column in one call — the two
// halves an instructor actually needs to publish a new assignment.
export const CreateAssignmentInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string(),
  title: z.string().min(1).max(255),
  instructions: z.string().optional(),
  pointsPossible: z.number().int().min(0).default(100),
  dueDate: z.string().optional().describe("ISO 8601 due date/time (optional)"),
  parentContentId: z
    .string()
    .optional()
    .describe(
      "Content folder to nest the assignment under (optional; defaults to the course's top-level content area)",
    ),
  available: z.boolean().default(true),
});

export const createAssignmentHandler = withMetrics(
  "create_assignment",
  async (args: z.infer<typeof CreateAssignmentInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "create_assignment",
      courseId: args.courseId,
    });

    const contentBase = `/courses/${encodeURIComponent(args.courseId)}/contents`;
    const contentUrl = args.parentContentId
      ? `${contentBase}/${encodeURIComponent(args.parentContentId)}/children`
      : contentBase;

    // Step 1: create the student-visible content item.
    const contentRes = await bbClient.post<BbContentItem>(contentUrl, {
      title: args.title,
      body: args.instructions,
      contentHandler: { id: "resource/x-bb-assignment" },
      availability: { available: args.available ? "Yes" : "No" },
    });

    // Step 2: create the linked grade column. If this fails, the content
    // item from step 1 already exists but has no grade column yet — surface
    // that explicitly rather than leaving the caller to guess why grading
    // the new assignment doesn't work.
    let gradeColumn: BbGradeColumn;
    try {
      const columnRes = await bbClient.post<BbGradeColumn>(
        `/courses/${encodeURIComponent(args.courseId)}/gradebook/columns`,
        {
          name: args.title,
          description: args.instructions,
          pointsPossible: args.pointsPossible,
          gradingType: "POINT",
          contentId: contentRes.data.id,
          ...(args.dueDate ? { grading: { due: args.dueDate } } : {}),
        },
      );
      gradeColumn = columnRes.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Assignment content item "${args.title}" (contentId=${contentRes.data.id}) was created, ` +
          `but creating its linked grade column failed: ${message}. ` +
          "The content item exists in Blackboard without a grade column — " +
          "retry with create_grade_column, passing contentId manually if the API supports it, or delete the orphaned content item.",
      );
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              assignment: {
                contentId: contentRes.data.id,
                title: contentRes.data.title,
                available: contentRes.data.availability?.available ?? null,
                columnId: gradeColumn.columnId ?? gradeColumn.id,
                pointsPossible: gradeColumn.pointsPossible ?? args.pointsPossible,
                dueDate: args.dueDate ?? null,
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

export const createAssignmentSchema = {
  name: "create_assignment",
  description:
    "Creates a new instructor assignment: a student-visible content item plus its linked, gradable grade column, in one call. Requires instructor or admin role.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      courseId: { type: "string", description: "Blackboard course ID" },
      title: { type: "string", description: "Assignment title" },
      instructions: {
        type: "string",
        description: "Assignment instructions / body text (optional)",
      },
      pointsPossible: {
        type: "number",
        description: "Points possible for the assignment",
        default: 100,
        min: 0,
      },
      dueDate: {
        type: "string",
        description: "ISO 8601 due date/time (optional)",
      },
      parentContentId: {
        type: "string",
        description:
          "Content folder to nest the assignment under (optional; defaults to the course's top-level content area)",
      },
      available: {
        type: "boolean",
        description: "Whether the assignment is immediately visible to students",
        default: true,
      },
    },
    required: ["caller_identity", "courseId", "title"],
  },
};

// ── create_grade_column ─────────────────────────────────────────────────────
export const CreateGradeColumnInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  pointsPossible: z.number().int().min(0).default(100),
});

export const createGradeColumnHandler = withMetrics(
  "create_grade_column",
  async (args: z.infer<typeof CreateGradeColumnInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "create_grade_column",
      courseId: args.courseId,
    });

    const res = await bbClient.post<BbGradeColumn>(
      `/courses/${encodeURIComponent(args.courseId)}/gradebook/columns`,
      {
        name: args.name,
        description: args.description,
        pointsPossible: args.pointsPossible,
        gradingType: "POINT",
      },
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              gradeColumn: {
                id: res.data.id,
                columnId: res.data.columnId,
                name: res.data.name,
                description: res.data.description,
                pointsPossible: res.data.pointsPossible,
                weight: res.data.weight,
                gradingType: res.data.gradingType,
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

export const createGradeColumnSchema = {
  name: "create_grade_column",
  description:
    "Creates a new grade column (assignment) in a course. Requires instructor or admin role and FERPA authorization.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      courseId: { type: "string", description: "Blackboard course ID" },
      name: { type: "string", description: "Name of the grade column" },
      description: {
        type: "string",
        description: "Description of the grade column (optional)",
      },
      pointsPossible: {
        type: "number",
        description: "Points possible for the grade column",
        default: 100,
        min: 0,
      },
    },
    required: ["caller_identity", "courseId", "name"],
  },
};

// ── update_grade ────────────────────────────────────────────────────────────
export const UpdateGradeInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string(),
  columnId: z.string(),
  userId: z.string(),
  score: z.number().int().min(0).optional(),
  status: z
    .enum(["NeedsGrading", "InProgress", "Completed", "Exempt"])
    .optional(),
  feedback: z.string().optional(),
  instructorNotes: z.string().optional(),
});

export const updateGradeHandler = withMetrics(
  "update_grade",
  async (args: z.infer<typeof UpdateGradeInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "update_grade",
      courseId: args.courseId,
    });

    // First, check if there's an existing attempt for this user and column.
    // Lookup failures are propagated rather than swallowed: falling through
    // to createAttempt on a failed read would silently turn a failed
    // update_grade request into an unconditional grade write.
    const grades = await bbClient.getColumnGrades(args.courseId, args.columnId);
    const existingGrade = grades.find((g) => g.userId === args.userId);
    const attemptId = existingGrade?.attempt?.id;

    let attempt: BbAttempt;
    if (attemptId) {
      // Update existing attempt
      attempt = await bbClient.updateAttempt(
        args.courseId,
        args.columnId,
        attemptId,
        {
          score: args.score,
          feedback: args.feedback,
          instructorNotes: args.instructorNotes,
          status: args.status?.toLowerCase() ?? undefined,
        },
      );
    } else {
      // Create new attempt, forwarding the requested grade fields so the
      // first write for a user is not silently dropped.
      const attemptExtra: BbAttemptUpdatePayload = {};
      if (args.score !== undefined) attemptExtra.score = args.score;
      if (args.feedback) attemptExtra.feedback = args.feedback;
      if (args.instructorNotes)
        attemptExtra.instructorNotes = args.instructorNotes;
      if (args.status) attemptExtra.status = args.status.toLowerCase();

      attempt = await bbClient.createAttempt(
        args.courseId,
        args.columnId,
        args.userId,
        undefined,
        attemptExtra,
      );
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              grade: {
                columnId: args.columnId,
                userId: args.userId,
                score: attempt.score,
                status: attempt.status,
                feedback: attempt.feedback,
                instructorNotes: attempt.instructorNotes,
                attempted: toIsoOrNull(attempt.submittedDate),
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

export const updateGradeSchema = {
  name: "update_grade",
  description:
    "Updates a grade for a specific user in a grade column. Requires instructor or admin role and FERPA authorization.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      courseId: { type: "string", description: "Blackboard course ID" },
      columnId: { type: "string", description: "Grade column ID" },
      userId: { type: "string", description: "Blackboard user ID" },
      score: { type: "number", description: "Score to assign (optional)" },
      status: {
        type: "string",
        enum: ["NeedsGrading", "InProgress", "Completed", "Exempt"],
        description: "Grade status (optional)",
      },
      feedback: {
        type: "string",
        description: "Feedback for the student (optional)",
      },
      instructorNotes: {
        type: "string",
        description: "Instructor notes (optional)",
      },
    },
    required: ["caller_identity", "courseId", "columnId", "userId"],
  },
};

// ── delete_grade ───────────────────────────────────────────────────────────
export const DeleteGradeInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string(),
  columnId: z.string(),
  userId: z.string(),
});

export const deleteGradeHandler = withMetrics(
  "delete_grade",
  async (args: z.infer<typeof DeleteGradeInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "delete_grade",
      courseId: args.courseId,
    });

    // Resolve the attempt ID for this user/column before deleting — a
    // Blackboard user ID is not an attempt ID, and deleteAttempt requires
    // the latter as its third argument.
    const grades = await bbClient.getColumnGrades(args.courseId, args.columnId);
    const existingGrade = grades.find((g) => g.userId === args.userId);
    const attemptId = existingGrade?.attempt?.id;

    if (!attemptId) {
      throw new Error(
        `No existing grade attempt found for user ${args.userId} in column ${args.columnId}; cannot delete.`,
      );
    }

    await bbClient.deleteAttempt(args.courseId, args.columnId, attemptId);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              columnId: args.columnId,
              userId: args.userId,
              message: "Grade attempt deleted",
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const deleteGradeSchema = {
  name: "delete_grade",
  description:
    "Deletes a grade attempt for a specific user in a grade column. Requires instructor or admin role and FERPA authorization.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      courseId: { type: "string", description: "Blackboard course ID" },
      columnId: { type: "string", description: "Grade column ID" },
      userId: { type: "string", description: "Blackboard user ID" },
    },
    required: ["caller_identity", "courseId", "columnId", "userId"],
  },
};

// ── exempt_grade ───────────────────────────────────────────────────────────
export const ExemptGradeInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string(),
  columnId: z.string(),
  userId: z.string(),
});

export const exemptGradeHandler = withMetrics(
  "exempt_grade",
  async (args: z.infer<typeof ExemptGradeInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "exempt_grade",
      courseId: args.courseId,
    });

    // Resolve the attempt ID for this user/column before exempting — a
    // Blackboard user ID is not an attempt ID, and updateAttempt requires
    // the latter as its third argument.
    const grades = await bbClient.getColumnGrades(args.courseId, args.columnId);
    const existingGrade = grades.find((g) => g.userId === args.userId);
    const attemptId = existingGrade?.attempt?.id;

    if (!attemptId) {
      throw new Error(
        `No existing grade attempt found for user ${args.userId} in column ${args.columnId}; cannot exempt.`,
      );
    }

    await bbClient.updateAttempt(args.courseId, args.columnId, attemptId, {
      status: "exempt",
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              columnId: args.columnId,
              userId: args.userId,
              message: "Grade exempted",
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const exemptGradeSchema = {
  name: "exempt_grade",
  description:
    "Exempts a grade for a specific user in a grade column. Requires instructor or admin role and FERPA authorization.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      courseId: { type: "string", description: "Blackboard course ID" },
      columnId: { type: "string", description: "Grade column ID" },
      userId: { type: "string", description: "Blackboard user ID" },
    },
    required: ["caller_identity", "courseId", "columnId", "userId"],
  },
};

// ── get_grade_column ───────────────────────────────────────────────────────
export const GetGradeColumnInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string(),
  columnId: z.string(),
});

export const getGradeColumnHandler = withMetrics(
  "get_grade_column",
  async (args: z.infer<typeof GetGradeColumnInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "get_grade_column",
      courseId: args.courseId,
    });

    // Get all grade columns and find the specific one
    const columns = await bbClient.getAssignments(args.courseId);
    const column = columns.find(
      (c) => c.id === args.columnId || c.columnId === args.columnId,
    );

    if (!column) {
      throw new Error(`Grade column not found: ${args.columnId}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              gradeColumn: {
                id: column.id,
                columnId: column.columnId,
                name: column.name,
                description: column.description,
                pointsPossible: column.maxScore,
                weight: column.weight,
                gradingType: column.gradingType,
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

export const getGradeColumnSchema = {
  name: "get_grade_column",
  description:
    "Returns details of a specific grade column. Requires instructor or admin role and FERPA authorization.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      courseId: { type: "string", description: "Blackboard course ID" },
      columnId: { type: "string", description: "Grade column ID" },
    },
    required: ["caller_identity", "courseId", "columnId"],
  },
};
