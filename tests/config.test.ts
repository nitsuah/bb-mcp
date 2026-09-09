import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadConfig() {
  vi.resetModules();
  return import('../src/config.js');
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe('config', () => {
  it('throws when required Blackboard credentials are missing', async () => {
    process.env.BB_CLIENT_ID = '';
    process.env.BB_CLIENT_SECRET = '';

    await expect(loadConfig()).rejects.toThrow(
      'Missing required environment variable: BB_CLIENT_ID',
    );
  });

  it('applies defaults and normalizes values from env', async () => {
    process.env.BB_CLIENT_ID = 'client-id';
    process.env.BB_CLIENT_SECRET = 'client-secret';
    process.env.BB_BASE_URL = 'https://example.blackboard.com/';
    process.env.PUBLIC_BASE_URL = 'https://mcp.example.edu';
    process.env.RESTRICTED_TOOLS = 'get_grade_distribution, draft_announcement ,';
    delete process.env.PORT;
    delete process.env.LOG_LEVEL;
    delete process.env.METRICS_PUSH_URL;

    const { config } = await loadConfig();

    expect(config.bb.clientId).toBe('client-id');
    expect(config.bb.clientSecret).toBe('client-secret');
    expect(config.bb.baseUrl).toBe('https://example.blackboard.com');
    expect(config.oauth.authorizationPath).toBe('/learn/api/public/v1/oauth2/authorizationcode');
    expect(config.oauth.tokenPath).toBe('/learn/api/public/v1/oauth2/token');
    expect(config.oauth.redirectUri).toBeNull();
    expect(config.oauth.scope).toBeNull();
    expect(config.server.port).toBe(3100);
    expect(config.server.logLevel).toBe('info');
    expect(config.server.publicBaseUrl).toBe('https://mcp.example.edu');
    expect(config.metrics.pushUrl).toBeNull();
    // RESTRICTED_TOOLS only ever adds to the mandatory FERPA set below — it
    // cannot replace it. 'get_grade_distribution' is already mandatory, so
    // the env value contributes only 'draft_announcement' as a real addition.
    expect(config.security.restrictedTools).toEqual(
      expect.arrayContaining([
        'get_at_risk_students',
        'get_grade_distribution',
        'get_submission_status',
        'get_grades',
        'list_users',
        'get_user',
        'list_enrollments',
        'list_audit_logs',
        'draft_announcement',
      ]),
    );
    expect(config.security.restrictedTools).toHaveLength(9);
  });

  it('cannot be used to drop a mandatory FERPA tool from the restricted set (regression: CWE-862)', async () => {
    process.env.BB_CLIENT_ID = 'client-id';
    process.env.BB_CLIENT_SECRET = 'client-secret';
    // A legacy/misconfigured override that lists only a subset of the
    // mandatory tools — simulates an operator who copied an old
    // RESTRICTED_TOOLS value that predates a tool being added to the
    // mandatory list, or who mistakenly believes this variable is exhaustive.
    process.env.RESTRICTED_TOOLS = 'get_grades';

    const { config } = await loadConfig();

    // Every mandatory FERPA tool must still be gated even though the env
    // override didn't list it.
    expect(config.security.restrictedTools).toEqual(
      expect.arrayContaining([
        'get_at_risk_students',
        'get_grade_distribution',
        'get_submission_status',
        'get_grades',
        'list_users',
        'get_user',
        'list_enrollments',
        'list_audit_logs',
      ]),
    );
  });
});
