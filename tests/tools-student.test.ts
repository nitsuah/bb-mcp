import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.BB_CLIENT_ID ??= "test-client-id";
  process.env.BB_CLIENT_SECRET ??= "test-client-secret";
});

const parseIdentityMock = vi.fn((raw: unknown) => raw as any);
const checkAuthorizationMock = vi.fn();

const bbClientMock = {
  getCourses: vi.fn(),
  getCourse: vi.fn(),
  getAssignments: vi.fn(),
  getGrades: vi.fn(),
  getCourseContent: vi.fn(),
  getAnnouncements: vi.fn(),
  createAttempt: vi.fn(),
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
  vi.useRealTimers();
  vi.clearAllMocks();
  parseIdentityMock.mockImplementation((raw: unknown) => raw as any);
});

describe("student tools", () => {
  it("get_my_courses maps fields with null/unknown fallbacks", async () => {
    const { getMyCoursesHandler } = await import("../src/tools/student.js");

    bbClientMock.getCourses.mockResolvedValue([
      {
        id: "c1",
        courseId: "BIO-101",
        name: "Biology",
      },
    ]);

    const result = await getMyCoursesHandler({
      caller_identity: { userId: "u1", role: "student" },
    });
    const parsed = parseToolText(result);

    expect(bbClientMock.getCourses).toHaveBeenCalledWith("u1");
    expect(checkAuthorizationMock).toHaveBeenCalledWith({
      identity: { userId: "u1", role: "student" },
      toolName: "get_my_courses",
    });
    expect(parsed[0].status).toBe("Unknown");
    expect(parsed[0].description).toBeNull();
  });

  it("list_courses delegates to get_my_courses behavior", async () => {
    const { listCoursesHandler } = await import("../src/tools/student.js");

    bbClientMock.getCourses.mockResolvedValue([
      { id: "c1", courseId: "CS-1", name: "Intro CS" },
    ]);

    const result = await listCoursesHandler({
      caller_identity: { userId: "u1", role: "student" },
    });

    expect(parseToolText(result)[0].courseId).toBe("CS-1");
  });

  it("get_upcoming_assignments filters by due date window and sorts ascending", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-24T00:00:00.000Z"));

    const { getUpcomingAssignmentsHandler } = await import(
      "../src/tools/student.js"
    );

    bbClientMock.getCourses.mockResolvedValue([
      { id: "course-a", courseId: "A", name: "Course A" },
    ]);
    bbClientMock.getAssignments.mockResolvedValue([
      { id: "late", title: "Late", due: "2026-06-10T00:00:00.000Z" },
      { id: "soon", title: "Soon", due: "2026-05-25T00:00:00.000Z" },
      { id: "past", title: "Past", due: "2026-05-20T00:00:00.000Z" },
      { id: "nodue", title: "No due" },
    ]);

    const result = await getUpcomingAssignmentsHandler({
      caller_identity: { userId: "u1", role: "student" },
      daysAhead: 7,
    });

    const parsed = parseToolText(result);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("soon");
    expect(parsed[0].course).toBe("Course A");
    expect(parsed[0].dueIn).toBe("1 days");
  });

  it("get_my_grades computes per-course average and supports explicit course scope", async () => {
    const { getMyGradesHandler } = await import("../src/tools/student.js");

    bbClientMock.getCourse.mockResolvedValue({
      id: "course-a",
      courseId: "A",
      name: "Course A",
    });
    bbClientMock.getGrades.mockResolvedValue([
      { columnId: "col1", score: 90, status: "GRADED" },
      { columnId: "col2", score: 70, status: "GRADED" },
      { columnId: "col3", score: null, status: "NEEDS_GRADING" },
    ]);

    const result = await getMyGradesHandler({
      caller_identity: { userId: "u1", role: "student" },
      courseId: "course-a",
    });

    const parsed = parseToolText(result);
    expect(parsed[0].average).toBe("80.0");
    expect(parsed[0].grades).toHaveLength(3);
  });

  it("get_course_content filters by search query and applies default item metadata", async () => {
    const { getCourseContentHandler, getCourseContentsHandler } = await import(
      "../src/tools/student.js"
    );

    bbClientMock.getCourseContent.mockResolvedValue([
      { id: "1", title: "Week 1 Intro", body: "Welcome to biology" },
      { id: "2", title: "Lab", body: "Microscope setup" },
    ]);

    const filtered = await getCourseContentHandler({
      caller_identity: { userId: "u1", role: "student" },
      courseId: "course-a",
      searchQuery: "bio",
    });

    const alias = await getCourseContentsHandler({
      caller_identity: { userId: "u1", role: "student" },
      courseId: "course-a",
    });

    const filteredParsed = parseToolText(filtered);
    const aliasParsed = parseToolText(alias);
    expect(filteredParsed).toHaveLength(1);
    expect(filteredParsed[0].type).toBe("unknown");
    expect(filteredParsed[0].available).toBe("Unknown");
    expect(aliasParsed).toHaveLength(2);
  });

  it("get_assignment_feedback returns not-found message when column has no grade", async () => {
    const { getAssignmentFeedbackHandler } = await import(
      "../src/tools/student.js"
    );

    bbClientMock.getGrades.mockResolvedValue([{ columnId: "col1", score: 88 }]);

    const result = await getAssignmentFeedbackHandler({
      caller_identity: { userId: "u1", role: "student" },
      courseId: "course-a",
      columnId: "missing",
    });

    expect(result.content[0].text).toContain("No grade found");
  });

  it("get_assignment_feedback returns structured details when grade exists", async () => {
    const { getAssignmentFeedbackHandler } = await import(
      "../src/tools/student.js"
    );

    bbClientMock.getGrades.mockResolvedValue([
      {
        columnId: "col1",
        score: 92,
        status: "GRADED",
        feedback: "Great work",
        instructor_notes: "Strong analysis",
        attempt: { studentComments: "My draft", feedback: "Keep improving" },
      },
    ]);

    const result = await getAssignmentFeedbackHandler({
      caller_identity: { userId: "u1", role: "student" },
      courseId: "course-a",
      columnId: "col1",
    });

    const parsed = parseToolText(result);
    expect(parsed.score).toBe(92);
    expect(parsed.instructorNotes).toBe("Strong analysis");
    expect(parsed.studentComments).toBe("My draft");
  });

  it("get_announcements maps creator username fallback", async () => {
    const { getAnnouncementsHandler } = await import("../src/tools/student.js");

    bbClientMock.getAnnouncements.mockResolvedValue([
      { id: "a1", title: "Exam", body: "Exam on Friday" },
    ]);

    const result = await getAnnouncementsHandler({
      caller_identity: { userId: "u1", role: "student" },
      courseId: "course-a",
    });

    const parsed = parseToolText(result);
    expect(parsed[0].author).toBeNull();
  });

  it("create_assignment_submission forwards optional comments and maps response", async () => {
    const { createAssignmentSubmissionHandler } = await import(
      "../src/tools/student.js"
    );

    bbClientMock.createAttempt.mockResolvedValue({
      id: "attempt-1",
      userId: "u1",
      status: "SUBMITTED",
      score: 100,
    });

    const result = await createAssignmentSubmissionHandler({
      caller_identity: { userId: "u1", role: "student" },
      courseId: "course-a",
      columnId: "col1",
      studentComments: "Submitting now",
    });

    expect(bbClientMock.createAttempt).toHaveBeenCalledWith(
      "course-a",
      "col1",
      "u1",
      "Submitting now",
    );

    const parsed = parseToolText(result);
    expect(parsed.id).toBe("attempt-1");
    expect(parsed.score).toBe(100);
  });
});
