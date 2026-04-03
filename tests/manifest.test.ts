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
    expect(names).toContain('get_course_content');
    expect(names).toContain('draft_announcement');
    expect(new Set(names).size).toBe(names.length);

    const getMyCourses = manifest.tools.find((t: { name: string }) => t.name === 'get_my_courses');
    expect(getMyCourses?.inputSchema?.type).toBe('object');
    expect(getMyCourses?.roles).toContain('student');
  });
});
