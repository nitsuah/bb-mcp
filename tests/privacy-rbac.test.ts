import { describe, expect, it } from 'vitest';

import { hashIdentifier, scrubLogText, toAuditSubject } from '../src/privacy.js';
import { canRoleAccessTool, getAllowedRolesForTool, TOOL_ROLE_RULES } from '../src/rbac.js';

describe('privacy helpers', () => {
  it('creates a stable 12-char hash for identifiers', () => {
    expect(hashIdentifier('student-123')).toHaveLength(12);
    expect(hashIdentifier('student-123')).toBe(hashIdentifier('student-123'));
    expect(hashIdentifier('student-123')).not.toBe(hashIdentifier('student-124'));
  });

  it('formats audit subjects with anon prefix', () => {
    expect(toAuditSubject('abc-123')).toMatch(/^anon:[a-f0-9]{12}$/);
  });

  it('redacts emails and long opaque ids from logs', () => {
    const scrubbed = scrubLogText(
      'Denied user john.doe@example.edu token abcdefghijklmnop1234567890 with request id short-id',
    );

    expect(scrubbed).toContain('[redacted-email]');
    expect(scrubbed).toContain('[redacted-id]');
    expect(scrubbed).toContain('short-id');
    expect(scrubbed).not.toContain('john.doe@example.edu');
    expect(scrubbed).not.toContain('abcdefghijklmnop1234567890');
  });
});

describe('rbac policy helpers', () => {
  it('returns explicit roles for known tools', () => {
    expect(getAllowedRolesForTool('list_roster')).toEqual(['instructor', 'admin']);
  });

  it('returns an empty role list for unknown tools', () => {
    expect(getAllowedRolesForTool('unknown_tool')).toEqual([]);
  });

  it('authorizes allowed role-tool pairs', () => {
    expect(canRoleAccessTool('student', 'get_my_courses')).toBe(true);
    expect(canRoleAccessTool('admin', 'get_grades')).toBe(true);
  });

  it('denies disallowed role-tool pairs', () => {
    expect(canRoleAccessTool('student', 'get_grades')).toBe(false);
    expect(canRoleAccessTool('instructor', 'get_upcoming_assignments')).toBe(false);
  });

  it('keeps each tool mapped to at least one role', () => {
    for (const roles of Object.values(TOOL_ROLE_RULES)) {
      expect(roles.length).toBeGreaterThan(0);
    }
  });
});
