import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  // Ensure modules that instantiate config can import successfully in tests.
  process.env.BB_CLIENT_ID ??= 'test-client-id';
  process.env.BB_CLIENT_SECRET ??= 'test-client-secret';
});

describe('zod input schemas', () => {
  it('applies default daysAhead for getUpcomingAssignments', async () => {
    const { GetUpcomingAssignmentsInput } = await import('../src/tools/student.js');

    const parsed = GetUpcomingAssignmentsInput.parse({ caller_identity: { userId: 'u1', role: 'student' } });

    expect(parsed.daysAhead).toBe(14);
  });

  it('applies default unreadOnly for getAnnouncements', async () => {
    const { GetAnnouncementsInput } = await import('../src/tools/student.js');

    const parsed = GetAnnouncementsInput.parse({
      caller_identity: { userId: 'u1', role: 'student' },
      courseId: 'course-1',
    });

    expect(parsed.unreadOnly).toBe(false);
  });

  it('keeps alias schemas aligned for list_courses and get_course_contents', async () => {
    const { ListCoursesInput, GetCourseContentsInput } = await import('../src/tools/student.js');

    const listCourses = ListCoursesInput.parse({
      caller_identity: { userId: 'u1', role: 'student' },
    });

    const courseContents = GetCourseContentsInput.parse({
      caller_identity: { userId: 'u1', role: 'student' },
      courseId: 'course-1',
    });

    expect(listCourses.caller_identity).toBeDefined();
    expect(courseContents.courseId).toBe('course-1');
  });

  it('validates draft announcement topic length and default tone', async () => {
    const { DraftAnnouncementInput } = await import('../src/tools/instructor.js');

    const valid = DraftAnnouncementInput.parse({
      caller_identity: { userId: 'u2', role: 'instructor' },
      courseId: 'course-1',
      topic: 'Midterm review session details',
    });

    expect(valid.tone).toBe('friendly');
    expect(valid.post).toBe(false);

    const tooShort = DraftAnnouncementInput.safeParse({
      caller_identity: { userId: 'u2', role: 'instructor' },
      courseId: 'course-1',
      topic: 'Hi',
    });

    expect(tooShort.success).toBe(false);
  });

  it('requires non-empty query for searchCourseMaterials', async () => {
    const { SearchCourseMaterialsInput } = await import('../src/tools/shared.js');

    const invalid = SearchCourseMaterialsInput.safeParse({
      caller_identity: { userId: 'u1', role: 'student' },
      query: '',
    });

    expect(invalid.success).toBe(false);
  });
});
