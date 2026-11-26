import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.BB_CLIENT_ID ??= "test-client-id";
  process.env.BB_CLIENT_SECRET ??= "test-client-secret";
});

const bbClientMock = {
  get: vi.fn(),
};

vi.mock("../src/auth.js", () => ({
  parseIdentity: (raw: unknown) => raw,
  checkAuthorization: vi.fn(),
  getLocalAuditLogEntries: vi.fn(),
}));
vi.mock("../src/bb-client.js", () => ({ bbClient: bbClientMock }));

const parse = (result: any): any => JSON.parse(result.content[0].text);

beforeEach(() => {
  vi.clearAllMocks();
});

async function list(input: Record<string, unknown>, data: unknown) {
  bbClientMock.get.mockResolvedValue({ data });
  const { listUsersHandler, ListUsersInput } =
    await import("../src/tools/admin.js");
  return parse(
    await listUsersHandler(
      ListUsersInput.parse({
        caller_identity: { userId: "admin-1", role: "admin" },
        ...input,
      }),
    ),
  );
}

describe("list_users pagination and mapping", () => {
  it("forwards non-default limit and offset and echoes them", async () => {
    const out = await list({ limit: 25, offset: 50 }, { results: [] });

    expect(bbClientMock.get.mock.calls).toEqual([
      ["/users", { params: { limit: 25, offset: 50 } }],
    ]);
    expect(out).toEqual({ users: [], limit: 25, offset: 50, count: 0 });
  });

  it("uses the schema defaults and omits search when not provided", async () => {
    await list({}, {});

    expect(bbClientMock.get.mock.calls).toEqual([
      ["/users", { params: { limit: 100, offset: 0 } }],
    ]);
  });

  it("sends search when provided", async () => {
    await list({ search: "sample" }, { results: [] });

    expect(bbClientMock.get.mock.calls[0][1]).toEqual({
      params: { limit: 100, offset: 0, search: "sample" },
    });
  });

  it("keeps optional profile fields when present and drops unknown ones", async () => {
    const profile = {
      id: "_1_1",
      userId: "u-1",
      userName: "sample.one",
      name: { given: "Sample", family: "One" },
      created: "2026-01-01",
      modified: "2026-02-01",
      institutionRoleIds: ["ROLE_A"],
    };

    const out = await list(
      {},
      {
        results: [
          { ...profile, internalNote: "not part of the contract" },
          { id: "_2_1", userId: "u-2", userName: "sample.two" },
        ],
      },
    );

    expect(out.count).toBe(2);
    expect(out.users).toEqual([
      profile,
      { id: "_2_1", userId: "u-2", userName: "sample.two" },
    ]);
  });
});
