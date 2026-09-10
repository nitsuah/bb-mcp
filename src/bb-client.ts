/**
 * Blackboard Learn REST API client.
 *
 * Handles OAuth 2.0 client_credentials token lifecycle automatically.
 * All methods throw on non-2xx responses with a descriptive error message.
 *
 * Blackboard Learn REST API docs:
 *   https://developer.blackboard.com/portal/displayApi
 */

import axios, { AxiosInstance, AxiosError } from "axios";
import { config } from "./config.js";
import { noteUpstreamCall } from "./trace.js";
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
} from "./types.js";

export interface BbAttemptUpdatePayload {
  score?: number;
  feedback?: string;
  instructorNotes?: string;
  status?: string;
}

/**
 * Coarse-grained classification of a Blackboard REST failure, derived from
 * the HTTP status code. Lets callers (and tests) branch on failure kind
 * without parsing the mapped message string.
 */
export type BbErrorCategory =
  | "invalid_request"
  | "authentication"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "server_error"
  | "network_error"
  | "unknown";

function categorizeBbStatus(status: number): BbErrorCategory {
  if (status === 0) return "network_error";
  if (status === 400 || status === 422) return "invalid_request";
  if (status === 401) return "authentication";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "unknown";
}

const BB_ERROR_CATEGORY_PREFIX: Record<BbErrorCategory, string> = {
  invalid_request: "Blackboard rejected this request as invalid",
  authentication:
    "Blackboard authentication failed — check BB_CLIENT_ID/BB_CLIENT_SECRET or that the cached OAuth token hasn't been revoked",
  forbidden: "Blackboard denied this request",
  not_found: "Blackboard could not find the requested resource",
  conflict:
    "Blackboard rejected this request due to a conflict with existing data",
  rate_limited:
    "Blackboard rate-limited this request — retry after a short delay",
  server_error: "Blackboard is experiencing a server-side error",
  network_error:
    "Could not reach Blackboard (network error, DNS failure, or timeout)",
  unknown: "Blackboard API error",
};

/**
 * Builds a clear, categorized message on top of whatever raw detail
 * Blackboard (or axios, for a transport-level failure) supplied — raw
 * Blackboard REST errors are often a bare `{ message: "..." }` with no
 * indication of what kind of failure occurred or whether retrying makes
 * sense. The original detail is preserved (not replaced) so nothing useful
 * is lost, just given context.
 */
function mapBbErrorMessage(
  status: number,
  category: BbErrorCategory,
  rawDetail: string,
): string {
  const prefix = BB_ERROR_CATEGORY_PREFIX[category];
  return status > 0
    ? `${prefix} (HTTP ${status}): ${rawDetail}`
    : `${prefix}: ${rawDetail}`;
}

export class BbApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
    public category: BbErrorCategory = "unknown",
  ) {
    super(message);
    this.name = "BbApiError";
  }
}

export class BlackboardClient {
  private http: AxiosInstance;
  private tokenCache: TokenCache | null = null;

