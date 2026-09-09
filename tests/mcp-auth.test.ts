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

describe("assertSafeMcpAuthConfig (fail closed, CWE-306 + CWE-319)", () => {
  const base = { tlsConfigured: false, trustProxyTls: false };

  it("throws when bound beyond loopback with no MCP_API_KEY configured", () => {
    expect(() =>
      assertSafeMcpAuthConfig({ host: "0.0.0.0", mcpApiKey: null, ...base }),
    ).toThrow(/MCP_API_KEY is required/);
    expect(() =>
      assertSafeMcpAuthConfig({ host: "192.168.1.10", mcpApiKey: null, ...base }),
    ).toThrow(/MCP_API_KEY is required/);
  });

  it("throws when bound beyond loopback with MCP_API_KEY but no TLS and no trusted proxy", () => {
    expect(() =>
      assertSafeMcpAuthConfig({ host: "0.0.0.0", mcpApiKey: "secret-key", ...base }),
    ).toThrow(/plain HTTP/);
  });

  it("does not throw when bound beyond loopback with MCP_API_KEY and TLS configured", () => {
    expect(() =>
      assertSafeMcpAuthConfig({
        host: "0.0.0.0",
        mcpApiKey: "secret-key",
        tlsConfigured: true,
        trustProxyTls: false,
      }),
    ).not.toThrow();
  });

  it("does not throw when bound beyond loopback with MCP_API_KEY and an explicitly trusted proxy", () => {
    expect(() =>
      assertSafeMcpAuthConfig({
        host: "0.0.0.0",
        mcpApiKey: "secret-key",
        tlsConfigured: false,
        trustProxyTls: true,
      }),
    ).not.toThrow();
  });

  it("does not throw when bound to loopback, even with no MCP_API_KEY, TLS, or trusted proxy", () => {
    expect(() =>
      assertSafeMcpAuthConfig({ host: "127.0.0.1", mcpApiKey: null, ...base }),
    ).not.toThrow();
    expect(() =>
      assertSafeMcpAuthConfig({ host: "localhost", mcpApiKey: null, ...base }),
    ).not.toThrow();
  });
});
