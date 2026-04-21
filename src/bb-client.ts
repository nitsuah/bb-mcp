/**
 * Blackboard Learn REST API client.
 *
 * Handles OAuth 2.0 client_credentials token lifecycle automatically.
 * All methods throw on non-2xx responses with a descriptive error message.
 *
 * Blackboard Learn REST API docs:
 *   https://developer.blackboard.com/portal/displayApi
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from './config.js';
import type {
  BbCourse,
  BbAssignment,
  BbGrade,
  BbAnnouncement,
  BbContent,
  BbUser,
  BbDiscussionPost,
  BbAttempt,
  TokenCache,
} from './types.js';

class BbApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'BbApiError';
  }
}

export class BlackboardClient {
  private http: AxiosInstance;
  private tokenCache: TokenCache | null = null;

  constructor() {
    this.http = axios.create({
      baseURL: `${config.bb.baseUrl}/learn/api/public/v1`,
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });

    // Inject auth token on every request
    this.http.interceptors.request.use(async (req) => {
      const token = await this.getAccessToken();
      req.headers.Authorization = `Bearer ${token}`;
      return req;
    });

    // Map Blackboard API errors to BbApiError
    this.http.interceptors.response.use(
      (r) => r,
      (err: AxiosError) => {
        const status = err.response?.status ?? 0;
        const data = err.response?.data;
        const msg =
          (data as Record<string, string> | undefined)?.message ??
          err.message ??
          'Blackboard API error';
        throw new BbApiError(msg, status, data);
      },
    );
  }

  // ── Auth ─────────────────────────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 30_000) {
      return this.tokenCache.accessToken;
    }

    const params = new URLSearchParams();
    params.set('grant_type', 'client_credentials');

    const res = await axios.post<{ access_token: string; expires_in: number }>(
      `${config.bb.baseUrl}/learn/api/public/v1/oauth2/token`,
      params.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        auth: {
          username: config.bb.clientId,
          password: config.bb.clientSecret,
        },
        timeout: 10_000,
      },
    );

    this.tokenCache = {
      accessToken: res.data.access_token,
      expiresAt: now + res.data.expires_in * 1000,
    };
    return this.tokenCache.accessToken;
  }

  // ── Courses ──────────────────────────────────────────────────────────────

  async getCourses(userId?: string): Promise<BbCourse[]> {
    const url = userId ? `/users/${userId}/courses` : '/courses';
    const res = await this.http.get<{ results: BbCourse[] }>(url, {
      params: { limit: 100, fields: 'id,courseId,name,description,term,availability,enrollment' },
    });
    return res.data.results ?? [];
  }

  async probeConnectivity(): Promise<number> {
    const res = await this.http.get<{ results: BbCourse[] }>('/courses', {
      params: { limit: 1, fields: 'id' },
    });
    return (res.data.results ?? []).length;
  }

  async getCourse(courseId: string): Promise<BbCourse> {
    const res = await this.http.get<BbCourse>(`/courses/${courseId}`);
    return res.data;
  }

  // ── Assignments (Grade Columns) ──────────────────────────────────────────

  async getAssignments(courseId: string): Promise<BbAssignment[]> {
    const res = await this.http.get<{ results: BbAssignment[] }>(
      `/courses/${courseId}/gradebook/columns`,
      { params: { limit: 200 } },
    );
    return res.data.results ?? [];
  }

  // ── Grades ───────────────────────────────────────────────────────────────

  async getGrades(courseId: string, userId: string): Promise<BbGrade[]> {
    const res = await this.http.get<{ results: BbGrade[] }>(
      `/courses/${courseId}/gradebook/users/${userId}`,
    );
    return res.data.results ?? [];
  }

  async getColumnGrades(courseId: string, columnId: string): Promise<BbGrade[]> {
    const res = await this.http.get<{ results: BbGrade[] }>(
      `/courses/${courseId}/gradebook/columns/${columnId}/users`,
      { params: { limit: 500 } },
    );
    return res.data.results ?? [];
  }

  async getAttempts(courseId: string, columnId: string): Promise<BbAttempt[]> {
    const res = await this.http.get<{ results: BbAttempt[] }>(
      `/courses/${courseId}/gradebook/columns/${columnId}/attempts`,
      { params: { limit: 500 } },
    );
    return res.data.results ?? [];
  }

  async createAttempt(
    courseId: string,
    columnId: string,
    userId: string,
    studentComments?: string,
  ): Promise<BbAttempt> {
    const payload: Record<string, unknown> = { userId };
    if (studentComments) {
      payload.studentComments = studentComments;
    }
    const res = await this.http.post<BbAttempt>(
      `/courses/${courseId}/gradebook/columns/${columnId}/attempts`,
      payload,
    );
    return res.data;
  }

  // ── Announcements ────────────────────────────────────────────────────────

  async getAnnouncements(courseId: string): Promise<BbAnnouncement[]> {
    const res = await this.http.get<{ results: BbAnnouncement[] }>(
      `/courses/${courseId}/announcements`,
      { params: { limit: 50 } },
    );
    return res.data.results ?? [];
  }

  async createAnnouncement(
    courseId: string,
    title: string,
    body: string,
  ): Promise<BbAnnouncement> {
    const res = await this.http.post<BbAnnouncement>(
      `/courses/${courseId}/announcements`,
      { title, body, availability: { duration: { type: 'Permanent' } } },
    );
    return res.data;
  }

  // ── Course Content ───────────────────────────────────────────────────────

  async getCourseContent(courseId: string, parentId?: string): Promise<BbContent[]> {
    const base = `/courses/${courseId}/contents`;
    const url = parentId ? `${base}/${parentId}/children` : base;
    const res = await this.http.get<{ results: BbContent[] }>(url, {
      params: { limit: 100 },
    });
    return res.data.results ?? [];
  }

  // ── Users / Enrollments ──────────────────────────────────────────────────

  async getEnrolledUsers(courseId: string): Promise<BbUser[]> {
    const res = await this.http.get<{ results: Array<{ userId: string; user?: BbUser }> }>(
      `/courses/${courseId}/users`,
      { params: { limit: 1000, fields: 'userId,user' } },
    );
    return (res.data.results ?? []).map((e) => e.user ?? ({ id: e.userId, userName: e.userId } as BbUser));
  }

  async getUser(userId: string): Promise<BbUser> {
    const res = await this.http.get<BbUser>(`/users/${userId}`);
    return res.data;
  }

  // ── Discussion Boards ────────────────────────────────────────────────────

  async getDiscussionPosts(courseId: string, threadId: string): Promise<BbDiscussionPost[]> {
    const res = await this.http.get<{ results: BbDiscussionPost[] }>(
      `/courses/${courseId}/discussions/${threadId}/posts`,
      { params: { limit: 200 } },
    );
    return res.data.results ?? [];
  }
}

export const bbClient = new BlackboardClient();
