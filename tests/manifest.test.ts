import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.BB_CLIENT_ID ??= 'test-client-id';
  process.env.BB_CLIENT_SECRET ??= 'test-client-secret';
});

describe('provider manifest', () => {
  it('exposes required endpoints and transport capabilities', async () => {
    const { buildProviderManifest } = await import('../src/manifest.js');

    const manifest = buildProviderManifest('http://localhost:3100');

    expect(manifest.provider.id).toBe('blackboard-learn-mcp');
    expect(manifest.endpoints.manifest).toBe('http://localhost:3100/manifest');
    expect(manifest.endpoints.mcp).toBe('http://localhost:3100/mcp');
    expect(manifest.capabilities.transports.stdio).toBe(true);
    expect(manifest.capabilities.transports.streamableHttp.enabled).toBe(true);
  });

  it('publishes a dynamic tool manifest with names and input schemas', async () => {
    const { buildProviderManifest } = await import('../src/manifest.js');

    const manifest = buildProviderManifest('http://localhost:3100');
    const names = manifest.tools.map((t: { name: string }) => t.name);

    expect(names).toContain('get_my_courses');
    expect(names).toContain('list_courses');
    expect(names).toContain('get_course_content');
    expect(names).toContain('get_course_contents');
    expect(names).toContain('draft_announcement');
    expect(new Set(names).size).toBe(names.length);

    const getMyCourses = manifest.tools.find((t: { name: string }) => t.name === 'get_my_courses');
    expect(getMyCourses?.inputSchema?.type).toBe('object');
    expect(getMyCourses?.roles).toContain('student');
    expect(getMyCourses?.outputSchema?.type).toBe('object');
    expect(getMyCourses?.outputSchema?.properties?.content?.type).toBe('array');

    const listCourses = manifest.tools.find((t: { name: string }) => t.name === 'list_courses');
    expect(listCourses?.roles).toContain('student');
    expect(listCourses?.outputSchema?.required).toContain('content');

    const getCourseContents = manifest.tools.find((t: { name: string }) => t.name === 'get_course_contents');
    expect(getCourseContents?.roles).toContain('admin');

    const draftAnnouncement = manifest.tools.find((t: { name: string }) => t.name === 'draft_announcement');
    expect(draftAnnouncement?.roles).toContain('instructor');
    expect(draftAnnouncement?.roles).toContain('admin');
  });

  it('auth capabilities reflect caller_identity model, not oauth2', async () => {
    const { buildProviderManifest } = await import('../src/manifest.js');

    const manifest = buildProviderManifest('http://localhost:3100');

    expect((manifest.capabilities.auth as Record<string, unknown>).oauth2).toBeUndefined();
    expect((manifest.capabilities.auth as Record<string, unknown>).callerIdentity).toBe(true);
  });
});
