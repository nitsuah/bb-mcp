import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.BB_CLIENT_ID ??= "test-client-id";
  process.env.BB_CLIENT_SECRET ??= "test-client-secret";
});

const bbClientMock = {
  getCourses: vi.fn(),
  getCourse: vi.fn(),
  getCourseContent: vi.fn(),
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

async function search(content: unknown[]) {
  bbClientMock.getCourses.mockResolvedValue([
    { id: "c1", courseId: "BIO-101", name: "Biology" },
  ]);
  bbClientMock.getCourseContent.mockResolvedValue(content);
  const { searchCourseMaterialsHandler } =
    await import("../src/tools/shared.js");
  return parse(
    await searchCourseMaterialsHandler({
      caller_identity: { userId: "u1", role: "student" },
      query: "Mitosis",
    }),
  );
}

// Position-coded filler so a shifted slice produces a different string.
const filler = (length: number) =>
  Array.from({ length }, (_, i) => String(i % 10)).join("");

describe("search_course_materials snippets", () => {
  it("reports course metadata and a null snippet for a title-only match without a body", async () => {
    const out = await search([
      { id: "i1", title: "Mitosis intro", contentHandler: { id: "doc" } },
    ]);

    expect(out.count).toBe(1);
    expect(out.results[0]).toEqual({
      courseId: "BIO-101",
      courseName: "Biology",
      id: "i1",
      title: "Mitosis intro",
      type: "doc",
      bodySnippet: null,
    });
  });

  it("snippets the start of the body when only the title matches", async () => {
    const body = filler(300);
    const out = await search([{ id: "i1", title: "mitosis", body }]);

    expect(out.results[0].bodySnippet).toBe(`...${body.slice(0, 149)}...`);
    expect(out.results[0].type).toBe("unknown");
  });

  it("windows 50 characters before and 150 from a mid-body match", async () => {
    const body = `${filler(100)}MITOSIS${filler(300)}`;
    const out = await search([{ id: "i1", title: "Cells", body }]);

    expect(out.results[0].bodySnippet).toBe(`...${body.slice(50, 250)}...`);
  });

  it("clamps the slice start when the match is near the beginning", async () => {
    const body = `ab mitosis ${filler(300)}`;
    const out = await search([{ id: "i1", title: "Cells", body }]);

    expect(out.results[0].bodySnippet).toBe(`...${body.slice(0, 153)}...`);
  });

  it("stops at the end of the body when the match is near the end", async () => {
    const body = `${filler(200)} mitosis`;
    const out = await search([{ id: "i1", title: "Cells", body }]);

    expect(out.results[0].bodySnippet).toBe(`...${body.slice(151)}...`);
  });

  it("returns a zero count when nothing matches", async () => {
    const out = await search([
      { id: "i1", title: "Cells", body: "Membranes" },
      { id: "i2", title: "Genes" },
    ]);

    expect(out).toEqual({ query: "Mitosis", count: 0, results: [] });
  });
});
