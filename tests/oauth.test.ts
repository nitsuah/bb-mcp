import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    create: vi.fn(() => ({
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));

beforeEach(() => {
  process.env.BB_CLIENT_ID = 'test-client-id';
  process.env.BB_CLIENT_SECRET = 'test-client-secret';
  process.env.BB_BASE_URL = 'https://blackboard.example.edu';
  process.env.PUBLIC_BASE_URL = 'https://mcp.example.edu';
  delete process.env.BB_OAUTH_REDIRECT_URI;
  delete process.env.BB_OAUTH_SCOPE;
});

afterEach(async () => {
  const { __resetOAuthStateForTests } = await import('../src/oauth.js');
  __resetOAuthStateForTests();
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe('oauth authorization code flow', () => {
  it('builds a PKCE authorization URL and stores pending state', async () => {
    const { startAuthorizationCodeFlow } = await import('../src/oauth.js');

    const flow = startAuthorizationCodeFlow();
    const authorizationUrl = new URL(flow.authorizationUrl);

    expect(authorizationUrl.origin).toBe('https://blackboard.example.edu');
    expect(authorizationUrl.pathname).toBe('/learn/api/public/v1/oauth2/authorizationcode');
    expect(authorizationUrl.searchParams.get('client_id')).toBe('test-client-id');
    expect(authorizationUrl.searchParams.get('response_type')).toBe('code');
    expect(authorizationUrl.searchParams.get('redirect_uri')).toBe('https://mcp.example.edu/oauth/callback');
    expect(authorizationUrl.searchParams.get('state')).toBe(flow.state);
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorizationUrl.searchParams.get('code_challenge')).toBeTruthy();
  });

  it('exchanges the code for tokens and stores an oauth session', async () => {
    const axios = (await import('axios')).default as { post: ReturnType<typeof vi.fn> };
    axios.post.mockResolvedValue({
      data: {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-123',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'read',
      },
    });

    const {
      completeAuthorizationCodeFlow,
      getOAuthSession,
      startAuthorizationCodeFlow,
    } = await import('../src/oauth.js');

    const flow = startAuthorizationCodeFlow();
    const session = await completeAuthorizationCodeFlow({
      code: 'auth-code-123',
      state: flow.state,
    });

    expect(axios.post).toHaveBeenCalledOnce();
    expect(session.token.accessToken).toBe('access-token-123');
    expect(session.token.refreshToken).toBe('refresh-token-123');
    expect(getOAuthSession(session.sessionId)?.token.scope).toBe('read');
  });

  it('rejects invalid oauth state values', async () => {
    const { completeAuthorizationCodeFlow } = await import('../src/oauth.js');

    await expect(
      completeAuthorizationCodeFlow({ code: 'auth-code-123', state: 'bad-state' }),
    ).rejects.toThrow(/Invalid or expired OAuth state/);
  });
});