  constructor() {
    this.http = axios.create({
      baseURL: `${config.bb.baseUrl}/learn/api/public/v1`,
      timeout: 15_000,
      headers: { "Content-Type": "application/json" },
    });

    // Inject auth token on every request, and count it against the current
    // tool call's trace (see trace.ts) for per-request lifecycle tracing —
    // a no-op outside an active traced tool call.
    this.http.interceptors.request.use(async (req) => {
      const token = await this.getAccessToken();
      req.headers.Authorization = `Bearer ${token}`;
      noteUpstreamCall();
      return req;
    });

    // Map Blackboard API errors to BbApiError with a clear, categorized
    // message — see mapBbErrorMessage above.
    this.http.interceptors.response.use(
      (r) => r,
      (err: AxiosError) => {
        const status = err.response?.status ?? 0;
        const data = err.response?.data;
        const rawDetail =
          (data as Record<string, string> | undefined)?.message ??
          err.message ??
          "Blackboard API error";
        const category = categorizeBbStatus(status);
        throw new BbApiError(
          mapBbErrorMessage(status, category, rawDetail),
          status,
          data,
          category,
        );
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
    params.set("grant_type", "client_credentials");

    const res = await axios.post<{ access_token: string; expires_in: number }>(
      `${config.bb.baseUrl}/learn/api/public/v1/oauth2/token`,
      params.toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
    const url = userId ? `/users/${userId}/courses` : "/courses";
    const res = await this.http.get<{ results: BbCourse[] }>(url, {
      params: {
        limit: 100,
        fields: "id,courseId,name,description,term,availability,enrollment",
      },
    });
    return res.data.results ?? [];
  }

  async probeConnectivity(): Promise<number> {
    const res = await this.http.get<{ results: BbCourse[] }>("/courses", {
      params: { limit: 1, fields: "id" },
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

  async getColumnGrades(
    courseId: string,
    columnId: string,
  ): Promise<BbGrade[]> {
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
    extra?: BbAttemptUpdatePayload,
  ): Promise<BbAttempt> {
    const payload: Record<string, unknown> = { userId, ...extra };
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
      { title, body, availability: { duration: { type: "Permanent" } } },
    );
    return res.data;
  }

  // ── Course Content ───────────────────────────────────────────────────────

  async getCourseContent(
    courseId: string,
    parentId?: string,
  ): Promise<BbContent[]> {
    const base = `/courses/${courseId}/contents`;
    const url = parentId ? `${base}/${parentId}/children` : base;
    const res = await this.http.get<{ results: BbContent[] }>(url, {
      params: { limit: 100 },
    });
    return res.data.results ?? [];
  }

  // ── Users / Enrollments ──────────────────────────────────────────────────

  async getEnrolledUsers(courseId: string): Promise<BbUser[]> {
    const res = await this.http.get<{
      results: Array<{ userId: string; user?: BbUser }>;
    }>(`/courses/${courseId}/users`, {
      params: { limit: 1000, fields: "userId,user" },
    });
    return (res.data.results ?? []).map(
      (e) => e.user ?? ({ id: e.userId, userName: e.userId } as BbUser),
    );
  }

  async getUser(userId: string): Promise<BbUser> {
    const res = await this.http.get<BbUser>(`/users/${userId}`);
    return res.data;
  }

  /**
   * Single-record course-membership lookup, used to verify a caller claiming
   * role=instructor is actually entitled in a specific course before any
   * grade-writeback call (see auth.ts's checkCourseEntitlement) — distinct
   * from getEnrolledUsers, which pages the whole roster and is unsuited to a
   * per-request authorization check. Returns null (not enrolled) rather than
   * throwing on a 404, since "not a member of this course" is an expected,
   * non-exceptional outcome here.
   */
  async getCourseMembership(
    courseId: string,
    userId: string,
  ): Promise<{ userId: string; courseRoleId: string } | null> {
    try {
      const res = await this.http.get<{
        userId: string;
        courseRoleId: string;
      }>(`/courses/${courseId}/users/${userId}`, {
        params: { fields: "userId,courseRoleId" },
      });
      return res.data;
    } catch (error) {
      if (error instanceof BbApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // ── Discussion Boards ────────────────────────────────────────────────────

  async getDiscussionPosts(
    courseId: string,
    threadId: string,
  ): Promise<BbDiscussionPost[]> {
    const res = await this.http.get<{ results: BbDiscussionPost[] }>(
      `/courses/${courseId}/discussions/${threadId}/posts`,
      { params: { limit: 200 } },
    );
    return res.data.results ?? [];
  }

  // ── Generic HTTP methods for admin/webhook tools ────────────────────────────

  async get<T>(
    url: string,
    options?: { params?: Record<string, unknown> },
  ): Promise<{ data: T }> {
    const res = await this.http.get<T>(url, { params: options?.params });
    return { data: res.data };
  }

  async post<T>(url: string, data: unknown): Promise<{ data: T }> {
    const res = await this.http.post<T>(url, data);
    return { data: res.data };
  }

  async patch<T>(url: string, data: unknown): Promise<{ data: T }> {
    const res = await this.http.patch<T>(url, data);
    return { data: res.data };
  }

  async delete<T>(url: string): Promise<{ data: T }> {
    const res = await this.http.delete<T>(url);
    return { data: res.data };
  }

  // ── Grade attempt management ───────────────────────────────────────────────

  async updateAttempt(
    courseId: string,
    columnId: string,
    attemptId: string,
    payload: BbAttemptUpdatePayload,
  ): Promise<BbAttempt> {
    const res = await this.http.patch<BbAttempt>(
      `/courses/${courseId}/gradebook/columns/${columnId}/attempts/${attemptId}`,
      payload,
    );
    return res.data;
  }

  async deleteAttempt(
    courseId: string,
    columnId: string,
    attemptId: string,
  ): Promise<void> {
    await this.http.delete(
      `/courses/${courseId}/gradebook/columns/${columnId}/attempts/${attemptId}`,
    );
  }
}

export const bbClient = new BlackboardClient();
