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
    expect(line).toContain('"reason":"FERPA authorization required"');
    expect(line).not.toContain('student-12345@example.edu');
  });

  it('denies unknown tools by default in RBAC policy', async () => {
    const { checkAuthorization } = await import('../src/auth.js');

    expect(() =>
      checkAuthorization({
        identity: { userId: 'admin-1', role: 'admin' },
        toolName: 'unregistered_tool_name',
      }),
    ).toThrow(/not available to role/);
  });

  it('list_users, get_user, list_enrollments, and list_audit_logs require ferpa_authorized by default', async () => {
    const { checkAuthorization } = await import('../src/auth.js');

    for (const toolName of [
      'list_users',
      'get_user',
      'list_enrollments',
      'list_audit_logs',
    ]) {
      expect(() =>
        checkAuthorization({
          identity: { userId: 'admin-1', role: 'admin' },
          toolName,
        }),
      ).toThrow(/ferpa_authorized/);
    }
  });
});

describe('local audit trail', () => {
  it('records granted and denied events and returns them most-recent-first', async () => {
    const { checkAuthorization, getLocalAuditLogEntries, __resetAuditLogForTests } =
      await import('../src/auth.js');
    __resetAuditLogForTests();

    checkAuthorization({
      identity: { userId: 'inst-1', role: 'instructor' },
      toolName: 'get_my_courses',
    });
    expect(() =>
      checkAuthorization({
        identity: { userId: 'inst-1', role: 'instructor' },
        toolName: 'get_grades',
        courseId: 'course-a',
      }),
    ).toThrow();

    const { entries, total } = getLocalAuditLogEntries({ limit: 10 });
    expect(total).toBe(2);
    expect(entries[0].event).toBe('access.denied');
    expect(entries[0].tool).toBe('get_grades');
    expect(entries[1].event).toBe('access.granted');
    // No raw userId anywhere in the exposed entries — only the hashed subject.
    expect(JSON.stringify(entries)).not.toContain('inst-1');
  });

  it('filters by eventType, courseId, and userId (matched via hashed subject)', async () => {
    const { checkAuthorization, getLocalAuditLogEntries, __resetAuditLogForTests } =
      await import('../src/auth.js');
    __resetAuditLogForTests();

    checkAuthorization({
      identity: { userId: 'student-1', role: 'student' },
      toolName: 'get_my_courses',
    });
    checkAuthorization({
      identity: { userId: 'student-2', role: 'student' },
      toolName: 'get_my_courses',
    });

    const forStudent1 = getLocalAuditLogEntries({ userId: 'student-1' });
    expect(forStudent1.total).toBe(1);
    expect(forStudent1.entries[0].tool).toBe('get_my_courses');

    const forOtherEvent = getLocalAuditLogEntries({ eventType: 'access.denied' });
    expect(forOtherEvent.total).toBe(0);
  });

  it('caps the in-memory buffer instead of growing unbounded', async () => {
    const { checkAuthorization, getLocalAuditLogEntries, __resetAuditLogForTests } =
      await import('../src/auth.js');
    __resetAuditLogForTests();

    for (let i = 0; i < 1005; i += 1) {
      checkAuthorization({
        identity: { userId: `student-${i}`, role: 'student' },
        toolName: 'get_my_courses',
      });
    }

    const { total } = getLocalAuditLogEntries({ limit: 5000 });
    expect(total).toBeLessThanOrEqual(1000);
  });

  it('treats an epoch-instant startDate as a real boundary, not an absent one (regression)', async () => {
    const { checkAuthorization, getLocalAuditLogEntries, __resetAuditLogForTests } =
      await import('../src/auth.js');
    __resetAuditLogForTests();

    checkAuthorization({
      identity: { userId: 'student-1', role: 'student' },
      toolName: 'get_my_courses',
    });

    // Date.parse('1970-01-01T00:00:00.000Z') === 0, which a truthy check on
    // startMs/endMs would treat the same as "not provided", silently
    // disabling the filter. The startDate direction alone doesn't actually
    // discriminate this bug — every entry's real timestamp is after epoch,
    // so it's included either way. The endDate direction does: a
    // truthiness bug would wrongly include the entry (filter disabled)
    // instead of excluding it (real entries are after the epoch cutoff).
    expect(
      getLocalAuditLogEntries({ startDate: '1970-01-01T00:00:00.000Z' }).entries,
    ).toHaveLength(1);
    expect(
      getLocalAuditLogEntries({ endDate: '1970-01-01T00:00:00.000Z' }).entries,
    ).toHaveLength(0);
  });

  it('rejects an unparseable startDate/endDate instead of silently ignoring it', async () => {
    const { getLocalAuditLogEntries, __resetAuditLogForTests } =
      await import('../src/auth.js');
    __resetAuditLogForTests();

    expect(() => getLocalAuditLogEntries({ startDate: 'not-a-date' })).toThrow(
      /Invalid startDate/,
    );
    expect(() => getLocalAuditLogEntries({ endDate: 'also-not-a-date' })).toThrow(
      /Invalid endDate/,
    );
  });
});

