import { describe, expect, it } from "vitest";
import {
  assertSafeMcpAuthConfig,
  isAuthorizedMcpRequest,
  isLoopbackHost,
  resolveListenHost,
} from "../src/mcp-auth.js";

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

describe("resolveListenHost (TRUST_PROXY_TLS forces a loopback bind, CWE-319)", () => {
  it("returns the configured host unchanged when trustProxyTls is false", () => {
    expect(resolveListenHost("0.0.0.0", false)).toBe("0.0.0.0");
    expect(resolveListenHost("192.168.1.10", false)).toBe("192.168.1.10");
    expect(resolveListenHost("127.0.0.1", false)).toBe("127.0.0.1");
  });

  it("overrides any configured host to loopback when trustProxyTls is true", () => {
    // A configured HOST is otherwise still a second, unprotected path to
    // this plain-HTTP listener -- trustProxyTls only means anything if the
    // server actually becomes unreachable except via the trusted proxy.
    expect(resolveListenHost("0.0.0.0", true)).toBe("127.0.0.1");
    expect(resolveListenHost("192.168.1.10", true)).toBe("127.0.0.1");
    expect(resolveListenHost("mcp.example.com", true)).toBe("127.0.0.1");
  });
});

describe("assertSafeMcpAuthConfig (fail closed, CWE-306 + CWE-319)", () => {
  // `host` here is always the value that would come out of
  // resolveListenHost -- this function no longer has any notion of
  // "trust me, there's a proxy" as an alternative to an actual loopback
  // bind (see the resolveListenHost tests above for how that trust is
  // turned into a real bind override before this function ever runs).
  it("throws when bound beyond loopback with no MCP_API_KEY configured", () => {
    expect(() =>
      assertSafeMcpAuthConfig({ host: "0.0.0.0", mcpApiKey: null, tlsConfigured: false }),
    ).toThrow(/MCP_API_KEY is required/);
    expect(() =>
      assertSafeMcpAuthConfig({ host: "192.168.1.10", mcpApiKey: null, tlsConfigured: false }),
    ).toThrow(/MCP_API_KEY is required/);
  });

  it("throws when bound beyond loopback with MCP_API_KEY but no TLS configured", () => {
    expect(() =>
      assertSafeMcpAuthConfig({ host: "0.0.0.0", mcpApiKey: "secret-key", tlsConfigured: false }),
    ).toThrow(/plain HTTP/);
  });

  it("does not throw when bound beyond loopback with MCP_API_KEY and TLS configured", () => {
    expect(() =>
      assertSafeMcpAuthConfig({ host: "0.0.0.0", mcpApiKey: "secret-key", tlsConfigured: true }),
    ).not.toThrow();
  });

  it("does not throw when bound to loopback, even with no MCP_API_KEY or TLS", () => {
    expect(() =>
      assertSafeMcpAuthConfig({ host: "127.0.0.1", mcpApiKey: null, tlsConfigured: false }),
    ).not.toThrow();
    expect(() =>
      assertSafeMcpAuthConfig({ host: "localhost", mcpApiKey: null, tlsConfigured: false }),
    ).not.toThrow();
  });
});
