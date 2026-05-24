import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AnyFn = (...args: any[]) => any;

const ORIGINAL_ENV = { ...process.env };

let requestInterceptor: AnyFn | undefined;
let responseRejectedInterceptor: AnyFn | undefined;

const httpGet = vi.fn();
const httpPost = vi.fn();
const tokenPost = vi.fn();
const createClient = vi.fn(() => ({
  get: httpGet,
  post: httpPost,
  interceptors: {
    request: {
      use: vi.fn((fn: AnyFn) => {
        requestInterceptor = fn;
      }),
    },
    response: {
      use: vi.fn((_ok: AnyFn, rejected: AnyFn) => {
        responseRejectedInterceptor = rejected;
      }),
    },
  },
}));

vi.mock('axios', () => ({
  default: {
    create: createClient,
    post: tokenPost,
  },
}));

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    BB_CLIENT_ID: 'test-client-id',
    BB_CLIENT_SECRET: 'test-client-secret',
    BB_BASE_URL: 'https://blackboard.example.edu',
  };
  requestInterceptor = undefined;
  responseRejectedInterceptor = undefined;
  vi.resetModules();
  createClient.mockClear();
  tokenPost.mockReset();
  httpGet.mockReset();
  httpPost.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe('BlackboardClient', () => {
  it('creates an axios client with Blackboard API base configuration', async () => {
    const { BlackboardClient } = await import('../src/bb-client.js');
    new BlackboardClient();

    expect(createClient.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(createClient.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        baseURL: 'https://blackboard.example.edu/learn/api/public/v1',
        timeout: 15000,
      }),
    );
  });

  it('injects bearer token using oauth client-credentials flow', async () => {
    tokenPost.mockResolvedValue({ data: { access_token: 'token-1', expires_in: 3600 } });
    const { BlackboardClient } = await import('../src/bb-client.js');
    new BlackboardClient();

    const req = { headers: {} as Record<string, string> };
    await requestInterceptor?.(req);

    expect(req.headers.Authorization).toBe('Bearer token-1');
    expect(tokenPost).toHaveBeenCalledWith(
      'https://blackboard.example.edu/learn/api/public/v1/oauth2/token',
      'grant_type=client_credentials',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        auth: {
          username: 'test-client-id',
          password: 'test-client-secret',
        },
        timeout: 10000,
      }),
    );
  });

  it('reuses cached token while it remains valid', async () => {
    tokenPost.mockResolvedValue({ data: { access_token: 'token-1', expires_in: 3600 } });
    const { BlackboardClient } = await import('../src/bb-client.js');
    new BlackboardClient();

    await requestInterceptor?.({ headers: {} });
    await requestInterceptor?.({ headers: {} });

    expect(tokenPost).toHaveBeenCalledTimes(1);
  });

  it('maps Blackboard API errors through the response interceptor', async () => {
    const { BlackboardClient } = await import('../src/bb-client.js');
    new BlackboardClient();

    try {
      responseRejectedInterceptor?.({
        response: { status: 403, data: { message: 'Forbidden by Blackboard policy' } },
        message: 'Request failed with status code 403',
      });
      throw new Error('Expected interceptor to throw');
    } catch (err) {
      const e = err as { name: string; message: string; status: number; data: unknown };
      expect(e.name).toBe('BbApiError');
      expect(e.message).toContain('Forbidden by Blackboard policy');
      expect(e.status).toBe(403);
      expect(e.data).toEqual({ message: 'Forbidden by Blackboard policy' });
    }
  });

  it('gets all courses or user-scoped courses based on arguments', async () => {
    const { BlackboardClient } = await import('../src/bb-client.js');
    const client = new BlackboardClient();
    httpGet.mockResolvedValueOnce({ data: { results: [{ id: 'c1' }] } });
    httpGet.mockResolvedValueOnce({ data: { results: [{ id: 'c2' }] } });

    const all = await client.getCourses();
    const mine = await client.getCourses('user-1');

    expect(all).toEqual([{ id: 'c1' }]);
    expect(mine).toEqual([{ id: 'c2' }]);
    expect(httpGet).toHaveBeenNthCalledWith(
      1,
      '/courses',
      expect.objectContaining({ params: expect.objectContaining({ limit: 100 }) }),
    );
    expect(httpGet).toHaveBeenNthCalledWith(
      2,
      '/users/user-1/courses',
      expect.objectContaining({ params: expect.objectContaining({ limit: 100 }) }),
    );
  });

  it('returns empty arrays when list endpoints omit results', async () => {
    const { BlackboardClient } = await import('../src/bb-client.js');
    const client = new BlackboardClient();

    httpGet.mockResolvedValue({ data: {} });

    await expect(client.getAssignments('c1')).resolves.toEqual([]);
    await expect(client.getGrades('c1', 'u1')).resolves.toEqual([]);
    await expect(client.getColumnGrades('c1', 'col1')).resolves.toEqual([]);
    await expect(client.getAttempts('c1', 'col1')).resolves.toEqual([]);
    await expect(client.getAnnouncements('c1')).resolves.toEqual([]);
    await expect(client.getCourseContent('c1')).resolves.toEqual([]);
    await expect(client.getDiscussionPosts('c1', 't1')).resolves.toEqual([]);
  });

  it('probes connectivity using a tiny course query', async () => {
    const { BlackboardClient } = await import('../src/bb-client.js');
    const client = new BlackboardClient();
    httpGet.mockResolvedValue({ data: { results: [{ id: 'c1' }, { id: 'c2' }] } });

    const count = await client.probeConnectivity();

    expect(count).toBe(2);
    expect(httpGet).toHaveBeenCalledWith(
      '/courses',
      expect.objectContaining({ params: { limit: 1, fields: 'id' } }),
    );
  });

  it('gets a single course and user by id', async () => {
    const { BlackboardClient } = await import('../src/bb-client.js');
    const client = new BlackboardClient();

    httpGet.mockResolvedValueOnce({ data: { id: 'course-1' } });
    httpGet.mockResolvedValueOnce({ data: { id: 'user-1' } });

    await expect(client.getCourse('course-1')).resolves.toEqual({ id: 'course-1' });
    await expect(client.getUser('user-1')).resolves.toEqual({ id: 'user-1' });

    expect(httpGet).toHaveBeenNthCalledWith(1, '/courses/course-1');
    expect(httpGet).toHaveBeenNthCalledWith(2, '/users/user-1');
  });

  it('creates attempts with optional student comments', async () => {
    const { BlackboardClient } = await import('../src/bb-client.js');
    const client = new BlackboardClient();

    httpPost.mockResolvedValueOnce({ data: { id: 'attempt-1' } });
    httpPost.mockResolvedValueOnce({ data: { id: 'attempt-2' } });

    await client.createAttempt('course-1', 'column-1', 'user-1');
    await client.createAttempt('course-1', 'column-1', 'user-1', 'Please review again');

    expect(httpPost).toHaveBeenNthCalledWith(
      1,
      '/courses/course-1/gradebook/columns/column-1/attempts',
      { userId: 'user-1' },
    );
    expect(httpPost).toHaveBeenNthCalledWith(
      2,
      '/courses/course-1/gradebook/columns/column-1/attempts',
      { userId: 'user-1', studentComments: 'Please review again' },
    );
  });

  it('creates announcements with permanent availability', async () => {
    const { BlackboardClient } = await import('../src/bb-client.js');
    const client = new BlackboardClient();

    httpPost.mockResolvedValue({ data: { id: 'announcement-1' } });
    await client.createAnnouncement('course-1', 'Title', 'Body');

    expect(httpPost).toHaveBeenCalledWith('/courses/course-1/announcements', {
      title: 'Title',
      body: 'Body',
      availability: { duration: { type: 'Permanent' } },
    });
  });

  it('switches between top-level content and child content paths', async () => {
    const { BlackboardClient } = await import('../src/bb-client.js');
    const client = new BlackboardClient();

    httpGet.mockResolvedValueOnce({ data: { results: [{ id: 'root-content' }] } });
    httpGet.mockResolvedValueOnce({ data: { results: [{ id: 'child-content' }] } });

    await client.getCourseContent('course-1');
    await client.getCourseContent('course-1', 'parent-1');

    expect(httpGet).toHaveBeenNthCalledWith(
      1,
      '/courses/course-1/contents',
      expect.objectContaining({ params: { limit: 100 } }),
    );
    expect(httpGet).toHaveBeenNthCalledWith(
      2,
      '/courses/course-1/contents/parent-1/children',
      expect.objectContaining({ params: { limit: 100 } }),
    );
  });

  it('maps enrollment entries to explicit users with fallback values', async () => {
    const { BlackboardClient } = await import('../src/bb-client.js');
    const client = new BlackboardClient();

    httpGet.mockResolvedValue({
      data: {
        results: [
          { userId: 'u1', user: { id: 'u1', userName: 'alice' } },
          { userId: 'u2' },
        ],
      },
    });

    const users = await client.getEnrolledUsers('course-1');

    expect(users).toEqual([
      { id: 'u1', userName: 'alice' },
      { id: 'u2', userName: 'u2' },
    ]);
  });

  it('uses expected Blackboard endpoints for gradebook and discussions', async () => {
    const { BlackboardClient } = await import('../src/bb-client.js');
    const client = new BlackboardClient();

    httpGet.mockResolvedValue({ data: { results: [] } });

    await client.getAssignments('course-1');
    await client.getGrades('course-1', 'user-1');
    await client.getColumnGrades('course-1', 'column-1');
    await client.getAttempts('course-1', 'column-1');
    await client.getDiscussionPosts('course-1', 'thread-1');

    expect(httpGet).toHaveBeenCalledWith(
      '/courses/course-1/gradebook/columns',
      expect.objectContaining({ params: { limit: 200 } }),
    );
    expect(httpGet).toHaveBeenCalledWith('/courses/course-1/gradebook/users/user-1');
    expect(httpGet).toHaveBeenCalledWith(
      '/courses/course-1/gradebook/columns/column-1/users',
      expect.objectContaining({ params: { limit: 500 } }),
    );
    expect(httpGet).toHaveBeenCalledWith(
      '/courses/course-1/gradebook/columns/column-1/attempts',
      expect.objectContaining({ params: { limit: 500 } }),
    );
    expect(httpGet).toHaveBeenCalledWith(
      '/courses/course-1/discussions/thread-1/posts',
      expect.objectContaining({ params: { limit: 200 } }),
    );
  });
});
