import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.BB_CLIENT_ID ??= "test-client-id";
  process.env.BB_CLIENT_SECRET ??= "test-client-secret";
});

const parseIdentityMock = vi.fn((raw: unknown) => raw as any);
const checkAuthorizationMock = vi.fn();

const bbClientMock = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
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

describe("admin tools", () => {
  it("list_users returns mapped users and respects limit/offset/search", async () => {
    const { listUsersHandler } = await import("../src/tools/admin.js");

    bbClientMock.get.mockResolvedValue({
      data: {
        results: [
          {
            id: "u1",
            userId: "u1",
            userName: "alice",
            name: { given: "Alice", family: "Doe" },
            emailAddress: "alice@example.edu",
            created: "2026-01-01",
          },
        ],
      },
    });

    const result = await listUsersHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      limit: 10,
      offset: 0,
      search: "alice",
    });

    const parsed = parseToolText(result);
    expect(parsed.count).toBe(1);
    expect(parsed.users[0].userName).toBe("alice");
    expect(bbClientMock.get).toHaveBeenCalledWith(
      "/users",
      expect.objectContaining({
        params: expect.objectContaining({ search: "alice" }),
      }),
    );
  });

  it("list_users handles missing results and no search filter", async () => {
    const { listUsersHandler } = await import("../src/tools/admin.js");

    bbClientMock.get.mockResolvedValue({ data: {} });

    const result = await listUsersHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      limit: 100,
      offset: 0,
    });

    const parsed = parseToolText(result);
    expect(parsed.count).toBe(0);
    expect(parsed.users).toEqual([]);
  });

  it("get_user maps full name when present", async () => {
    const { getUserHandler } = await import("../src/tools/admin.js");

    bbClientMock.get.mockResolvedValue({
      data: {
        id: "u1",
        userName: "alice",
        name: { given: "Alice", family: "Doe" },
        emailAddress: "alice@example.edu",
        availability: { available: true },
      },
    });

    const result = await getUserHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      userId: "u1",
    });

    const parsed = parseToolText(result);
    expect(parsed.userId).toBe("u1");
    expect(parsed.name).toBe("Alice Doe");
  });

  it("get_user returns null name when name is absent", async () => {
    const { getUserHandler } = await import("../src/tools/admin.js");

    bbClientMock.get.mockResolvedValue({
      data: { id: "u2", userName: "bob" },
    });

    const result = await getUserHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      userId: "u2",
    });

    const parsed = parseToolText(result);
    expect(parsed.name).toBeNull();
  });

  it("list_enrollments builds course+user URL and maps results", async () => {
    const { listEnrollmentsHandler } = await import("../src/tools/admin.js");

    bbClientMock.get.mockResolvedValue({
      data: {
        results: [
          {
            userId: "u1",
            courseId: "course-a",
            user: { id: "u1", userName: "alice", name: { given: "Alice" } },
            course: { id: "course-a", courseId: "CS101", name: "Intro" },
            role: "Student",
            availability: { available: true },
            created: "2026-01-01",
          },
        ],
      },
    });

    const result = await listEnrollmentsHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      courseId: "course-a",
      userId: "u1",
      limit: 100,
      offset: 0,
    });

    expect(bbClientMock.get).toHaveBeenCalledWith(
      "/courses/course-a/users/u1",
      expect.anything(),
    );
    const parsed = parseToolText(result);
    expect(parsed.count).toBe(1);
    expect(parsed.enrollments[0].user.userName).toBe("alice");
  });

  it("list_enrollments falls back to course-only, user-only, and site-wide URLs", async () => {
    const { listEnrollmentsHandler } = await import("../src/tools/admin.js");
    bbClientMock.get.mockResolvedValue({ data: { results: [] } });

    await listEnrollmentsHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      courseId: "course-a",
      limit: 100,
      offset: 0,
    });
    expect(bbClientMock.get).toHaveBeenLastCalledWith(
      "/courses/course-a/users",
      expect.anything(),
    );

    await listEnrollmentsHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      userId: "u1",
      limit: 100,
      offset: 0,
    });
    expect(bbClientMock.get).toHaveBeenLastCalledWith(
      "/users/u1/courses",
      expect.anything(),
    );

    await listEnrollmentsHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      limit: 100,
      offset: 0,
    });
    expect(bbClientMock.get).toHaveBeenLastCalledWith(
      "/enrollments",
      expect.anything(),
    );
  });

  it("list_enrollments tolerates a response without a results property", async () => {
    const { listEnrollmentsHandler } = await import("../src/tools/admin.js");
    bbClientMock.get.mockResolvedValue({ data: null });

    const result = await listEnrollmentsHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      limit: 100,
      offset: 0,
    });

    const parsed = parseToolText(result);
    expect(parsed.enrollments).toEqual([]);
  });

  it("list_enrollments maps a single enrollment object for the courseId+userId endpoint", async () => {
    const { listEnrollmentsHandler } = await import("../src/tools/admin.js");
    bbClientMock.get.mockResolvedValue({
      data: {
        userId: "u1",
        courseId: "course-a",
        user: { id: "u1", userName: "alice", name: { given: "Alice" } },
        course: { id: "course-a", courseId: "CS101", name: "Intro" },
        role: "Student",
        availability: { available: true },
        created: "2026-01-01",
      },
    });

    const result = await listEnrollmentsHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      courseId: "course-a",
      userId: "u1",
      limit: 100,
      offset: 0,
    });

    const parsed = parseToolText(result);
    expect(parsed.count).toBe(1);
    expect(parsed.enrollments[0].userId).toBe("u1");
    expect(parsed.enrollments[0].user.userName).toBe("alice");
  });

  it("list_enrollments encodes courseId and userId path segments", async () => {
    const { listEnrollmentsHandler } = await import("../src/tools/admin.js");
    bbClientMock.get.mockResolvedValue({ data: { results: [] } });

    await listEnrollmentsHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      courseId: "course/a",
      userId: "u 1",
      limit: 100,
      offset: 0,
    });

    expect(bbClientMock.get).toHaveBeenLastCalledWith(
      "/courses/course%2Fa/users/u%201",
      expect.anything(),
    );
  });

  it("create_enrollment posts role and availability", async () => {
    const { createEnrollmentHandler } = await import("../src/tools/admin.js");

    bbClientMock.post.mockResolvedValue({
      data: {
        userId: "u1",
        courseId: "course-a",
        role: "Student",
        availability: { available: true },
      },
    });

    const result = await createEnrollmentHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      courseId: "course-a",
      userId: "u1",
      role: "Student",
      availability: "Yes",
    });

    expect(bbClientMock.post).toHaveBeenCalledWith(
      "/courses/course-a/users/u1",
      { role: "Student", availability: { available: true } },
    );
    const parsed = parseToolText(result);
    expect(parsed.enrollment.role).toBe("Student");
  });

  it("update_enrollment sends only provided fields", async () => {
    const { updateEnrollmentHandler } = await import("../src/tools/admin.js");

    bbClientMock.patch.mockResolvedValue({
      data: {
        userId: "u1",
        courseId: "course-a",
        role: "Instructor",
        availability: { available: false },
      },
    });

    const result = await updateEnrollmentHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      courseId: "course-a",
      userId: "u1",
      role: "Instructor",
      availability: "No",
    });

    expect(bbClientMock.patch).toHaveBeenCalledWith(
      "/courses/course-a/users/u1",
      { role: "Instructor", availability: { available: false } },
    );
    const parsed = parseToolText(result);
    expect(parsed.enrollment.role).toBe("Instructor");
  });

  it("update_enrollment rejects a request with no mutable fields", async () => {
    const { updateEnrollmentHandler } = await import("../src/tools/admin.js");

    await expect(
      updateEnrollmentHandler({
        caller_identity: { userId: "admin-1", role: "admin" },
        courseId: "course-a",
        userId: "u1",
      }),
    ).rejects.toThrow(/requires at least one of/);

    expect(bbClientMock.patch).not.toHaveBeenCalled();
  });

  it("delete_enrollment removes the enrollment", async () => {
    const { deleteEnrollmentHandler } = await import("../src/tools/admin.js");
    bbClientMock.delete.mockResolvedValue({ data: {} });

    const result = await deleteEnrollmentHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      courseId: "course-a",
      userId: "u1",
    });

    expect(bbClientMock.delete).toHaveBeenCalledWith(
      "/courses/course-a/users/u1",
    );
    const parsed = parseToolText(result);
    expect(parsed.success).toBe(true);
  });

  it("list_audit_logs applies optional filters and returns results", async () => {
    const { listAuditLogsHandler } = await import("../src/tools/admin.js");

    bbClientMock.get.mockResolvedValue({
      data: { results: [{ event: "login" }] },
    });

    const result = await listAuditLogsHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      limit: 50,
      offset: 0,
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      eventType: "login",
      userId: "u1",
      courseId: "course-a",
    });

    expect(bbClientMock.get).toHaveBeenCalledWith(
      "/audit/logs",
      expect.objectContaining({
        params: expect.objectContaining({
          startDate: "2026-01-01",
          endDate: "2026-01-31",
          eventType: "login",
          userId: "u1",
          courseId: "course-a",
        }),
      }),
    );
    const parsed = parseToolText(result);
    expect(parsed.count).toBe(1);
  });

  it("list_audit_logs falls back gracefully when the endpoint returns 404", async () => {
    const { listAuditLogsHandler } = await import("../src/tools/admin.js");
    bbClientMock.get.mockRejectedValue(
      Object.assign(new Error("Not Found"), { status: 404 }),
    );

    const result = await listAuditLogsHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      limit: 50,
      offset: 0,
    });

    const parsed = parseToolText(result);
    expect(parsed.count).toBe(0);
    expect(parsed.note).toContain("not available");
  });

  it("list_audit_logs falls back gracefully when the endpoint returns 501", async () => {
    const { listAuditLogsHandler } = await import("../src/tools/admin.js");
    bbClientMock.get.mockRejectedValue(
      Object.assign(new Error("Not Implemented"), {
        response: { status: 501 },
      }),
    );

    const result = await listAuditLogsHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      limit: 50,
      offset: 0,
    });

    const parsed = parseToolText(result);
    expect(parsed.count).toBe(0);
    expect(parsed.note).toContain("not available");
  });

  it("list_audit_logs propagates non-404/501 errors instead of masking them", async () => {
    const { listAuditLogsHandler } = await import("../src/tools/admin.js");
    bbClientMock.get.mockRejectedValue(
      Object.assign(new Error("Forbidden"), { status: 403 }),
    );

    await expect(
      listAuditLogsHandler({
        caller_identity: { userId: "admin-1", role: "admin" },
        limit: 50,
        offset: 0,
      }),
    ).rejects.toThrow("Forbidden");
  });
});
