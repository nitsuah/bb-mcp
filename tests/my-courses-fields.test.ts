import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.BB_CLIENT_ID ??= "test-client-id";
  process.env.BB_CLIENT_SECRET ??= "test-client-secret";
});

const bbClientMock = {
  getCourses: vi.fn(),
};

vi.mock("../src/auth.js", () => ({
  parseIdentity: (raw: unknown) => raw,
  checkAuthorization: vi.fn(),
  checkCourseMemberEntitlement: vi.fn(),
}));
vi.mock("../src/bb-client.js", () => ({ bbClient: bbClientMock }));

const parse = (result: any): any => JSON.parse(result.content[0].text);

beforeEach(() => {
  vi.clearAllMocks();
});

async function myCourses(courses: unknown[]) {
  bbClientMock.getCourses.mockResolvedValue(courses);
  const { getMyCoursesHandler } = await import("../src/tools/student.js");
  return parse(
    await getMyCoursesHandler({
      caller_identity: { userId: "u1", role: "student" },
    }),
  );
}

const base = { id: "c1", courseId: "BIO-101", name: "Biology" };
const normalized = {
  ...base,
  description: null,
  instructor: null,
  term: null,
  status: "Unknown",
};

describe("get_my_courses optional fields", () => {
  it.each([
    ["missing", {}],
    [
      "null",
      { description: null, instructor: null, term: null, availability: null },
    ],
    ["availability without a value", { availability: {} }],
  ])("normalizes %s optional fields", async (_label, extra) => {
    expect(await myCourses([{ ...base, ...extra }])).toEqual([normalized]);
  });

  it("passes provided values through", async () => {
    const extra = {
      description: "Intro",
      instructor: "Sample Instructor",
      term: "Fall",
    };

    const out = await myCourses([
      { ...base, ...extra, availability: { available: "Yes" } },
    ]);

    expect(out).toEqual([{ ...base, ...extra, status: "Yes" }]);
  });

  it.each(["No", false])("keeps explicit availability %j", async (value) => {
    const out = await myCourses([
      { ...base, availability: { available: value } },
    ]);

    expect(out[0].status).toBe(value);
  });

  it("returns an empty list for no courses", async () => {
    expect(await myCourses([])).toEqual([]);
    expect(bbClientMock.getCourses).toHaveBeenCalledWith("u1");
  });
});
