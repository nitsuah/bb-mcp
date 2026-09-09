import { describe, expect, it } from "vitest";
import { isAuthorizedMcpRequest } from "../src/mcp-auth.js";

function reqWith(authorization?: string): { headers: Record<string, string | undefined> } {
  return { headers: { authorization } };
}

describe("isAuthorizedMcpRequest (transport-level auth gate, CWE-862)", () => {
  it("allows any request when mcpApiKey is unset (opt-in gate)", () => {
    expect(isAuthorizedMcpRequest(reqWith(undefined), null)).toBe(true);
    expect(isAuthorizedMcpRequest(reqWith("Bearer whatever"), null)).toBe(true);
  });

  it("allows a request with the correct bearer token", () => {
    expect(isAuthorizedMcpRequest(reqWith("Bearer secret-key"), "secret-key")).toBe(true);
  });

  it("rejects a missing Authorization header when a key is configured", () => {
    expect(isAuthorizedMcpRequest(reqWith(undefined), "secret-key")).toBe(false);
  });

  it("rejects a non-Bearer Authorization header", () => {
    expect(isAuthorizedMcpRequest(reqWith("Basic secret-key"), "secret-key")).toBe(false);
  });

  it("rejects an incorrect bearer token", () => {
    expect(isAuthorizedMcpRequest(reqWith("Bearer wrong-key"), "secret-key")).toBe(false);
  });

  it("rejects a token that differs only in length", () => {
    expect(isAuthorizedMcpRequest(reqWith("Bearer secret-ke"), "secret-key")).toBe(false);
    expect(isAuthorizedMcpRequest(reqWith("Bearer secret-keyy"), "secret-key")).toBe(false);
  });

  it("rejects an empty bearer token", () => {
    expect(isAuthorizedMcpRequest(reqWith("Bearer "), "secret-key")).toBe(false);
  });
});
