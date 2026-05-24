import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.BB_CLIENT_ID ??= "test-client-id";
  process.env.BB_CLIENT_SECRET ??= "test-client-secret";
});

const parseIdentityMock = vi.fn((raw: unknown) => raw as any);
const checkAuthorizationMock = vi.fn();

const bbClientMock = {
  getEnrolledUsers: vi.fn(),
  getColumnGrades: vi.fn(),
  getGrades: vi.fn(),
  getAttempts: vi.fn(),
  getDiscussionPosts: vi.fn(),
  getAssignments: vi.fn(),
  createAnnouncement: vi.fn(),
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

describe("instructor tools", () => {
  it("list_roster returns normalized roster details", async () => {
    const { listRosterHandler } = await import("../src/tools/instructor.js");

    bbClientMock.getEnrolledUsers.mockResolvedValue([
      {
        id: "u1",
        userName: "alice",
        name: { given: "Alice", family: "Doe" },
        emailAddress: "alice@example.edu",
      },
      { id: "u2", userName: "bob" },
    ]);

    const result = await listRosterHandler({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
    });

    const parsed = parseToolText(result);
    expect(parsed.count).toBe(2);
    expect(parsed.users[0].name).toBe("Alice Doe");
    expect(parsed.users[1].name).toBeNull();
  });

  it("get_grades supports column-only query path", async () => {
    const { getGradesHandler } = await import("../src/tools/instructor.js");

    bbClientMock.getEnrolledUsers.mockResolvedValue([
      { id: "u1", userName: "alice", name: { given: "Alice", family: "Doe" } },
    ]);
    bbClientMock.getColumnGrades.mockResolvedValue([
      { userId: "u1", status: "GRADED", score: 89, text: "B+" },
    ]);

    const result = await getGradesHandler({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      columnId: "col1",
    });

    const parsed = parseToolText(result);
    expect(parsed.columnId).toBe("col1");
    expect(parsed.count).toBe(1);
    expect(parsed.grades[0].userName).toBe("alice");
  });

  it("get_grades supports per-user filtered query path", async () => {
    const { getGradesHandler } = await import("../src/tools/instructor.js");

    bbClientMock.getEnrolledUsers.mockResolvedValue([
      { id: "u1", userName: "alice" },
      { id: "u2", userName: "bob" },
    ]);
    bbClientMock.getGrades.mockImplementation(async (_courseId: string, userId: string) => {
      if (userId === "u1") {
        return [
          { columnId: "col1", score: 91 },
          { columnId: "col2", score: 75 },
        ];
      }
      return [{ columnId: "col1", score: 60 }];
    });

    const result = await getGradesHandler({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      userId: "u1",
      columnId: "col1",
    });

    const parsed = parseToolText(result);
    expect(parsed.count).toBe(1);
    expect(parsed.users[0].userId).toBe("u1");
    expect(parsed.users[0].grades).toHaveLength(1);
    expect(parsed.users[0].grades[0].columnId).toBe("col1");
  });

  it("get_submission_status reports submitted and missing users", async () => {
    const { getSubmissionStatusHandler } = await import(
      "../src/tools/instructor.js"
    );

    bbClientMock.getAttempts.mockResolvedValue([{ userId: "u1", status: "SUBMITTED" }]);
    bbClientMock.getEnrolledUsers.mockResolvedValue([
      { id: "u1", userName: "alice" },
      { id: "u2", userName: "bob", name: { given: "Bob", family: "Smith" } },
    ]);

    const result = await getSubmissionStatusHandler({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      columnId: "col1",
    });

    const parsed = parseToolText(result);
    expect(parsed.totalEnrolled).toBe(2);
    expect(parsed.submitted).toBe(1);
    expect(parsed.notSubmitted).toBe(1);
    expect(parsed.missingUsers[0].userId).toBe("u2");
  });

  it("get_grade_distribution returns message for empty/zero scores", async () => {
    const { getGradeDistributionHandler } = await import(
      "../src/tools/instructor.js"
    );

    bbClientMock.getColumnGrades.mockResolvedValue([
      { userId: "u1", score: null },
      { userId: "u2", score: 0 },
    ]);

    const result = await getGradeDistributionHandler({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      columnId: "col1",
    });

    expect(result.content[0].text).toContain("No scores found");
  });

  it("get_grade_distribution computes stats and bucket counts", async () => {
    const { getGradeDistributionHandler } = await import(
      "../src/tools/instructor.js"
    );

    bbClientMock.getColumnGrades.mockResolvedValue([
      { userId: "u1", score: 95 },
      { userId: "u2", score: 85 },
      { userId: "u3", score: 72 },
      { userId: "u4", score: 65 },
      { userId: "u5", score: 40 },
    ]);

    const result = await getGradeDistributionHandler({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      columnId: "col1",
    });

    const parsed = parseToolText(result);
    expect(parsed.count).toBe(5);
    expect(parsed.distribution).toEqual({ A: 1, B: 1, C: 1, D: 1, F: 1 });
  });

  it("get_discussion_summary reports unique participants and snippets", async () => {
    const { getDiscussionSummaryHandler } = await import(
      "../src/tools/instructor.js"
    );

    bbClientMock.getDiscussionPosts.mockResolvedValue([
      { id: "p1", authorId: "u1", body: "a".repeat(400) },
      { id: "p2", authorId: "u1", body: "short" },
      { id: "p3", authorId: "u2", body: null },
    ]);

    const result = await getDiscussionSummaryHandler({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      threadId: "thread-1",
    });

    const parsed = parseToolText(result);
    expect(parsed.totalPosts).toBe(3);
    expect(parsed.uniqueParticipants).toBe(2);
    expect(parsed.posts[0].bodySnippet.length).toBe(300);
  });

  it("get_at_risk_students flags by average threshold and missing assignments", async () => {
    const { getAtRiskStudentsHandler } = await import(
      "../src/tools/instructor.js"
    );

    bbClientMock.getEnrolledUsers.mockResolvedValue([
      { id: "u1", userName: "alice" },
      { id: "u2", userName: "bob" },
      { id: "u3", userName: "carol" },
    ]);
    bbClientMock.getAssignments.mockResolvedValue([
      { id: "a1" },
      { id: "a2" },
      { id: "a3" },
      { id: "a4" },
    ]);
    bbClientMock.getGrades.mockImplementation(async (_courseId: string, userId: string) => {
      if (userId === "u1") {
        return [
          { columnId: "a1", score: 55 },
          { columnId: "a2", score: 58 },
        ];
      }
      if (userId === "u2") {
        return [
          { columnId: "a1", score: 90 },
          { columnId: "a2", score: 91 },
          { columnId: "a3", score: 92 },
          { columnId: "a4", score: 93 },
        ];
      }
      return [
        { columnId: "a1", score: 80 },
      ];
    });

    const result = await getAtRiskStudentsHandler({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      gradingThreshold: 70,
    });

    const parsed = parseToolText(result);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].risk).toBe("high");
    expect(parsed.find((item: any) => item.userId === "u3")?.risk).toBe("low");
  });

  it("draft_announcement returns prompt and optional posted artifact", async () => {
    const { draftAnnouncementHandler } = await import(
      "../src/tools/instructor.js"
    );

    bbClientMock.createAnnouncement.mockResolvedValue({
      id: "ann-1",
      created: "2026-05-24T00:00:00.000Z",
    });

    const dryRun = await draftAnnouncementHandler({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      topic: "Midterm updates",
      tone: "formal",
      post: false,
    });
    const posted = await draftAnnouncementHandler({
      caller_identity: { userId: "inst-1", role: "instructor" },
      courseId: "course-a",
      topic: "Urgent: assignment deadline",
      tone: "urgent",
      post: true,
    });

    const dryRunParsed = parseToolText(dryRun);
    const postedParsed = parseToolText(posted);

    expect(dryRunParsed.posted).toBeNull();
    expect(dryRunParsed.draftPrompt).toContain("professionally and formally");
    expect(postedParsed.posted.id).toBe("ann-1");
    expect(postedParsed.draftPrompt).toContain("Write with urgency");
  });
});
