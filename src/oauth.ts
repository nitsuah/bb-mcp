/**
 * OAuth authorization-code flow helpers with PKCE and managed in-memory sessions.
 */
import axios from "axios";
import { createHash, randomBytes } from "crypto";
import { config } from "./config.js";

export interface OAuthPendingFlow {
  state: string;
  codeVerifier: string;
  createdAt: number;
  redirectUri: string;
}

export interface OAuthTokenSet {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  expiresAt: number;
  scope: string | null;
}

export interface OAuthSessionRecord {
  sessionId: string;
  state: string;
  createdAt: number;
  redirectUri: string;
  token: OAuthTokenSet;
}

interface OAuthTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
}

const AUTH_FLOW_TTL_MS = 10 * 60 * 1000;
const pendingFlows = new Map<string, OAuthPendingFlow>();
const oauthSessions = new Map<string, OAuthSessionRecord>();

function toBase64Url(value: Buffer): string {
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sha256Base64Url(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function now(): number {
  return Date.now();
}

function getAuthorizationEndpoint(): string {
  return `${config.bb.baseUrl}${config.oauth.authorizationPath}`;
}

function getTokenEndpoint(): string {
  return `${config.bb.baseUrl}${config.oauth.tokenPath}`;
}

function getRedirectUri(): string {
  return (
    config.oauth.redirectUri ??
    `${config.server.publicBaseUrl ?? `http://localhost:${config.server.port}`}/oauth/callback`
  );
}

function cleanupExpiredPendingFlows(): void {
  const cutoff = now() - AUTH_FLOW_TTL_MS;
  for (const [state, flow] of pendingFlows.entries()) {
    if (flow.createdAt < cutoff) {
      pendingFlows.delete(state);
    }
  }
}

function mapTokenResponse(data: OAuthTokenResponse): OAuthTokenSet {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    tokenType: data.token_type ?? "Bearer",
    expiresAt: now() + data.expires_in * 1000,
    scope: data.scope ?? null,
  };
}

export function isOAuthConfigured(): boolean {
  return Boolean(config.oauth.redirectUri || config.server.publicBaseUrl);
}

export function startAuthorizationCodeFlow(): {
  authorizationUrl: string;
  state: string;
  redirectUri: string;
} {
  cleanupExpiredPendingFlows();

  const state = toBase64Url(randomBytes(24));
  const codeVerifier = toBase64Url(randomBytes(48));
  const redirectUri = getRedirectUri();
  const codeChallenge = sha256Base64Url(codeVerifier);

  pendingFlows.set(state, {
    state,
    codeVerifier,
    createdAt: now(),
    redirectUri,
  });

  const url = new URL(getAuthorizationEndpoint());
  url.searchParams.set("client_id", config.bb.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  if (config.oauth.scope) {
    url.searchParams.set("scope", config.oauth.scope);
  }

  return {
    authorizationUrl: url.toString(),
    state,
    redirectUri,
  };
}

export async function completeAuthorizationCodeFlow(params: {
  code: string;
  state: string;
}): Promise<OAuthSessionRecord> {
  cleanupExpiredPendingFlows();

  const pendingFlow = pendingFlows.get(params.state);
  if (!pendingFlow) {
    throw new Error(
      "Invalid or expired OAuth state. Start the authorization flow again.",
    );
  }

  pendingFlows.delete(params.state);

  const form = new URLSearchParams();
  form.set("grant_type", "authorization_code");
  form.set("code", params.code);
  form.set("redirect_uri", pendingFlow.redirectUri);
  form.set("client_id", config.bb.clientId);
  form.set("code_verifier", pendingFlow.codeVerifier);

  if (config.bb.clientSecret) {
    form.set("client_secret", config.bb.clientSecret);
  }

  const response = await axios.post<OAuthTokenResponse>(
    getTokenEndpoint(),
    form.toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 10_000,
    },
  );

  const sessionId = toBase64Url(randomBytes(24));
  const record: OAuthSessionRecord = {
    sessionId,
    state: params.state,
    createdAt: now(),
    redirectUri: pendingFlow.redirectUri,
    token: mapTokenResponse(response.data),
  };

  oauthSessions.set(sessionId, record);
  return record;
}

export async function refreshOAuthSession(
  sessionId: string,
): Promise<OAuthSessionRecord> {
  const session = oauthSessions.get(sessionId);
  if (!session) {
    throw new Error(
      "OAuth session not found. Complete the authorization flow again.",
    );
  }

  if (!session.token.refreshToken) {
    throw new Error(
      "OAuth session does not include a refresh token. Re-authorize required.",
    );
  }

  const form = new URLSearchParams();
  form.set("grant_type", "refresh_token");
  form.set("refresh_token", session.token.refreshToken);
  form.set("client_id", config.bb.clientId);

  if (config.bb.clientSecret) {
    form.set("client_secret", config.bb.clientSecret);
  }

  const response = await axios.post<OAuthTokenResponse>(
    getTokenEndpoint(),
    form.toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 10_000,
    },
  );

  const refreshed: OAuthSessionRecord = {
    ...session,
    token: mapTokenResponse({
      ...response.data,
      refresh_token:
        response.data.refresh_token ?? session.token.refreshToken ?? undefined,
    }),
  };

  oauthSessions.set(sessionId, refreshed);
  return refreshed;
}

export function getOAuthSession(sessionId: string): OAuthSessionRecord | null {
  return oauthSessions.get(sessionId) ?? null;
}

export function __resetOAuthStateForTests(): void {
  pendingFlows.clear();
  oauthSessions.clear();
}