describe('checkCourseEntitlement (IDOR guard, CWE-639)', () => {
  it('allows an instructor who is actually enrolled in the course as Instructor', async () => {
    const { checkCourseEntitlement } = await import('../src/auth.js');
    const client = {
      getCourseMembership: vi.fn().mockResolvedValue({ userId: 'inst-1', courseRoleId: 'Instructor' }),
    };

    await expect(
      checkCourseEntitlement(
        { identity: { userId: 'inst-1', role: 'instructor' }, toolName: 'update_grade', courseId: 'course-a' },
        client,
      ),
    ).resolves.toBeUndefined();
    expect(client.getCourseMembership).toHaveBeenCalledWith('course-a', 'inst-1');
  });

  it('allows a TeachingAssistant or CourseBuilder, not just Instructor', async () => {
    const { checkCourseEntitlement } = await import('../src/auth.js');
    for (const courseRoleId of ['TeachingAssistant', 'CourseBuilder']) {
      const client = {
        getCourseMembership: vi.fn().mockResolvedValue({ userId: 'inst-1', courseRoleId }),
      };
      await expect(
        checkCourseEntitlement(
          { identity: { userId: 'inst-1', role: 'instructor' }, toolName: 'update_grade', courseId: 'course-a' },
          client,
        ),
      ).resolves.toBeUndefined();
    }
  });

  it('rejects an instructor who is not enrolled in the target course at all (IDOR)', async () => {
    const { AuthorizationError, checkCourseEntitlement } = await import('../src/auth.js');
    const client = { getCourseMembership: vi.fn().mockResolvedValue(null) };

    await expect(
      checkCourseEntitlement(
        { identity: { userId: 'inst-1', role: 'instructor' }, toolName: 'update_grade', courseId: 'course-not-mine' },
        client,
      ),
    ).rejects.toThrow(AuthorizationError);
  });

  it('rejects an instructor enrolled in the course only as Student', async () => {
    const { AuthorizationError, checkCourseEntitlement } = await import('../src/auth.js');
    const client = {
      getCourseMembership: vi.fn().mockResolvedValue({ userId: 'inst-1', courseRoleId: 'Student' }),
    };

    await expect(
      checkCourseEntitlement(
        { identity: { userId: 'inst-1', role: 'instructor' }, toolName: 'update_grade', courseId: 'course-a' },
        client,
      ),
    ).rejects.toThrow(AuthorizationError);
  });

  it('bypasses the course-membership lookup entirely for role=admin', async () => {
    const { checkCourseEntitlement } = await import('../src/auth.js');
    const client = { getCourseMembership: vi.fn() };

    await expect(
      checkCourseEntitlement(
        { identity: { userId: 'admin-1', role: 'admin' }, toolName: 'update_grade', courseId: 'any-course' },
        client,
      ),
    ).resolves.toBeUndefined();
    expect(client.getCourseMembership).not.toHaveBeenCalled();
  });

  it('rejects when no courseId is present on the auth context', async () => {
    const { AuthorizationError, checkCourseEntitlement } = await import('../src/auth.js');
    const client = { getCourseMembership: vi.fn() };

    await expect(
      checkCourseEntitlement(
        { identity: { userId: 'inst-1', role: 'instructor' }, toolName: 'update_grade' },
        client,
      ),
    ).rejects.toThrow(AuthorizationError);
    expect(client.getCourseMembership).not.toHaveBeenCalled();
  });
});
