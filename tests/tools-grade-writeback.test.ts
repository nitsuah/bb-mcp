import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.BB_CLIENT_ID ??= "test-client-id";
  process.env.BB_CLIENT_SECRET ??= "test-client-secret";
});

const parseIdentityMock = vi.fn((raw: unknown) => raw as any);
const checkAuthorizationMock = vi.fn();

const bbClientMock = {
  post: vi.fn(),
  getColumnGrades: vi.fn(),
  updateAttempt: vi.fn(),
  createAttempt: vi.fn(),
  deleteAttempt: vi.fn(),
  getAssignments: vi.fn(),
};

vi.mock("../src/auth.js", () => ({
  parseIdentity: parseIdentityMock,
  checkAuthorization: checkAuthorizationMock,
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
});

describe("grade write-back tools", () => {
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

  it("update_grade creates a new attempt when none exists yet", async () => {
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
    });

    expect(bbClientMock.createAttempt).toHaveBeenCalledWith(
      "course-a",
      "col1",
      "u2",
    );
    const parsed = parseToolText(result);
    expect(parsed.grade.score).toBe(80);
    expect(parsed.grade.attempted).toBeNull();
  });

  it("update_grade creates a new attempt when the existing-grades lookup throws", async () => {
    const { updateGradeHandler } =
      await import("../src/tools/grade-writeback.js");

    bbClientMock.getColumnGrades.mockRejectedValue(new Error("boom"));
    bbClientMock.createAttempt.mockResolvedValue({ score: 70 });

    const result = await updateGradeHandler({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      columnId: "col1",
      userId: "u3",
      feedback: "retry",
      instructorNotes: "flagged",
      status: "InProgress",
    });

    expect(bbClientMock.createAttempt).toHaveBeenCalled();
    const parsed = parseToolText(result);
    expect(parsed.grade.score).toBe(70);
  });

  it("delete_grade deletes the attempt", async () => {
    const { deleteGradeHandler } =
      await import("../src/tools/grade-writeback.js");
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
      "u1",
    );
    const parsed = parseToolText(result);
    expect(parsed.success).toBe(true);
  });

  it("exempt_grade marks the attempt exempt", async () => {
    const { exemptGradeHandler } =
      await import("../src/tools/grade-writeback.js");
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
      "u1",
      { status: "exempt" },
    );
    const parsed = parseToolText(result);
    expect(parsed.message).toBe("Grade exempted");
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
});
