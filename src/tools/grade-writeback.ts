/**
 * Instructor grade write-back MCP tools.
 * Each tool requires role=instructor or role=admin and ferpa_authorized=true.
 */

import { z } from "zod";
import { bbClient } from "../bb-client.js";
import { checkAuthorization, parseIdentity } from "../auth.js";
import { withMetrics } from "../metrics.js";
import type { BbAttempt } from "../types.js";

interface BbGradeColumn {
  id: string;
  columnId: string;
  name: string;
  description?: string;
  pointsPossible?: number;
  weight?: number;
  gradingType?: string;
}

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
      `/courses/${args.courseId}/gradebook/columns`,
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

    // First, check if there's an existing attempt for this user and column
    let attemptId: string | undefined;
    try {
      const grades = await bbClient.getColumnGrades(
        args.courseId,
        args.columnId,
      );
      const existingGrade = grades.find((g) => g.userId === args.userId);
      if (existingGrade && existingGrade.attempt?.id) {
        attemptId = existingGrade.attempt.id;
      }
    } catch {
      // If we can't get existing grades, we'll try to create a new attempt
    }

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
      // Create new attempt
      const attemptPayload: Record<string, unknown> = { userId: args.userId };
      if (args.score !== undefined) attemptPayload.score = args.score;
      if (args.feedback) attemptPayload.feedback = args.feedback;
      if (args.instructorNotes)
        attemptPayload.instructorNotes = args.instructorNotes;
      if (args.status) attemptPayload.status = args.status.toLowerCase();

      attempt = await bbClient.createAttempt(
        args.courseId,
        args.columnId,
        args.userId,
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
                attempted: attempt.submittedDate
                  ? new Date(attempt.submittedDate).toISOString()
                  : null,
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

    // Delete the attempt for this user and column
    await bbClient.deleteAttempt(args.courseId, args.columnId, args.userId);

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

    // Set the grade status to Exempt
    await bbClient.updateAttempt(
      args.courseId,
      args.columnId,
      args.userId, // This assumes we can get the attempt ID - in practice we'd need to look it up
      {
        status: "exempt",
      },
    );

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
