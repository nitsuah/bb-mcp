/**
 * Provider-neutral OIDC access-token verification.
 *
 * Accepts signed RS256 JWT access tokens issued by any OIDC provider whose
 * issuer, audience and JWKS endpoint are configured by the operator. It does
 * not perform browser login and deliberately does not reuse the Blackboard
 * application OAuth session flow.
 */
import { createPublicKey, verify as verifySignature } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { TLSSocket } from "node:tls";
import type {
  VerifiedCallerIdentity,
  VerifiedRole,
} from "./request-identity.js";

export type MtlsMode = "disabled" | "optional" | "required" | "trusted-proxy";

export interface OidcAuthConfig {
  issuer: string | null;
  audience: string | null;
  jwksUri: string | null;
  userIdClaim: string;
  roleClaim: string;
  ferpaClaim: string;
  roleMap: Readonly<Record<string, VerifiedRole>>;
  mtlsMode: MtlsMode;
  trustProxyTls: boolean;
}

interface JwtHeader {
  alg?: string;
  kid?: string;
  crit?: unknown;
  b64?: boolean;
}

interface JwtClaims {
  iss?: unknown;
  aud?: unknown;
  sub?: unknown;
  exp?: unknown;
  nbf?: unknown;
  iat?: unknown;
  [claim: string]: unknown;
}

interface JwkSet {
  keys?: Array<
    Record<string, unknown> & {
      kid?: string;
      kty?: string;
      use?: string;
      alg?: string;
    }
  >;
}

interface CachedJwks {
  uri: string;
  expiresAt: number;
  keys: JwkSet["keys"];
}

let cachedJwks: CachedJwks | undefined;
let jwksFetchInFlight: Promise<JwkSet["keys"]> | undefined;
let lastForcedRefreshAt = 0;
const JWKS_CACHE_MS = 5 * 60_000;
const JWKS_FORCED_REFRESH_COOLDOWN_MS = 30_000;

/** Signals an identity-provider/JWKS availability problem, not an invalid token. */
export class OidcProviderUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OidcProviderUnavailableError";
  }
}
const CLOCK_SKEW_SECONDS = 60;

function decodeJsonSegment<T>(segment: string, name: string): T {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
  } catch {
    throw new Error(`Invalid OIDC token: malformed ${name}.`);
  }
}

function claimAtPath(claims: JwtClaims, path: string): unknown {
  if (Object.hasOwn(claims, path)) return claims[path];
  return path.split(".").reduce<unknown>((value, part) => {
    if (!value || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[part];
  }, claims);
}

function audienceMatches(aud: unknown, expected: string): boolean {
  return aud === expected || (Array.isArray(aud) && aud.includes(expected));
}

async function getJwks(uri: string, forceRefresh = false): Promise<JwkSet["keys"]> {
  if (
    !forceRefresh &&
    cachedJwks &&
    cachedJwks.uri === uri &&
    cachedJwks.expiresAt > Date.now()
  ) {
    return cachedJwks.keys;
  }

  // Coalesce concurrent cache misses/refreshes so bursts of requests cannot
  // multiply outbound calls to the identity provider.
  if (jwksFetchInFlight) return jwksFetchInFlight;

  jwksFetchInFlight = (async () => {
    let response: Response;
    try {
      response = await fetch(uri, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(5_000),
      });
    } catch (error) {
      throw new OidcProviderUnavailableError(
        "Unable to retrieve OIDC signing keys.",
        { cause: error },
      );
    }

    if (!response.ok) {
      throw new OidcProviderUnavailableError(
        `OIDC signing-key endpoint returned HTTP ${response.status}.`,
      );
    }

    let data: JwkSet;
    try {
      data = (await response.json()) as JwkSet;
    } catch (error) {
      throw new OidcProviderUnavailableError(
        "OIDC signing-key endpoint returned invalid JSON.",
        { cause: error },
      );
    }
    if (!Array.isArray(data.keys) || data.keys.length === 0) {
      throw new OidcProviderUnavailableError(
        "OIDC signing-key endpoint returned no usable keys.",
      );
    }

    cachedJwks = {
      uri,
      keys: data.keys,
      expiresAt: Date.now() + JWKS_CACHE_MS,
    };
    return data.keys;
  })();

  try {
    return await jwksFetchInFlight;
  } finally {
    jwksFetchInFlight = undefined;
  }
}

function getBearerToken(req: Pick<IncomingMessage, "headers">): string {
  const header = req.headers.authorization;
  const match =
    typeof header === "string" ? /^Bearer ([^\s]+)$/i.exec(header) : null;
  if (!match) {
    throw new Error("A valid OIDC bearer access token is required.");
  }
  return match[1];
}

function assertMtls(req: IncomingMessage, config: OidcAuthConfig): void {
  if (config.mtlsMode === "disabled") return;

  if (config.mtlsMode === "optional") {
    const socket = req.socket as TLSSocket;
    if (
      socket.encrypted &&
      socket.getPeerCertificate().raw &&
      !socket.authorized
    ) {
      throw new Error("The presented client certificate is not trusted.");
    }
    return;
  }

  if (config.mtlsMode === "trusted-proxy") {
    // TRUST_PROXY_TLS forces the listener to loopback. This header is safe to
    // consume only in that mode, where an external client cannot reach the
    // process directly and the proxy must strip/rewrite the header.
    if (!config.trustProxyTls) {
      throw new Error(
        "OIDC_MTLS_MODE=trusted-proxy requires TRUST_PROXY_TLS=true.",
      );
    }
    if (req.headers["x-client-cert-verified"] !== "SUCCESS") {
      throw new Error(
        "A client certificate verified by the trusted proxy is required.",
      );
    }
    return;
  }

  const socket = req.socket as TLSSocket;
  if (!socket.encrypted || !socket.authorized) {
    throw new Error("A valid client certificate is required (mTLS).");
  }
}

