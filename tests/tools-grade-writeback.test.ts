import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.BB_CLIENT_ID ??= "test-client-id";
  process.env.BB_CLIENT_SECRET ??= "test-client-secret";
});

const parseIdentityMock = vi.fn((raw: unknown) => raw as any);
const checkAuthorizationMock = vi.fn();
const checkCourseEntitlementMock = vi.fn();

const bbClientMock = {
  post: vi.fn(),
  getColumnGrades: vi.fn(),
  updateAttempt: vi.fn(),
  createAttempt: vi.fn(),
  deleteAttempt: vi.fn(),
  getAssignments: vi.fn(),
  getCourseMembership: vi.fn(),
};

vi.mock("../src/auth.js", () => ({
  parseIdentity: parseIdentityMock,
  checkAuthorization: checkAuthorizationMock,
  checkCourseEntitlement: checkCourseEntitlementMock,
}));

vi.mock("../src/bb-client.js", () => ({
  bbClient: bbClientMock,
}));

function parseToolText(result: any): any {
  return JSON.parse(result.content[0].text);
}

beforeEach(() => {
  vi.clearAllMocks();
  parseIdentityMock.mockImplementation((raw: unknown) => raw as any);
  // checkCourseEntitlement is exercised directly in auth-privacy.test.ts;
  // here the handlers are tested against a mocked authorization layer, same
  // as checkAuthorization above.
  checkCourseEntitlementMock.mockResolvedValue(undefined);
});

