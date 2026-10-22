import { generateKeyPairSync, sign } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  __resetOidcJwksCacheForTests,
  authenticateOidcRequest,
  type OidcAuthConfig,
} from "../src/oidc-auth.js";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" }) as Record<string, unknown>;
jwk.kid = "test-key";
jwk.use = "sig";
jwk.alg = "RS256";

const config: OidcAuthConfig = {
  issuer: "https://issuer.example.test/",
  audience: "bb-mcp-api",
  jwksUri: "https://issuer.example.test/.well-known/jwks.json",
  userIdClaim: "sub",
  roleClaim: "role",
  ferpaClaim: "ferpa_authorized",
  roleMap: {
    student: "student",
    instructor: "instructor",
    admin: "admin",
    parent: "parent",
  },
  mtlsMode: "disabled",
  trustProxyTls: false,
};

function token(claimOverrides: Record<string, unknown> = {}, key = privateKey): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "RS256", kid: "test-key", typ: "JWT" });
  const claims = encode({
    iss: config.issuer,
    aud: config.audience,
    sub: "user-123",
    role: "student",
    ferpa_authorized: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
    ...claimOverrides,
  });
  const input = `${header}.${claims}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), key).toString("base64url")}`;
}

function request(jwt: string): IncomingMessage {
  return {
    headers: { authorization: `Bearer ${jwt}` },
    socket: {},
  } as unknown as IncomingMessage;
}

beforeAll(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ keys: [jwk] }),
  }));
});

afterEach(() => {
  __resetOidcJwksCacheForTests();
  vi.clearAllMocks();
});

describe("authenticateOidcRequest", () => {
  it("derives the principal from a valid signed token", async () => {
    const identity = await authenticateOidcRequest(request(token()), config);
    expect(identity).toEqual({
      userId: "user-123",
      role: "student",
      ferpa_authorized: false,
      clientApp: undefined,
    });
  });

  it("allows FERPA only when the signed token claim is true", async () => {
    const identity = await authenticateOidcRequest(
      request(token({ ferpa_authorized: true })),
      config,
    );
    expect(identity.ferpa_authorized).toBe(true);
  });

  it("rejects an incorrect issuer", async () => {
    await expect(authenticateOidcRequest(
      request(token({ iss: "https://attacker.example.test/" })),
      config,
    )).rejects.toThrow(/issuer mismatch/);
  });

  it("rejects an incorrect audience", async () => {
    await expect(authenticateOidcRequest(
      request(token({ aud: "another-api" })),
      config,
    )).rejects.toThrow(/audience mismatch/);
  });

  it("rejects expired tokens", async () => {
    await expect(authenticateOidcRequest(
      request(token({ exp: Math.floor(Date.now() / 1000) - 600 })),
      config,
    )).rejects.toThrow(/expired/);
  });

  it("rejects unsupported algorithms", async () => {
    const parts = token().split(".");
    const header = Buffer.from(JSON.stringify({ alg: "none", kid: "test-key" })).toString("base64url");
    await expect(authenticateOidcRequest(
      request(`${header}.${parts[1]}.${parts[2]}`),
      config,
    )).rejects.toThrow(/Unsupported OIDC token signing algorithm/);
  });

  it("rejects a token whose signature was made by an untrusted key", async () => {
    const attacker = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
    await expect(authenticateOidcRequest(request(token({}, attacker)), config))
      .rejects.toThrow(/signature is invalid/);
  });

  it("rejects role claims that do not map to exactly one allowed role", async () => {
    await expect(authenticateOidcRequest(
      request(token({ role: "superuser" })),
      config,
    )).rejects.toThrow(/exactly one configured bb-mcp role/);
  });

  it("rejects missing bearer credentials", async () => {
    await expect(authenticateOidcRequest(
      { headers: {}, socket: {} } as unknown as IncomingMessage,
      config,
    )).rejects.toThrow(/bearer access token is required/);
  });
});
