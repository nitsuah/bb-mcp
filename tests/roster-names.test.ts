import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.BB_CLIENT_ID ??= "test-client-id";
  process.env.BB_CLIENT_SECRET ??= "test-client-secret";
});

const bbClientMock = {
  getEnrolledUsers: vi.fn(),
};

vi.mock("../src/auth.js", () => ({
  parseIdentity: (raw: unknown) => raw,
  checkAuthorization: vi.fn(),
  checkCourseStaffEntitlement: vi.fn(),
}));
vi.mock("../src/bb-client.js", () => ({ bbClient: bbClientMock }));

const parse = (result: any): any => JSON.parse(result.content[0].text);

beforeEach(() => {
  vi.clearAllMocks();
});

async function roster(enrolled: unknown[]) {
  bbClientMock.getEnrolledUsers.mockResolvedValue(enrolled);
  const { listRosterHandler } = await import("../src/tools/instructor.js");
  return parse(
    await listRosterHandler({
      caller_identity: { userId: "i1", role: "instructor" },
      courseId: "course-1",
    }),
  );
}

describe("list_roster display names", () => {
  it.each([
    ["full name", { given: "Sample", family: "Person" }, "Sample Person"],
    ["given only", { given: "Sample" }, "Sample"],
    ["family only", { family: "Person" }, "Person"],
    ["empty name object", {}, null],
    ["blank parts", { given: "", family: "" }, null],
    ["no name", undefined, null],
  ])("formats %s", async (_label, name, expected) => {
    const out = await roster([{ id: "u1", userName: "sample", name }]);

    expect(out.users).toEqual([
      { userId: "u1", userName: "sample", name: expected, emailAddress: null },
    ]);
    expect(out).toMatchObject({ courseId: "course-1", count: 1 });
  });

  it("returns a zero count for an empty enrollment", async () => {
    expect(await roster([])).toEqual({
      courseId: "course-1",
      count: 0,
      users: [],
    });
    expect(bbClientMock.getEnrolledUsers).toHaveBeenCalledWith("course-1");
  });
});
