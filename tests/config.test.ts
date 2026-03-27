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
    process.env.RESTRICTED_TOOLS = 'get_grade_distribution, draft_announcement ,';
    delete process.env.PORT;
    delete process.env.LOG_LEVEL;
    delete process.env.METRICS_PUSH_URL;

    const { config } = await loadConfig();

    expect(config.bb.clientId).toBe('client-id');
    expect(config.bb.clientSecret).toBe('client-secret');
    expect(config.bb.baseUrl).toBe('https://example.blackboard.com');
    expect(config.server.port).toBe(3100);
    expect(config.server.logLevel).toBe('info');
    expect(config.metrics.pushUrl).toBeNull();
    expect(config.security.restrictedTools).toEqual([
      'get_grade_distribution',
      'draft_announcement',
    ]);
  });
});
