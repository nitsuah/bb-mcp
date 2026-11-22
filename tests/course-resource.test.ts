import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.BB_CLIENT_ID ??= "test-client-id";
  process.env.BB_CLIENT_SECRET ??= "test-client-secret";
});

const uri = { pathname: "/course-x", href: "course://course-x" };
const client = {
  getCourseMembership: vi.fn(),
  getCourse: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  client.getCourse.mockResolvedValue({ id: "course-x", name: "Course X" });
});

describe("course:// resource", () => {
  it("denies callers without a verified identity", async () => {
    const { readCourseResource } = await import("../src/course-resource.js");
    await expect(readCourseResource(uri, client as any)).rejects.toThrow(/verified caller identity/);
    expect(client.getCourse).not.toHaveBeenCalled();
  });

  it("denies a verified non-member", async () => {
    const { readCourseResource } = await import("../src/course-resource.js");
    const { runWithVerifiedIdentity } = await import("../src/request-identity.js");
    client.getCourseMembership.mockResolvedValue(null);
    await expect(
      runWithVerifiedIdentity({ userId: "u1", role: "student", ferpa_authorized: false }, () =>
        readCourseResource(uri, client as any),
      ),
    ).rejects.toThrow(/not entitled/);
    expect(client.getCourse).not.toHaveBeenCalled();
  });

  it("allows a verified member", async () => {
    const { readCourseResource } = await import("../src/course-resource.js");
    const { runWithVerifiedIdentity } = await import("../src/request-identity.js");
    client.getCourseMembership.mockResolvedValue({ userId: "u1", courseRoleId: "Student" });
    const result: any = await runWithVerifiedIdentity(
      { userId: "u1", role: "student", ferpa_authorized: false },
      () => readCourseResource(uri, client as any),
    );
    expect(JSON.parse(result.contents[0].text).id).toBe("course-x");
  });
});
