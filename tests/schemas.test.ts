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

  it('validates list_roster requires a courseId', async () => {
    const { ListRosterInput } = await import('../src/tools/instructor.js');

    const valid = ListRosterInput.parse({
      caller_identity: { userId: 'u2', role: 'instructor' },
      courseId: 'course-1',
    });

    expect(valid.courseId).toBe('course-1');
  });

  it('accepts optional filters for get_grades', async () => {
    const { GetGradesInput } = await import('../src/tools/instructor.js');

    const parsed = GetGradesInput.parse({
      caller_identity: { userId: 'u2', role: 'instructor' },
      courseId: 'course-1',
      userId: 'student-1',
      columnId: 'column-1',
    });

    expect(parsed.courseId).toBe('course-1');
    expect(parsed.userId).toBe('student-1');
    expect(parsed.columnId).toBe('column-1');
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

describe('structured output schemas', () => {
  it('defines output schemas for all registered tools', async () => {
    const { getOutputSchemaForTool } = await import('../src/schemas.js');

    const toolNames = [
      'get_my_courses',
      'list_courses',
      'get_upcoming_assignments',
      'get_my_grades',
      'get_course_content',
      'get_course_contents',
      'get_announcements',
      'list_roster',
      'get_grades',
      'get_submission_status',
      'get_grade_distribution',
      'get_discussion_summary',
      'get_at_risk_students',
      'search_course_materials',
    ];

    for (const toolName of toolNames) {
      const schema = getOutputSchemaForTool(toolName);
      expect(schema).toBeDefined();
      expect(schema).toHaveProperty('type');
      expect(schema?.type).toBe('object');
    }
  });

  it('ensures manifest output schemas wrap specific tool schemas', async () => {
    const { buildProviderManifest } = await import('../src/manifest.js');

    const manifest = buildProviderManifest('http://localhost:3100');
    const courseListTool = manifest.tools.find((t: { name: string }) => t.name === 'list_courses');

    expect(courseListTool).toBeDefined();
    expect(courseListTool.outputSchema).toBeDefined();
    expect(courseListTool.outputSchema.properties.content).toBeDefined();
    expect(courseListTool.outputSchema.required).toContain('content');
  });

  it('provides a course list schema with typed course objects', async () => {
    const { OUTPUT_SCHEMAS } = await import('../src/schemas.js');

    const schema = OUTPUT_SCHEMAS.courseListSchema;
    expect(schema.properties.courses).toBeDefined();
    expect(schema.properties.courses.type).toBe('array');

    const courseItem = schema.properties.courses.items;
    expect(courseItem.properties.id).toBeDefined();
    expect(courseItem.properties.courseId).toBeDefined();
    expect(courseItem.properties.name).toBeDefined();
    expect(courseItem.required).toContain('id');
    expect(courseItem.required).toContain('courseId');
  });

  it('provides an announcements schema with typed announcement objects', async () => {
    const { OUTPUT_SCHEMAS } = await import('../src/schemas.js');

    const schema = OUTPUT_SCHEMAS.announcementsSchema;
    expect(schema.properties.announcements).toBeDefined();
    expect(schema.properties.announcements.type).toBe('array');

    const announcementItem = schema.properties.announcements.items;
    expect(announcementItem.properties.id).toBeDefined();
    expect(announcementItem.properties.title).toBeDefined();
    expect(announcementItem.properties.body).toBeDefined();
    expect(announcementItem.required).toContain('id');
    expect(announcementItem.required).toContain('title');
  });

  it('provides a roster schema with typed enrolled users', async () => {
    const { OUTPUT_SCHEMAS } = await import('../src/schemas.js');

    const schema = OUTPUT_SCHEMAS.rosterSchema;
    expect(schema.properties.users).toBeDefined();
    expect(schema.properties.users.type).toBe('array');

    const rosterItem = schema.properties.users.items;
    expect(rosterItem.properties.userId).toBeDefined();
    expect(rosterItem.properties.userName).toBeDefined();
    expect(rosterItem.required).toContain('userId');
    expect(rosterItem.required).toContain('userName');
  });

  it('provides an instructor grades schema with typed grade entries', async () => {
    const { OUTPUT_SCHEMAS } = await import('../src/schemas.js');

    const schema = OUTPUT_SCHEMAS.instructorGradesSchema;
    expect(schema.properties.users).toBeDefined();

    const userItem = schema.properties.users.items;
    expect(userItem.properties.userId).toBeDefined();
    expect(userItem.properties.grades).toBeDefined();

    const gradeItem = userItem.properties.grades.items;
    expect(gradeItem.properties.columnId).toBeDefined();
    expect(gradeItem.properties.score).toBeDefined();
  });

  it('provides a grade distribution schema with statistics', async () => {
    const { OUTPUT_SCHEMAS } = await import('../src/schemas.js');

    const schema = OUTPUT_SCHEMAS.gradeDistributionSchema;
    expect(schema.properties.statistics).toBeDefined();
    expect(schema.properties.distribution).toBeDefined();

    const stats = schema.properties.statistics;
    expect(stats.properties.mean).toBeDefined();
    expect(stats.properties.median).toBeDefined();
    expect(stats.properties.stddev).toBeDefined();

    const dist = schema.properties.distribution;
    expect(dist.properties.A).toBeDefined();
    expect(dist.properties.B).toBeDefined();
    expect(dist.properties.F).toBeDefined();
  });
});
