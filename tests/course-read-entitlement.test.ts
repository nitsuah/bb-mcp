import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.BB_CLIENT_ID ??= "test-client-id";
  process.env.BB_CLIENT_SECRET ??= "test-client-secret";
});

// Any upstream data call (everything except the membership lookup) is a failure
// when the caller is not a member of the course.
const dataCall = vi.fn();
const bbClientMock: Record<string, any> = new Proxy(
  { getCourseMembership: vi.fn() },
  {
    get(target, prop: string | symbol) {
      if (typeof prop === "symbol" || prop === "then") return undefined;
      return prop in target ? (target as any)[prop] : dataCall;
    },
  },
);

vi.mock("../src/bb-client.js", () => ({ bbClient: bbClientMock }));
vi.mock("../src/auth.js", async () => {
  const actual = await vi.importActual<typeof import("../src/auth.js")>("../src/auth.js");
  return { ...actual, checkAuthorization: vi.fn() };
});

const loaders: Record<string, () => Promise<any>> = {
  instructor: () => import("../src/tools/instructor.js"),
  student: () => import("../src/tools/student.js"),
  shared: () => import("../src/tools/shared.js"),
};

const instructor = { userId: "u1", role: "instructor" };
const student = { userId: "u1", role: "student" };
const C = "course-x";

const cases: Array<[string, string, string, Record<string, unknown>, any]> = [
  ["list_roster", "instructor", "listRosterHandler", { courseId: C }, instructor],
  ["get_grades", "instructor", "getGradesHandler", { courseId: C }, instructor],
  ["get_submission_status", "instructor", "getSubmissionStatusHandler", { courseId: C, columnId: "c" }, instructor],
  ["get_grade_distribution", "instructor", "getGradeDistributionHandler", { courseId: C, columnId: "c" }, instructor],
  ["get_discussion_summary", "instructor", "getDiscussionSummaryHandler", { courseId: C, threadId: "t" }, instructor],
  ["get_at_risk_students", "instructor", "getAtRiskStudentsHandler", { courseId: C, gradingThreshold: 70 }, instructor],
  ["draft_announcement", "instructor", "draftAnnouncementHandler", { courseId: C, topic: "topic", tone: "friendly", post: false }, instructor],
  ["get_upcoming_assignments", "student", "getUpcomingAssignmentsHandler", { courseId: C, daysAhead: 14 }, student],
  ["get_my_grades", "student", "getMyGradesHandler", { courseId: C }, student],
  ["get_course_content", "student", "getCourseContentHandler", { courseId: C }, student],
  ["get_course_contents", "student", "getCourseContentsHandler", { courseId: C }, student],
  ["get_assignment_feedback", "student", "getAssignmentFeedbackHandler", { courseId: C, columnId: "c" }, student],
  ["get_announcements", "student", "getAnnouncementsHandler", { courseId: C, unreadOnly: false }, student],
  ["create_assignment_submission", "student", "createAssignmentSubmissionHandler", { courseId: C, columnId: "c" }, student],
  ["search_course_materials", "shared", "searchCourseMaterialsHandler", { courseId: C, query: "q" }, student],
];

beforeEach(() => {
  vi.clearAllMocks();
  bbClientMock.getCourseMembership.mockResolvedValue(null);
});

describe("course-scoped tools require course membership", () => {
  it.each(cases)("%s denies a non-member before any data call", async (_tool, mod, handler, args, identity) => {
    const m: any = await loaders[mod]();
    await expect(
      m[handler]({ caller_identity: identity, ...args }),
    ).rejects.toThrow(/not entitled/);
    expect(bbClientMock.getCourseMembership).toHaveBeenCalledWith(C, "u1");
    expect(dataCall).not.toHaveBeenCalled();
  });

  it.each(cases.filter((c) => c[1] === "instructor"))(
    "%s denies a student-role course membership",
    async (_tool, mod, handler, args, identity) => {
      bbClientMock.getCourseMembership.mockResolvedValue({ userId: "u1", courseRoleId: "Student" });
      const m: any = await loaders[mod]();
      await expect(m[handler]({ caller_identity: identity, ...args })).rejects.toThrow(/not entitled/);
      expect(dataCall).not.toHaveBeenCalled();
    },
  );
});

describe("membership edge cases", () => {
  it("does not treat an empty course role as enrolled", async () => {
    const { checkCourseMemberEntitlement } = await import("../src/auth.js");
    const client = { getCourseMembership: vi.fn().mockResolvedValue({ userId: "u1", courseRoleId: "" }) };
    await expect(
      checkCourseMemberEntitlement({ identity: student as any, toolName: "t", courseId: C }, client),
    ).rejects.toThrow(/not entitled/);
  });

  it("rejects malformed course ids without a lookup", async () => {
    const { checkCourseMemberEntitlement } = await import("../src/auth.js");
    const client = { getCourseMembership: vi.fn() };
    await expect(
      checkCourseMemberEntitlement({ identity: student as any, toolName: "t", courseId: "../x?y" }, client),
    ).rejects.toThrow(/invalid format/);
    expect(client.getCourseMembership).not.toHaveBeenCalled();
  });
});
