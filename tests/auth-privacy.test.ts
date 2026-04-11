import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  process.env.BB_CLIENT_ID ??= 'test-client-id';
  process.env.BB_CLIENT_SECRET ??= 'test-client-secret';
});

describe('auth privacy logging', () => {
  it('writes hashed subject and never raw userId for granted access', async () => {
    const { checkAuthorization } = await import('../src/auth.js');

    const writes: string[] = [];
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(((chunk: string | Uint8Array) => {
        writes.push(typeof chunk === 'string' ? chunk : chunk.toString());
        return true;
      }) as typeof process.stdout.write);

    try {
      checkAuthorization({
        identity: { userId: 'student-12345@example.edu', role: 'student', clientApp: 'test' },
        toolName: 'get_my_courses',
      });
    } finally {
      spy.mockRestore();
    }

    const line = writes.find((entry) => entry.includes('access.granted')) ?? '';
    expect(line).toContain('"subject":"anon:');
    expect(line).toContain('"piiRedaction":"hashed-subject"');
    expect(line).not.toContain('student-12345@example.edu');
  });

  it('scrubs sensitive reason strings when access is denied', async () => {
    const { checkAuthorization } = await import('../src/auth.js');

    const writes: string[] = [];
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(((chunk: string | Uint8Array) => {
        writes.push(typeof chunk === 'string' ? chunk : chunk.toString());
        return true;
      }) as typeof process.stdout.write);

    try {
      expect(() =>
        checkAuthorization({
          identity: { userId: 'student-12345@example.edu', role: 'student' },
          toolName: 'get_grade_distribution',
        }),
      ).toThrow();
    } finally {
      spy.mockRestore();
    }

    const line = writes.find((entry) => entry.includes('access.denied')) ?? '';
    expect(line).toContain('"reason":"instructor-only tool"');
    expect(line).not.toContain('student-12345@example.edu');
  });
});
