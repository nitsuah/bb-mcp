import { describe, expect, it } from "vitest";
import { scrubMcpToolResult, scrubToolOutput } from "../src/output-scrub.js";

describe("scrubToolOutput", () => {
  it("masks direct email fields regardless of nesting depth", () => {
    const input = {
      users: [
        { userId: "u1", name: "Alice Doe", emailAddress: "alice@example.edu" },
        { userId: "u2", name: "Bob Roe", email: "bob@example.edu" },
      ],
    };

    const scrubbed = scrubToolOutput(input) as typeof input;
    expect(scrubbed.users[0].emailAddress).toBe("[redacted-email]");
    expect((scrubbed.users[1] as any).email).toBe("[redacted-email]");
    // Names are left intact — the RBAC/FERPA gate already authorized this response.
    expect(scrubbed.users[0].name).toBe("Alice Doe");
  });

  it("strips embedded emails from any string value, keyed or not", () => {
    const input = { title: "Contact prof@example.edu for help" };
    const scrubbed = scrubToolOutput(input);
    expect(scrubbed.title).toBe("Contact [redacted-email] for help");
  });

  it("leaves long non-email tokens in free text untouched (no false-positive redaction)", () => {
    // A discussion post, feedback comment, or announcement can legitimately
    // contain a long unbroken token (a pasted hash, a URL, even a long
    // word) that is not PII. Mangling it would be data corruption, not a
    // privacy fix — see output-scrub.ts module docs for why the long-ID
    // pattern used for log scrubbing is deliberately NOT reused here.
    const input = {
      feedback: "See attempt 7f3e9a1b2c3d4e5f6a7b for details",
      body: "a".repeat(300),
    };
    const scrubbed = scrubToolOutput(input);
    expect(scrubbed).toEqual(input);
  });

  it("leaves opaque structural identifiers used for tool chaining untouched", () => {
    const input = {
      userId: "6f1e2d3c4b5a69788796",
      courseId: "_123456_1",
      columnId: "_998877_1",
    };
    const scrubbed = scrubToolOutput(input);
    expect(scrubbed).toEqual(input);
  });

  it("scrubs arrays and deeply nested objects", () => {
    const input = {
      results: [
        { studentComments: "email me at kid@school.edu please" },
        { nested: { instructorNotes: "cc jane@school.edu" } },
      ],
    };
    const scrubbed = scrubToolOutput(input) as any;
    expect(scrubbed.results[0].studentComments).toBe(
      "email me at [redacted-email] please",
    );
    expect(scrubbed.results[1].nested.instructorNotes).toBe(
      "cc [redacted-email]",
    );
  });

  it("passes through non-object primitives unchanged", () => {
    expect(scrubToolOutput(42)).toBe(42);
    expect(scrubToolOutput(null)).toBe(null);
    expect(scrubToolOutput(true)).toBe(true);
  });
});

describe("scrubMcpToolResult", () => {
  it("scrubs the JSON payload inside an MCP tool content block", () => {
    const result = {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            users: [{ userId: "u1", emailAddress: "leak@example.edu" }],
          }),
        },
      ],
    };

    const scrubbed = scrubMcpToolResult(result);
    const parsed = JSON.parse(scrubbed.content[0].text);
    expect(parsed.users[0].emailAddress).toBe("[redacted-email]");
    expect(scrubbed.content[0].text).not.toContain("leak@example.edu");
  });

  it("scrubs plain-text (non-JSON) content blocks too", () => {
    const result = {
      content: [{ type: "text", text: "Reach out to help@example.edu" }],
    };
    const scrubbed = scrubMcpToolResult(result);
    expect(scrubbed.content[0].text).toBe("Reach out to [redacted-email]");
  });

  it("leaves non-MCP-shaped values untouched", () => {
    expect(scrubMcpToolResult("hello")).toBe("hello");
    expect(scrubMcpToolResult(null)).toBe(null);
    expect(scrubMcpToolResult({ foo: "bar" })).toEqual({ foo: "bar" });
  });
});