export function isOidcEnabled(config: OidcAuthConfig): boolean {
  return Boolean(config.issuer || config.audience || config.jwksUri);
}

/**
 * Verify the access token and derive identity only from signed claims.
 * Never accepts caller_identity values as a fallback when OIDC is enabled.
 */
export async function authenticateOidcRequest(
  req: IncomingMessage,
  config: OidcAuthConfig,
): Promise<VerifiedCallerIdentity> {
  if (!config.issuer || !config.audience || !config.jwksUri) {
    throw new Error(
      "OIDC requires OIDC_ISSUER, OIDC_AUDIENCE and OIDC_JWKS_URI.",
    );
  }

  assertMtls(req, config);
  const token = getBearerToken(req);
  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new Error("Invalid OIDC token: expected a signed JWT.");
  }

  const [encodedHeader, encodedClaims, encodedSignature] = segments;
  const header = decodeJsonSegment<JwtHeader>(encodedHeader, "header");
  const claims = decodeJsonSegment<JwtClaims>(encodedClaims, "claims");

  // Explicit algorithm allowlist prevents alg=none and key-type confusion.
  if (
    header.alg !== "RS256" ||
    !header.kid ||
    header.crit !== undefined ||
    header.b64 === false
  ) {
    throw new Error(
      "Unsupported OIDC token signing algorithm or missing key id.",
    );
  }

  if (claims.iss !== config.issuer) {
    throw new Error("OIDC token issuer mismatch.");
  }
  if (!audienceMatches(claims.aud, config.audience)) {
    throw new Error("OIDC token audience mismatch.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    typeof claims.exp !== "number" ||
    claims.exp <= now - CLOCK_SKEW_SECONDS
  ) {
    throw new Error("OIDC token is expired or has no valid expiration.");
  }
  if (typeof claims.nbf === "number" && claims.nbf > now + CLOCK_SKEW_SECONDS) {
    throw new Error("OIDC token is not yet valid.");
  }
  if (typeof claims.iat === "number" && claims.iat > now + CLOCK_SKEW_SECONDS) {
    throw new Error("OIDC token was issued in the future.");
  }

  const keys = await getJwks(config.jwksUri);
  const isSigningKey = (key: NonNullable<JwkSet["keys"]>[number]) =>
    key.kid === header.kid &&
    key.kty === "RSA" &&
    (!key.use || key.use === "sig") &&
    (!key.alg || key.alg === "RS256");

  let jwk = keys?.find(isSigningKey);
  if (
    !jwk &&
    Date.now() - lastForcedRefreshAt >= JWKS_FORCED_REFRESH_COOLDOWN_MS
  ) {
    // Allow key rotation, but cap forced refreshes so random kid values cannot
    // evict the cache and turn each unauthenticated request into outbound I/O.
    lastForcedRefreshAt = Date.now();
    cachedJwks = undefined;
    const refreshed = await getJwks(config.jwksUri, true);
    jwk = refreshed?.find(isSigningKey);
  }
  if (!jwk) {
    throw new Error("OIDC signing key was not found in the configured JWKS.");
  }

  const publicKey = createPublicKey({
    key: jwk as JsonWebKey,
    format: "jwk",
  });
  if (
    !verifySignature(
      "RSA-SHA256",
      Buffer.from(`${encodedHeader}.${encodedClaims}`),
      publicKey,
      Buffer.from(encodedSignature, "base64url"),
    )
  ) {
    throw new Error("OIDC token signature is invalid.");
  }

  if (typeof claims.sub !== "string" || claims.sub.length === 0) {
    throw new Error("OIDC token must include a non-empty subject.");
  }

  const userIdClaim = claimAtPath(claims, config.userIdClaim);
  if (typeof userIdClaim !== "string" || userIdClaim.trim().length === 0) {
    throw new Error(
      `OIDC token is missing the configured user id claim "${config.userIdClaim}".`,
    );
  }

  const rawRole = claimAtPath(claims, config.roleClaim);
  const roleValues = Array.isArray(rawRole) ? rawRole : [rawRole];
  const mappedRoles = roleValues
    .filter((value): value is string => typeof value === "string")
    .map(
      (value) => config.roleMap[value] ?? config.roleMap[value.toLowerCase()],
    )
    .filter((role): role is VerifiedRole => Boolean(role));
  const distinctRoles = [...new Set(mappedRoles)];
  if (distinctRoles.length !== 1) {
    throw new Error(
      "OIDC role claim must map to exactly one configured bb-mcp role.",
    );
  }

  const ferpaClaim = claimAtPath(claims, config.ferpaClaim);
  const clientApp =
    typeof claims.azp === "string"
      ? claims.azp
      : typeof claims.client_id === "string"
        ? claims.client_id
        : undefined;

  return {
    userId: userIdClaim,
    role: distinctRoles[0],
    // Only a server-verified signed claim can satisfy the FERPA flag.
    ferpa_authorized: ferpaClaim === true,
    clientApp,
  };
}

export function __resetOidcJwksCacheForTests(): void {
  cachedJwks = undefined;
  jwksFetchInFlight = undefined;
  lastForcedRefreshAt = 0;
}
