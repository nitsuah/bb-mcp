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
  getCourseContent: vi.fn(),
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

describe("shared tools", () => {
  it("searches across caller courses when courseId is omitted", async () => {
    const { searchCourseMaterialsHandler } = await import("../src/tools/shared.js");

    bbClientMock.getCourses.mockResolvedValue([
      { id: "course-a", courseId: "A", name: "Course A" },
      { id: "course-b", courseId: "B", name: "Course B" },
    ]);

    bbClientMock.getCourseContent.mockImplementation(async (courseId: string) => {
      if (courseId === "course-a") {
        return [{ id: "m1", title: "Week 1", body: "intro to biology and cells" }];
      }
      return [{ id: "m2", title: "Syllabus", body: "grading rubric" }];
    });

    const result = await searchCourseMaterialsHandler({
      caller_identity: { userId: "u1", role: "student" },
      query: "bio",
    });

    const parsed = parseToolText(result);
    expect(parsed.count).toBe(1);
    expect(parsed.results[0].courseId).toBe("A");
    expect(parsed.results[0].bodySnippet).toContain("bio");
  });

  it("searches only within explicit course when courseId is provided", async () => {
    const { searchCourseMaterialsHandler } = await import("../src/tools/shared.js");

    bbClientMock.getCourse.mockResolvedValue({
      id: "course-a",
      courseId: "A",
      name: "Course A",
    });
    bbClientMock.getCourseContent.mockResolvedValue([
      { id: "m1", title: "Exam review", body: "Chapter 1" },
      { id: "m2", title: "Lab safety", body: "Goggles required" },
    ]);

    const result = await searchCourseMaterialsHandler({
      caller_identity: { userId: "u1", role: "student" },
      query: "exam",
      courseId: "course-a",
    });

    const parsed = parseToolText(result);
    expect(parsed.count).toBe(1);
    expect(parsed.results[0].id).toBe("m1");
    expect(parsed.results[0].type).toBe("unknown");
    expect(checkAuthorizationMock).toHaveBeenCalledWith({
      identity: { userId: "u1", role: "student" },
      toolName: "search_course_materials",
      courseId: "course-a",
    });
  });
});
