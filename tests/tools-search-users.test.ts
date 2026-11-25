import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.BB_CLIENT_ID ??= "test-client-id";
  process.env.BB_CLIENT_SECRET ??= "test-client-secret";
});

const parseIdentityMock = vi.fn((raw: unknown) => raw as any);
const checkAuthorizationMock = vi.fn();
const getLocalAuditLogEntriesMock = vi.fn(() => ({ entries: [], total: 0 }));
const bbClientMock = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
};

vi.mock("../src/auth.js", () => ({
  parseIdentity: parseIdentityMock,
  checkAuthorization: checkAuthorizationMock,
  getLocalAuditLogEntries: getLocalAuditLogEntriesMock,
}));
vi.mock("../src/bb-client.js", () => ({ bbClient: bbClientMock }));

beforeEach(() => {
  vi.clearAllMocks();
  parseIdentityMock.mockImplementation((raw: unknown) => raw as any);
});

describe("list_users search filter", () => {
  it("forwards the search string with pagination to GET /users", async () => {
    const { listUsersHandler } = await import("../src/tools/admin.js");
    bbClientMock.get.mockResolvedValue({ data: { results: [] } });

    await listUsersHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      search: "ali",
      limit: 5,
      offset: 0,
    });

    expect(bbClientMock.get).toHaveBeenCalledWith("/users", {
      params: { limit: 5, offset: 0, search: "ali" },
    });
  });

  it("omits search from params when no search is supplied", async () => {
    const { listUsersHandler } = await import("../src/tools/admin.js");
    bbClientMock.get.mockResolvedValue({ data: { results: [] } });

    await listUsersHandler({
      caller_identity: { userId: "admin-1", role: "admin" },
      limit: 5,
      offset: 0,
    });

    expect(bbClientMock.get).toHaveBeenCalledWith("/users", {
      params: { limit: 5, offset: 0 },
    });
    expect(bbClientMock.get.mock.calls[0][1].params).not.toHaveProperty("search");
  });

  it("checks authorization as list_users before making the request", async () => {
    const { listUsersHandler } = await import("../src/tools/admin.js");
    bbClientMock.get.mockResolvedValue({ data: { results: [] } });
    const identity = { userId: "admin-1", role: "admin" };

    await listUsersHandler({
      caller_identity: identity,
      search: "ali",
      limit: 5,
      offset: 0,
    });

    expect(checkAuthorizationMock).toHaveBeenCalledWith({
      identity,
      toolName: "list_users",
    });
  });

  it("does not call Blackboard when authorization denies the request", async () => {
    const { listUsersHandler } = await import("../src/tools/admin.js");
    checkAuthorizationMock.mockImplementationOnce(() => {
      throw new Error("denied");
    });

    await expect(
      listUsersHandler({
        caller_identity: { userId: "admin-1", role: "admin" },
        search: "ali",
        limit: 5,
        offset: 0,
      }),
    ).rejects.toThrow("denied");
    expect(bbClientMock.get).not.toHaveBeenCalled();
  });
});
