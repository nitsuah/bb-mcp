import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

beforeAll(() => {
  process.env.BB_CLIENT_ID ??= "test-client-id";
  process.env.BB_CLIENT_SECRET ??= "test-client-secret";
});

const bbClientMock = {
  getCourses: vi.fn(),
  getCourse: vi.fn(),
  getAssignments: vi.fn(),
};

vi.mock("../src/auth.js", () => ({
  parseIdentity: (raw: unknown) => raw,
  checkAuthorization: vi.fn(),
  checkCourseMemberEntitlement: vi.fn(),
}));
vi.mock("../src/bb-client.js", () => ({ bbClient: bbClientMock }));

type Item = { id: string; course: string | null; courseId: string | null };
type ToolResult = { content: Array<{ text?: unknown }> };
type Assignment = { id: string; title: string; due: string };

const parse = (result: ToolResult): Item[] =>
  JSON.parse(String(result.content[0].text)) as Item[];

beforeEach(() => {
  vi.clearAllMocks();
});

const NOW = Date.parse("2026-05-24T00:00:00.000Z");
const DAY = 86_400_000;
const caller = { userId: "u1", role: "student" };
const dueAt = (id: string, offsetMs: number): Assignment => ({
  id,
  title: id,
  due: new Date(NOW + offsetMs).toISOString(),
});

describe("get_upcoming_assignments date window", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    bbClientMock.getCourses.mockResolvedValue([
      { id: "a", courseId: "A", name: "Course A" },
    ]);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function run(input: Record<string, unknown>): Promise<Item[]> {
    const { getUpcomingAssignmentsHandler, GetUpcomingAssignmentsInput } =
      await import("../src/tools/student.js");
    return parse(
      await getUpcomingAssignmentsHandler(
        GetUpcomingAssignmentsInput.parse({
          caller_identity: caller,
          ...input,
        }),
      ),
    );
  }

  it.each([
    [{}, 14],
    [{ daysAhead: 1 }, 1],
    [{ daysAhead: 90 }, 90],
  ])("includes both edges of the window for %j", async (input, days) => {
    bbClientMock.getAssignments.mockResolvedValue([
      dueAt("after", days * DAY + 1),
      dueAt("end", days * DAY),
      dueAt("start", 0),
      dueAt("before", -1),
    ]);

    const ids = (await run(input)).map((a) => a.id);

    expect(ids).toEqual(["start", "end"]);
  });

  it.each([0, 91, 1.5])("rejects daysAhead=%s", async (daysAhead) => {
    await expect(run({ daysAhead })).rejects.toThrow();
  });

  it("queries only the requested course when courseId is given", async () => {
    bbClientMock.getCourse.mockResolvedValue({
      id: "b",
      courseId: "B",
      name: "Course B",
    });
    bbClientMock.getAssignments.mockResolvedValue([dueAt("one", DAY)]);

    const items = await run({ courseId: "b" });

    expect(bbClientMock.getCourses).not.toHaveBeenCalled();
    expect(bbClientMock.getCourse).toHaveBeenCalledWith("b");
    expect(bbClientMock.getAssignments.mock.calls).toEqual([["b"]]);
    expect(items[0]).toMatchObject({ course: "Course B", courseId: "B" });
  });

  it("orders by due date across courses and keeps ties in source order", async () => {
    bbClientMock.getCourses.mockResolvedValue([
      { id: "a", courseId: "A", name: "Course A" },
      { id: "b", courseId: "B", name: "Course B" },
    ]);
    bbClientMock.getAssignments
      .mockResolvedValueOnce([dueAt("a-late", 3 * DAY), dueAt("z-tie", DAY)])
      .mockResolvedValueOnce([dueAt("b-tie", DAY), dueAt("b-mid", 2 * DAY)]);

    const ids = (await run({})).map((a) => a.id);

    expect(ids).toEqual(["z-tie", "b-tie", "b-mid", "a-late"]);
  });

  it("returns an empty list when nothing is due", async () => {
    bbClientMock.getAssignments.mockResolvedValue([{ id: "x", title: "x" }]);

    expect(await run({})).toEqual([]);
  });
});