describe("CreateAssignmentInput dueDate validation", () => {
  // The MCP SDK validates against this Zod schema before createAssignmentHandler
  // is ever invoked (see server.tool(..., CreateAssignmentInput.shape, ...) in
  // index.ts) — so the schema itself, not the handler, is what enforces the
  // "ISO 8601 due date/time" contract documented in its own .describe().
  it("accepts a Z-suffixed ISO 8601 datetime", async () => {
    const { CreateAssignmentInput } = await import("../src/tools/grade-writeback.js");
    const result = CreateAssignmentInput.safeParse({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      title: "Essay 1",
      dueDate: "2026-10-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an offset-qualified ISO 8601 datetime", async () => {
    const { CreateAssignmentInput } = await import("../src/tools/grade-writeback.js");
    const result = CreateAssignmentInput.safeParse({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      title: "Essay 1",
      dueDate: "2026-10-01T00:00:00+02:00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-ISO-8601 dueDate string", async () => {
    const { CreateAssignmentInput } = await import("../src/tools/grade-writeback.js");
    const result = CreateAssignmentInput.safeParse({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      title: "Essay 1",
      dueDate: "next Friday",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a timezone-less local datetime", async () => {
    // { offset: true } specifically requires a Z or +HH:MM/-HH:MM offset —
    // "next Friday" above only proves arbitrary text is rejected, not that
    // a well-formed but unqualified ISO datetime is.
    const { CreateAssignmentInput } = await import("../src/tools/grade-writeback.js");
    const result = CreateAssignmentInput.safeParse({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      title: "Essay 1",
      dueDate: "2026-10-01T00:00:00",
    });
    expect(result.success).toBe(false);
  });

  it("still treats dueDate as optional", async () => {
    const { CreateAssignmentInput } = await import("../src/tools/grade-writeback.js");
    const result = CreateAssignmentInput.safeParse({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      title: "Essay 1",
    });
    expect(result.success).toBe(true);
  });
});

describe("grade write-back tools", () => {
  it("create_assignment creates the content item and its linked grade column", async () => {
    const { createAssignmentHandler } =
      await import("../src/tools/grade-writeback.js");

    bbClientMock.post
      .mockResolvedValueOnce({
        data: {
          id: "content-1",
          title: "Essay 1",
          availability: { available: "Yes" },
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: "col1",
          columnId: "col1",
          name: "Essay 1",
          pointsPossible: 50,
        },
      });

    const result = await createAssignmentHandler({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      title: "Essay 1",
      instructions: "Write 500 words.",
      pointsPossible: 50,
      dueDate: "2026-10-01T00:00:00Z",
      available: true,
    });

    expect(bbClientMock.post).toHaveBeenNthCalledWith(
      1,
      "/courses/course-a/contents",
      expect.objectContaining({
        title: "Essay 1",
        contentHandler: { id: "resource/x-bb-assignment" },
        availability: { available: "Yes" },
      }),
    );
    expect(bbClientMock.post).toHaveBeenNthCalledWith(
      2,
      "/courses/course-a/gradebook/columns",
      expect.objectContaining({
        name: "Essay 1",
        contentId: "content-1",
        pointsPossible: 50,
        grading: { due: "2026-10-01T00:00:00Z" },
      }),
    );

    const parsed = parseToolText(result);
    expect(parsed.assignment).toEqual({
      contentId: "content-1",
      title: "Essay 1",
      available: "Yes",
      columnId: "col1",
      pointsPossible: 50,
      dueDate: "2026-10-01T00:00:00Z",
    });
  });

  it("create_assignment surfaces a clear error when the grade column step fails after content creation", async () => {
    const { createAssignmentHandler } =
      await import("../src/tools/grade-writeback.js");

    bbClientMock.post
      .mockResolvedValueOnce({
        data: { id: "content-2", title: "Quiz 1" },
      })
      .mockRejectedValueOnce(new Error("gradebook unavailable"));

    await expect(
      createAssignmentHandler({
        caller_identity: { userId: "inst-1", role: "instructor" },
        courseId: "course-a",
        title: "Quiz 1",
      }),
    ).rejects.toThrow(/content-2.*gradebook unavailable/s);
  });

  it("create_grade_column posts the column definition", async () => {
    const { createGradeColumnHandler } =
      await import("../src/tools/grade-writeback.js");

    bbClientMock.post.mockResolvedValue({
      data: {
        id: "col1",
        columnId: "col1",
        name: "Midterm",
        pointsPossible: 100,
        gradingType: "POINT",
      },
    });

    const result = await createGradeColumnHandler({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      name: "Midterm",
      pointsPossible: 100,
    });

    expect(bbClientMock.post).toHaveBeenCalledWith(
      "/courses/course-a/gradebook/columns",
      expect.objectContaining({ name: "Midterm", gradingType: "POINT" }),
    );
    const parsed = parseToolText(result);
    expect(parsed.gradeColumn.name).toBe("Midterm");
  });

  it("create_grade_column forwards contentId to link an orphaned content item instead of creating a standalone column", async () => {
    const { createGradeColumnHandler } =
      await import("../src/tools/grade-writeback.js");

    bbClientMock.post.mockResolvedValue({
      data: {
        id: "col2",
        columnId: "col2",
        name: "Essay 1",
        pointsPossible: 50,
        gradingType: "POINT",
        contentId: "content-1",
      },
    });

    const result = await createGradeColumnHandler({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      name: "Essay 1",
      pointsPossible: 50,
      contentId: "content-1",
    });

    expect(bbClientMock.post).toHaveBeenCalledWith(
      "/courses/course-a/gradebook/columns",
      expect.objectContaining({ name: "Essay 1", contentId: "content-1" }),
    );
    const parsed = parseToolText(result);
    expect(parsed.gradeColumn.contentId).toBe("content-1");
  });

  it("create_grade_column omits contentId from the request when not provided", async () => {
    const { createGradeColumnHandler } =
      await import("../src/tools/grade-writeback.js");

    bbClientMock.post.mockResolvedValue({
      data: { id: "col1", columnId: "col1", name: "Midterm", pointsPossible: 100, gradingType: "POINT" },
    });

    await createGradeColumnHandler({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      name: "Midterm",
      pointsPossible: 100,
    });

    const [, payload] = bbClientMock.post.mock.calls[0];
    expect(payload).not.toHaveProperty("contentId");
  });

  it("update_grade updates an existing attempt when one is found", async () => {
    const { updateGradeHandler } =
      await import("../src/tools/grade-writeback.js");

    bbClientMock.getColumnGrades.mockResolvedValue([
      { userId: "u1", attempt: { id: "attempt-1" } },
    ]);
    bbClientMock.updateAttempt.mockResolvedValue({
      score: 95,
      status: "Completed",
      feedback: "Great work",
      instructorNotes: "note",
      submittedDate: "2026-01-05T00:00:00.000Z",
    });

    const result = await updateGradeHandler({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      columnId: "col1",
      userId: "u1",
      score: 95,
      status: "Completed",
      feedback: "Great work",
      instructorNotes: "note",
    });

    expect(bbClientMock.updateAttempt).toHaveBeenCalledWith(
      "course-a",
      "col1",
      "attempt-1",
      expect.objectContaining({ score: 95, status: "completed" }),
    );
    const parsed = parseToolText(result);
    expect(parsed.grade.score).toBe(95);
    expect(parsed.grade.attempted).toBe("2026-01-05T00:00:00.000Z");
  });

  it("update_grade creates a new attempt when none exists yet, forwarding requested fields", async () => {
    const { updateGradeHandler } =
      await import("../src/tools/grade-writeback.js");

    bbClientMock.getColumnGrades.mockResolvedValue([]);
    bbClientMock.createAttempt.mockResolvedValue({
      score: 80,
      status: "NeedsGrading",
    });

    const result = await updateGradeHandler({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      columnId: "col1",
      userId: "u2",
      score: 80,
      feedback: "nice work",
      instructorNotes: "note",
      status: "Completed",
    });

    expect(bbClientMock.createAttempt).toHaveBeenCalledWith(
      "course-a",
      "col1",
      "u2",
      undefined,
      {
        score: 80,
        feedback: "nice work",
        instructorNotes: "note",
        status: "completed",
      },
    );
    const parsed = parseToolText(result);
    expect(parsed.grade.score).toBe(80);
    expect(parsed.grade.attempted).toBeNull();
  });

  it("update_grade propagates errors from the existing-grades lookup instead of writing", async () => {
    const { updateGradeHandler } =
      await import("../src/tools/grade-writeback.js");

    bbClientMock.getColumnGrades.mockRejectedValue(new Error("boom"));

    await expect(
      updateGradeHandler({
        caller_identity: { userId: "inst-1", role: "instructor" },
        courseId: "course-a",
        columnId: "col1",
        userId: "u3",
        feedback: "retry",
        instructorNotes: "flagged",
        status: "InProgress",
      }),
    ).rejects.toThrow("boom");

    expect(bbClientMock.createAttempt).not.toHaveBeenCalled();
    expect(bbClientMock.updateAttempt).not.toHaveBeenCalled();
  });

  it("update_grade returns a null attempted date when submittedDate is invalid", async () => {
    const { updateGradeHandler } =
      await import("../src/tools/grade-writeback.js");

    bbClientMock.getColumnGrades.mockResolvedValue([
      { userId: "u1", attempt: { id: "attempt-1" } },
    ]);
    bbClientMock.updateAttempt.mockResolvedValue({
      score: 95,
      submittedDate: "not-a-date",
    });

    const result = await updateGradeHandler({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      columnId: "col1",
      userId: "u1",
      score: 95,
    });

    const parsed = parseToolText(result);
    expect(parsed.grade.attempted).toBeNull();
  });

  it("delete_grade resolves the attempt ID before deleting", async () => {
    const { deleteGradeHandler } =
      await import("../src/tools/grade-writeback.js");
    bbClientMock.getColumnGrades.mockResolvedValue([
      { userId: "u1", attempt: { id: "attempt-1" } },
    ]);
    bbClientMock.deleteAttempt.mockResolvedValue(undefined);

    const result = await deleteGradeHandler({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      columnId: "col1",
      userId: "u1",
    });

    expect(bbClientMock.deleteAttempt).toHaveBeenCalledWith(
      "course-a",
      "col1",
      "attempt-1",
    );
    const parsed = parseToolText(result);
    expect(parsed.success).toBe(true);
  });

  it("delete_grade throws when no existing attempt is found", async () => {
    const { deleteGradeHandler } =
      await import("../src/tools/grade-writeback.js");
    bbClientMock.getColumnGrades.mockResolvedValue([]);

    await expect(
      deleteGradeHandler({
        caller_identity: { userId: "inst-1", role: "instructor" },
        courseId: "course-a",
        columnId: "col1",
        userId: "u1",
      }),
    ).rejects.toThrow("No existing grade attempt found");

    expect(bbClientMock.deleteAttempt).not.toHaveBeenCalled();
  });

  it("exempt_grade resolves the attempt ID and marks it exempt", async () => {
    const { exemptGradeHandler } =
      await import("../src/tools/grade-writeback.js");
    bbClientMock.getColumnGrades.mockResolvedValue([
      { userId: "u1", attempt: { id: "attempt-1" } },
    ]);
    bbClientMock.updateAttempt.mockResolvedValue({});

    const result = await exemptGradeHandler({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      columnId: "col1",
      userId: "u1",
    });

    expect(bbClientMock.updateAttempt).toHaveBeenCalledWith(
      "course-a",
      "col1",
      "attempt-1",
      { status: "exempt" },
    );
    const parsed = parseToolText(result);
    expect(parsed.message).toBe("Grade exempted");
  });

  it("exempt_grade throws when no existing attempt is found", async () => {
    const { exemptGradeHandler } =
      await import("../src/tools/grade-writeback.js");
    bbClientMock.getColumnGrades.mockResolvedValue([]);

    await expect(
      exemptGradeHandler({
        caller_identity: { userId: "inst-1", role: "instructor" },
        courseId: "course-a",
        columnId: "col1",
        userId: "u1",
      }),
    ).rejects.toThrow("No existing grade attempt found");

    expect(bbClientMock.updateAttempt).not.toHaveBeenCalled();
  });

  it("get_grade_column returns the matching column", async () => {
    const { getGradeColumnHandler } =
      await import("../src/tools/grade-writeback.js");

    bbClientMock.getAssignments.mockResolvedValue([
      { id: "a1", columnId: "col1", name: "Midterm", maxScore: 100 },
      { id: "a2", columnId: "col2", name: "Final", maxScore: 200 },
    ]);

    const result = await getGradeColumnHandler({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      columnId: "col2",
    });

    const parsed = parseToolText(result);
    expect(parsed.gradeColumn.name).toBe("Final");
    expect(parsed.gradeColumn.pointsPossible).toBe(200);
  });

  it("get_grade_column throws when no column matches", async () => {
    const { getGradeColumnHandler } =
      await import("../src/tools/grade-writeback.js");

    bbClientMock.getAssignments.mockResolvedValue([
      { id: "a1", columnId: "col1", name: "Midterm" },
    ]);

    await expect(
      getGradeColumnHandler({
        caller_identity: { userId: "inst-1", role: "instructor" },
        courseId: "course-a",
        columnId: "missing",
      }),
    ).rejects.toThrow("Grade column not found: missing");
  });

  it("every grade-writeback handler checks course entitlement before touching Blackboard, and a rejection blocks the call", async () => {
    const {
      createAssignmentHandler,
      createGradeColumnHandler,
      updateGradeHandler,
      deleteGradeHandler,
      exemptGradeHandler,
      getGradeColumnHandler,
    } = await import("../src/tools/grade-writeback.js");

    const identity = { userId: "inst-1", role: "instructor" };
    const cases: Array<[string, () => Promise<unknown>]> = [
      [
        "create_assignment",
        () =>
          createAssignmentHandler({
            caller_identity: identity,
            courseId: "course-a",
            title: "Essay",
            pointsPossible: 100,
            available: true,
          }),
      ],
      [
        "create_grade_column",
        () =>
          createGradeColumnHandler({
            caller_identity: identity,
            courseId: "course-a",
            name: "Quiz",
            pointsPossible: 100,
          }),
      ],
      [
        "update_grade",
        () =>
          updateGradeHandler({
            caller_identity: identity,
            courseId: "course-a",
            columnId: "col1",
            userId: "student-1",
          }),
      ],
      [
        "delete_grade",
        () =>
          deleteGradeHandler({
            caller_identity: identity,
            courseId: "course-a",
            columnId: "col1",
            userId: "student-1",
          }),
      ],
      [
        "exempt_grade",
        () =>
          exemptGradeHandler({
            caller_identity: identity,
            courseId: "course-a",
            columnId: "col1",
            userId: "student-1",
          }),
      ],
      [
        "get_grade_column",
        () =>
          getGradeColumnHandler({
            caller_identity: identity,
            courseId: "course-a",
            columnId: "col1",
          }),
      ],
    ];

    for (const [toolName, call] of cases) {
      vi.clearAllMocks();
      parseIdentityMock.mockImplementation((raw: unknown) => raw as any);
      checkCourseEntitlementMock.mockRejectedValue(
        new Error(`not entitled in course-a`),
      );

      await expect(call()).rejects.toThrow("not entitled in course-a");
      expect(checkCourseEntitlementMock).toHaveBeenCalledWith(
        expect.objectContaining({ toolName, courseId: "course-a" }),
        bbClientMock,
      );
      // No Blackboard call of any kind should have happened once
      // entitlement failed — not just the "write" methods.
      for (const method of Object.values(bbClientMock)) {
        expect(method).not.toHaveBeenCalled();
      }
    }
  });
});
