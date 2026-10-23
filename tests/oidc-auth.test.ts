import { generateKeyPairSync, sign } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  __resetOidcJwksCacheForTests,
  authenticateOidcRequest,
  type OidcAuthConfig,
  OidcProviderUnavailableError,
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

function token(
  claimOverrides: Record<string, unknown> = {},
  key = privateKey,
  headerOverrides: Record<string, unknown> = {},
): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "RS256", kid: "test-key", typ: "JWT", ...headerOverrides });
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

function request(
  jwt: string,
  headers: Record<string, string> = {},
  socket: Record<string, unknown> = {},
): IncomingMessage {
  return {
    headers: { authorization: `Bearer ${jwt}`, ...headers },
    socket,
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

  it("rejects a missing or non-numeric expiration", async () => {
    await expect(
      authenticateOidcRequest(request(token({ exp: undefined })), config),
    ).rejects.toThrow(/no valid expiration/);
    await expect(
      authenticateOidcRequest(request(token({ exp: "tomorrow" })), config),
    ).rejects.toThrow(/no valid expiration/);
  });

  it("rejects tokens that are not yet valid or issued in the future", async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    await expect(
      authenticateOidcRequest(request(token({ nbf: future })), config),
    ).rejects.toThrow(/not yet valid/);
    await expect(
      authenticateOidcRequest(request(token({ iat: future })), config),
    ).rejects.toThrow(/issued in the future/);
  });

  it("accepts an audience array containing the configured audience", async () => {
    const identity = await authenticateOidcRequest(
      request(token({ aud: ["another-api", config.audience] })),
      config,
    );
    expect(identity.userId).toBe("user-123");
  });

  it("rejects critical and unencoded-payload JWT headers", async () => {
    await expect(
      authenticateOidcRequest(request(token({}, privateKey, { crit: ["b64"] })), config),
    ).rejects.toThrow(/Unsupported OIDC token signing algorithm/);
    await expect(
      authenticateOidcRequest(request(token({}, privateKey, { b64: false })), config),
    ).rejects.toThrow(/Unsupported OIDC token signing algorithm/);
  });

  it("rejects a missing subject", async () => {
    await expect(
      authenticateOidcRequest(request(token({ sub: undefined })), config),
    ).rejects.toThrow(/non-empty subject/);
  });

  it("supports provider claim names containing dots", async () => {
    const namespacedConfig = {
      ...config,
      roleClaim: "https://claims.example.test/roles",
    };
    const identity = await authenticateOidcRequest(
      request(token({ "https://claims.example.test/roles": "instructor" })),
      namespacedConfig,
    );
    expect(identity.role).toBe("instructor");
  });

  it("rejects inherited object properties as role mappings", async () => {
    await expect(
      authenticateOidcRequest(request(token({ role: "toString" })), config),
    ).rejects.toThrow(/exactly one configured bb-mcp role/);
    await expect(
      authenticateOidcRequest(
        request(token({ role: ["student", "instructor"] })),
        config,
      ),
    ).rejects.toThrow(/exactly one configured bb-mcp role/);
  });

  it("limits unknown-kid refreshes while preserving known signing keys", async () => {
    await authenticateOidcRequest(request(token()), config);
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(
      authenticateOidcRequest(request(token({}, privateKey, { kid: "unknown-1" })), config),
    ).rejects.toThrow(/signing key was not found/);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await expect(
      authenticateOidcRequest(request(token({}, privateKey, { kid: "unknown-2" })), config),
    ).rejects.toThrow(/signing key was not found/);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await expect(authenticateOidcRequest(request(token()), config)).resolves.toMatchObject({
      userId: "user-123",
      role: "student",
    });
  });

  it("classifies JWKS HTTP and payload failures as provider outages", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as Response);
    await expect(
      authenticateOidcRequest(request(token()), config),
    ).rejects.toBeInstanceOf(OidcProviderUnavailableError);

    __resetOidcJwksCacheForTests();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ keys: [] }),
    } as Response);
    await expect(
      authenticateOidcRequest(request(token()), config),
    ).rejects.toBeInstanceOf(OidcProviderUnavailableError);
  });

  it("enforces each configured mTLS mode", async () => {
    const required = { ...config, mtlsMode: "required" as const };
    await expect(
      authenticateOidcRequest(request(token()), required),
    ).rejects.toThrow(/client certificate is required/);

    const trustedProxy = { ...config, mtlsMode: "trusted-proxy" as const, trustProxyTls: true };
    await expect(
      authenticateOidcRequest(request(token()), trustedProxy),
    ).rejects.toThrow(/verified by the trusted proxy/);
    await expect(
      authenticateOidcRequest(
        request(token(), { "x-client-cert-verified": "SUCCESS" }),
        trustedProxy,
      ),
    ).resolves.toMatchObject({ userId: "user-123" });

    const optional = { ...config, mtlsMode: "optional" as const };
    await expect(
      authenticateOidcRequest(
        request(token(), {}, {
          encrypted: true,
          authorized: false,
          getPeerCertificate: () => ({ raw: Buffer.from("untrusted") }),
        }),
        optional,
      ),
    ).rejects.toThrow(/client certificate is not trusted/);
    await expect(
      authenticateOidcRequest(request(token()), optional),
    ).resolves.toMatchObject({ userId: "user-123" });
  });

  it("rejects missing bearer credentials", async () => {
    await expect(authenticateOidcRequest(
      { headers: {}, socket: {} } as unknown as IncomingMessage,
      config,
    )).rejects.toThrow(/bearer access token is required/);
  });
});
