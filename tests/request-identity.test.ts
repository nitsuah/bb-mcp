import { describe, expect, it } from "vitest";
import {
  getVerifiedIdentity,
  runWithVerifiedIdentity,
} from "../src/request-identity.js";

describe("verified request identity context", () => {
  it("exposes the authenticated principal only inside its async context", async () => {
    const identity = {
      userId: "institution-user-42",
      role: "instructor" as const,
      ferpa_authorized: true,
      clientApp: "institutional-agent",
    };

    expect(getVerifiedIdentity()).toBeUndefined();
    await runWithVerifiedIdentity(identity, async () => {
      await Promise.resolve();
      expect(getVerifiedIdentity()).toEqual(identity);
    });
    expect(getVerifiedIdentity()).toBeUndefined();
  });

  it("isolates concurrent request identities", async () => {
    const a = { userId: "student-a", role: "student" as const, ferpa_authorized: false };
    const b = { userId: "instructor-b", role: "instructor" as const, ferpa_authorized: false };

    const [seenA, seenB] = await Promise.all([
      runWithVerifiedIdentity(a, async () => {
        await Promise.resolve();
        return getVerifiedIdentity()?.userId;
      }),
      runWithVerifiedIdentity(b, async () => {
        await Promise.resolve();
        return getVerifiedIdentity()?.userId;
      }),
    ]);

    expect(seenA).toBe("student-a");
    expect(seenB).toBe("instructor-b");
  });
});
