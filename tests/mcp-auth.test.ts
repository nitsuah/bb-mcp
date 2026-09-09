import { describe, expect, it } from "vitest";
import { assertSafeMcpAuthConfig, isAuthorizedMcpRequest, isLoopbackHost } from "../src/mcp-auth.js";

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

describe("isLoopbackHost", () => {
  it("recognizes standard loopback hosts", () => {
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
    expect(isLoopbackHost("[::1]")).toBe(true);
  });

  it("rejects any non-loopback host", () => {
    expect(isLoopbackHost("0.0.0.0")).toBe(false);
    expect(isLoopbackHost("192.168.1.10")).toBe(false);
    expect(isLoopbackHost("mcp.example.com")).toBe(false);
    expect(isLoopbackHost("")).toBe(false);
  });
});

describe("assertSafeMcpAuthConfig (fail closed, CWE-306)", () => {
  it("throws when bound beyond loopback with no MCP_API_KEY configured", () => {
    expect(() => assertSafeMcpAuthConfig("0.0.0.0", null)).toThrow(/MCP_API_KEY is required/);
    expect(() => assertSafeMcpAuthConfig("192.168.1.10", null)).toThrow(/MCP_API_KEY is required/);
  });

  it("does not throw when bound beyond loopback with MCP_API_KEY configured", () => {
    expect(() => assertSafeMcpAuthConfig("0.0.0.0", "secret-key")).not.toThrow();
  });

  it("does not throw when bound to loopback, even with no MCP_API_KEY", () => {
    expect(() => assertSafeMcpAuthConfig("127.0.0.1", null)).not.toThrow();
    expect(() => assertSafeMcpAuthConfig("localhost", null)).not.toThrow();
  });
});
