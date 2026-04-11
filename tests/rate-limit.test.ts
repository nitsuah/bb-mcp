import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadAuthModule() {
  vi.resetModules();
  process.env.BB_CLIENT_ID = process.env.BB_CLIENT_ID || 'test-client-id';
  process.env.BB_CLIENT_SECRET = process.env.BB_CLIENT_SECRET || 'test-client-secret';
  return import('../src/auth.js');
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe('auth rate limiting', () => {
  it('enforces per-role request limits and includes retry guidance', async () => {
    process.env.RATE_LIMIT_STUDENT_PER_MINUTE = '1';

    const { checkAuthorization, __resetRateLimiterForTests } = await loadAuthModule();
    __resetRateLimiterForTests();

    const context = {
      identity: { userId: 'student-1', role: 'student' as const },
      toolName: 'get_my_courses',
    };

    checkAuthorization(context);

    expect(() => checkAuthorization(context)).toThrow(/Rate limit exceeded/);
    expect(() => checkAuthorization(context)).toThrow(/Retry after/);
  });
});
