import { describe, it, expect, vi, beforeEach } from "vitest";

const { authenticate, probeConnectivity } = vi.hoisted(() => {
  // cli.ts pulls in config.ts, which only needs these to be set.
  process.env.BB_CLIENT_ID ??= "test-client-id";
  process.env.BB_CLIENT_SECRET ??= "test-client-secret";
  return { authenticate: vi.fn(), probeConnectivity: vi.fn() };
});

vi.mock("../src/bb-client.js", () => ({
  bbClient: { authenticate, probeConnectivity },
}));

const { runBlackboardProbe } = await import("../src/cli.js");

describe("runBlackboardProbe", () => {
  beforeEach(() => {
    authenticate.mockReset().mockResolvedValue(undefined);
    probeConnectivity.mockReset().mockResolvedValue(1);
  });

  it("reports both steps ok when both succeed", async () => {
    const { blackboard } = await runBlackboardProbe();
    expect(blackboard).toMatchObject({
      oauth: true,
      api: true,
      sampleCourseCount: 1,
    });
  });

  it("does not report OAuth ok when the host cannot be reached", async () => {
    authenticate.mockRejectedValue(
      new Error("getaddrinfo ENOTFOUND blackboard.example.edu"),
    );
    const { blackboard } = await runBlackboardProbe();
    expect(blackboard).toMatchObject({ oauth: false, api: false });
    expect(blackboard.message).toContain("ENOTFOUND");
    expect(probeConnectivity).not.toHaveBeenCalled();
  });

  it("keeps OAuth ok when only the API request fails, even with a 401", async () => {
    probeConnectivity.mockRejectedValue(new Error("unauthorized (HTTP 401)"));
    const { blackboard } = await runBlackboardProbe();
    expect(blackboard).toMatchObject({ oauth: true, api: false });
  });
});
