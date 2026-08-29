import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.BB_CLIENT_ID ??= "test-client-id";
  process.env.BB_CLIENT_SECRET ??= "test-client-secret";
});

const parseIdentityMock = vi.fn((raw: unknown) => raw as any);
const checkAuthorizationMock = vi.fn();

const bbClientMock = {
  get: vi.fn(),
  getCourses: vi.fn(),
  getEnrolledUsers: vi.fn(),
  getGrades: vi.fn(),
  getAssignments: vi.fn(),
  getAnnouncements: vi.fn(),
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
  bbClientMock.get.mockResolvedValue({ data: {} });
});

describe("parent tools", () => {
  it("get_my_children returns observed students, skipping self and duplicates", async () => {
    const { getMyChildrenHandler } = await import("../src/tools/parent.js");

    bbClientMock.getCourses.mockResolvedValue([
      { id: "course-a", courseId: "CS101", name: "Intro" },
    ]);
    bbClientMock.getEnrolledUsers.mockResolvedValue([
      {
        id: "parent-1",
        userId: "parent-1",
        userName: "parentA",
        role: "Observer",
      },
      { id: "u1", userId: "u1", userName: "alice", name: { given: "Alice" } },
      { id: "u1", userId: "u1", userName: "alice", name: { given: "Alice" } },
    ]);

    const result = await getMyChildrenHandler({
      caller_identity: { userId: "parent-1", role: "parent" },
    });

    const parsed = parseToolText(result);
    expect(parsed.count).toBe(1);
    expect(parsed.children[0].userId).toBe("u1");
  });

  it("get_my_children returns no children when parent is not an observer", async () => {
    const { getMyChildrenHandler } = await import("../src/tools/parent.js");

    bbClientMock.getCourses.mockResolvedValue([
      { id: "course-a", courseId: "CS101", name: "Intro" },
    ]);
    bbClientMock.getEnrolledUsers.mockResolvedValue([
      {
        id: "parent-1",
        userId: "parent-1",
        userName: "parentA",
        role: "Student",
      },
      { id: "u1", userId: "u1", userName: "alice" },
    ]);

    const result = await getMyChildrenHandler({
      caller_identity: { userId: "parent-1", role: "parent" },
    });

    const parsed = parseToolText(result);
    expect(parsed.count).toBe(0);
  });

  it("get_children_courses filters by childUserId and reports status", async () => {
    const { getChildrenCoursesHandler } =
      await import("../src/tools/parent.js");

    bbClientMock.getCourses.mockImplementation(async (userId: string) => {
      if (userId === "parent-1")
        return [{ id: "course-a", courseId: "CS101", name: "Intro" }];
      return [
        {
          id: "course-a",
          courseId: "CS101",
          name: "Intro",
          availability: { available: "true" },
        },
        {
          id: "course-b",
          courseId: "CS102",
          name: "Data",
          availability: { available: "false" },
        },
      ];
    });
    bbClientMock.getEnrolledUsers.mockResolvedValue([
      {
        id: "parent-1",
        userId: "parent-1",
        userName: "parentA",
        role: "Observer",
      },
      { id: "u1", userId: "u1", userName: "alice" },
    ]);

    const result = await getChildrenCoursesHandler({
      caller_identity: { userId: "parent-1", role: "parent" },
      childUserId: "u1",
    });

    const parsed = parseToolText(result);
    expect(parsed.count).toBe(1);
    expect(parsed.childrenCourses[0].childUserId).toBe("u1");
    expect(parsed.childrenCourses[0].courses).toHaveLength(2);
  });

  it("get_children_courses returns nothing when no matching children found", async () => {
    const { getChildrenCoursesHandler } =
      await import("../src/tools/parent.js");

    bbClientMock.getCourses.mockResolvedValue([]);
    bbClientMock.getEnrolledUsers.mockResolvedValue([]);

    const result = await getChildrenCoursesHandler({
      caller_identity: { userId: "parent-1", role: "parent" },
    });

    const parsed = parseToolText(result);
    expect(parsed.count).toBe(0);
  });

  it("get_children_grades computes averages and filters by courseId", async () => {
    const { getChildrenGradesHandler } = await import("../src/tools/parent.js");

    bbClientMock.getCourses.mockImplementation(async (userId: string) => {
      if (userId === "parent-1")
        return [{ id: "course-a", courseId: "CS101", name: "Intro" }];
      return [
        { id: "course-a", courseId: "CS101", name: "Intro" },
        { id: "course-b", courseId: "CS102", name: "Data" },
      ];
    });
    bbClientMock.getEnrolledUsers.mockResolvedValue([
      {
        id: "parent-1",
        userId: "parent-1",
        userName: "parentA",
        role: "Observer",
      },
      { id: "u1", userId: "u1", userName: "alice" },
    ]);
    bbClientMock.getGrades.mockResolvedValue([
      { columnId: "col1", score: 90 },
      { columnId: "col2", score: null },
    ]);

    const result = await getChildrenGradesHandler({
      caller_identity: { userId: "parent-1", role: "parent" },
      courseId: "course-a",
    });

    const parsed = parseToolText(result);
    expect(parsed.count).toBe(1);
    expect(parsed.childrenGrades[0].average).toBe(90);
  });

  it("get_children_grades reports null average with no scored grades", async () => {
    const { getChildrenGradesHandler } = await import("../src/tools/parent.js");

    bbClientMock.getCourses.mockImplementation(async (userId: string) => {
      if (userId === "parent-1")
        return [{ id: "course-a", courseId: "CS101", name: "Intro" }];
      return [{ id: "course-a", courseId: "CS101", name: "Intro" }];
    });
    bbClientMock.getEnrolledUsers.mockResolvedValue([
      {
        id: "parent-1",
        userId: "parent-1",
        userName: "parentA",
        role: "Observer",
      },
      { id: "u1", userId: "u1", userName: "alice" },
    ]);
    bbClientMock.getGrades.mockResolvedValue([
      { columnId: "col1", score: null },
    ]);

    const result = await getChildrenGradesHandler({
      caller_identity: { userId: "parent-1", role: "parent" },
    });

    const parsed = parseToolText(result);
    expect(parsed.childrenGrades[0].average).toBeNull();
  });

  it("get_children_upcoming_assignments filters by due window and sorts by due date", async () => {
    const { getChildrenUpcomingAssignmentsHandler } =
      await import("../src/tools/parent.js");

    const now = Date.now();
    bbClientMock.getCourses.mockImplementation(async (userId: string) => {
      if (userId === "parent-1")
        return [{ id: "course-a", courseId: "CS101", name: "Intro" }];
      return [{ id: "course-a", courseId: "CS101", name: "Intro" }];
    });
    bbClientMock.getEnrolledUsers.mockResolvedValue([
      {
        id: "parent-1",
        userId: "parent-1",
        userName: "parentA",
        role: "Observer",
      },
      { id: "u1", userId: "u1", userName: "alice" },
    ]);
    bbClientMock.getAssignments.mockResolvedValue([
      {
        id: "a1",
        title: "Due soon",
        due: new Date(now + 2 * 86400000).toISOString(),
        maxScore: 100,
      },
      {
        id: "a2",
        title: "Due later",
        due: new Date(now + 1 * 86400000).toISOString(),
        maxScore: 50,
      },
      {
        id: "a3",
        title: "Too far",
        due: new Date(now + 100 * 86400000).toISOString(),
      },
      { id: "a4", title: "No due date" },
      {
        id: "a5",
        title: "Already past",
        due: new Date(now - 86400000).toISOString(),
      },
    ]);

    const result = await getChildrenUpcomingAssignmentsHandler({
      caller_identity: { userId: "parent-1", role: "parent" },
      daysAhead: 14,
    });

    const parsed = parseToolText(result);
    const upcoming = parsed.childrenUpcoming[0].upcomingAssignments;
    expect(upcoming).toHaveLength(2);
    expect(upcoming[0].id).toBe("a2");
    expect(upcoming[1].id).toBe("a1");
  });

  it("get_children_upcoming_assignments filters by courseId", async () => {
    const { getChildrenUpcomingAssignmentsHandler } =
      await import("../src/tools/parent.js");

    bbClientMock.getCourses.mockImplementation(async (userId: string) => {
      if (userId === "parent-1")
        return [{ id: "course-a", courseId: "CS101", name: "Intro" }];
      return [
        { id: "course-a", courseId: "CS101", name: "Intro" },
        { id: "course-b", courseId: "CS102", name: "Data" },
      ];
    });
    bbClientMock.getEnrolledUsers.mockResolvedValue([
      {
        id: "parent-1",
        userId: "parent-1",
        userName: "parentA",
        role: "Observer",
      },
      { id: "u1", userId: "u1", userName: "alice" },
    ]);
    bbClientMock.getAssignments.mockResolvedValue([]);

    const result = await getChildrenUpcomingAssignmentsHandler({
      caller_identity: { userId: "parent-1", role: "parent" },
      courseId: "course-b",
      daysAhead: 14,
    });

    const parsed = parseToolText(result);
    expect(parsed.count).toBe(1);
    expect(parsed.childrenUpcoming[0].courseId).toBe("course-b");
  });

  it("get_children_announcements filters unread announcements", async () => {
    const { getChildrenAnnouncementsHandler } =
      await import("../src/tools/parent.js");

    bbClientMock.getCourses.mockImplementation(async (userId: string) => {
      if (userId === "parent-1")
        return [{ id: "course-a", courseId: "CS101", name: "Intro" }];
      return [{ id: "course-a", courseId: "CS101", name: "Intro" }];
    });
    bbClientMock.getEnrolledUsers.mockResolvedValue([
      {
        id: "parent-1",
        userId: "parent-1",
        userName: "parentA",
        role: "Observer",
      },
      { id: "u1", userId: "u1", userName: "alice" },
    ]);
    bbClientMock.getAnnouncements.mockResolvedValue([
      { id: "an1", title: "Read", body: "b", modified: "2026-01-02" },
      {
        id: "an2",
        title: "Unread",
        body: "b",
        creator: { id: "i1", userName: "prof" },
      },
    ]);

    const result = await getChildrenAnnouncementsHandler({
      caller_identity: { userId: "parent-1", role: "parent" },
      unreadOnly: true,
    });

    const parsed = parseToolText(result);
    expect(parsed.childrenAnnouncements[0].announcements).toHaveLength(1);
    expect(parsed.childrenAnnouncements[0].announcements[0].id).toBe("an2");
    expect(parsed.childrenAnnouncements[0].announcements[0].author).toBe(
      "prof",
    );
  });

  it("get_children_announcements returns all announcements when unreadOnly is false", async () => {
    const { getChildrenAnnouncementsHandler } =
      await import("../src/tools/parent.js");

    bbClientMock.getCourses.mockImplementation(async (userId: string) => {
      if (userId === "parent-1")
        return [{ id: "course-a", courseId: "CS101", name: "Intro" }];
      return [{ id: "course-a", courseId: "CS101", name: "Intro" }];
    });
    bbClientMock.getEnrolledUsers.mockResolvedValue([
      {
        id: "parent-1",
        userId: "parent-1",
        userName: "parentA",
        role: "Observer",
      },
      { id: "u1", userId: "u1", userName: "alice" },
    ]);
    bbClientMock.getAnnouncements.mockResolvedValue([
      { id: "an1", title: "Read", body: "b", modified: "2026-01-02" },
      { id: "an2", title: "Unread", body: "b" },
    ]);

    const result = await getChildrenAnnouncementsHandler({
      caller_identity: { userId: "parent-1", role: "parent" },
      courseId: "course-a",
      unreadOnly: false,
    });

    const parsed = parseToolText(result);
    expect(parsed.childrenAnnouncements[0].announcements).toHaveLength(2);
  });
});
