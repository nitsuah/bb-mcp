#!/usr/bin/env node
/**
 * blackboard-learn-mcp — MCP server entry point
 *
 * Transport: HTTP Streamable (default, port 3100) or stdio (--stdio flag,
 * for Claude Desktop / Cursor integration).
 *
 * Extra HTTP endpoints (not MCP):
 *   GET /health   — liveness probe
 *   GET /metrics  — Prometheus text format
 */

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";
import http from "http";
import { getMetricsText, getMetricsSummary, pushMetrics } from "./metrics.js";
import { buildProviderManifest } from "./manifest.js";
import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import {
  buildDoctorReport,
  formatDoctorReport,
  formatProbeReport,
  formatToolCatalog,
  getCliHelpText,
  getManifestBaseUrl,
  parseCliCommand,
  runBlackboardProbe,
} from "./cli.js";
import {
  completeAuthorizationCodeFlow,
  getOAuthSession,
  startAuthorizationCodeFlow,
} from "./oauth.js";
import { isAuthorizedMcpRequest } from "./mcp-auth.js";

// ── Tool imports ─────────────────────────────────────────────────────────

import {
  GetMyCoursesInput,
  getMyCoursesHandler,
  getMyCoursesSchema,
  ListCoursesInput,
  listCoursesHandler,
  listCoursesSchema,
  GetUpcomingAssignmentsInput,
  getUpcomingAssignmentsHandler,
  getUpcomingAssignmentsSchema,
  GetMyGradesInput,
  getMyGradesHandler,
  getMyGradesSchema,
  GetCourseContentInput,
  getCourseContentHandler,
  getCourseContentSchema,
  GetCourseContentsInput,
  getCourseContentsHandler,
  getCourseContentsSchema,
  GetAssignmentFeedbackInput,
  getAssignmentFeedbackHandler,
  getAssignmentFeedbackSchema,
  GetAnnouncementsInput,
  getAnnouncementsHandler,
  getAnnouncementsSchema,
  CreateAssignmentSubmissionInput,
  createAssignmentSubmissionHandler,
  createAssignmentSubmissionSchema,
} from "./tools/student.js";

import {
  ListRosterInput,
  listRosterHandler,
  listRosterSchema,
  GetGradesInput,
  getGradesHandler,
  getGradesSchema,
  GetSubmissionStatusInput,
  getSubmissionStatusHandler,
  getSubmissionStatusSchema,
  GetGradeDistributionInput,
  getGradeDistributionHandler,
  getGradeDistributionSchema,
  GetDiscussionSummaryInput,
  getDiscussionSummaryHandler,
  getDiscussionSummarySchema,
  GetAtRiskStudentsInput,
  getAtRiskStudentsHandler,
  getAtRiskStudentsSchema,
  DraftAnnouncementInput,
  draftAnnouncementHandler,
  draftAnnouncementSchema,
} from "./tools/instructor.js";

import {
  SearchCourseMaterialsInput,
  searchCourseMaterialsHandler,
  searchCourseMaterialsSchema,
} from "./tools/shared.js";

import {
  ListUsersInput,
  listUsersHandler,
  listUsersSchema,
  GetUserInput,
  getUserHandler,
  getUserSchema,
  ListEnrollmentsInput,
  listEnrollmentsHandler,
  listEnrollmentsSchema,
  CreateEnrollmentInput,
  createEnrollmentHandler,
  createEnrollmentSchema,
  UpdateEnrollmentInput,
  updateEnrollmentHandler,
  updateEnrollmentSchema,
  DeleteEnrollmentInput,
  deleteEnrollmentHandler,
  deleteEnrollmentSchema,
  ListAuditLogsInput,
  listAuditLogsHandler,
  listAuditLogsSchema,
} from "./tools/admin.js";

import {
  GetMyChildrenInput,
  getMyChildrenHandler,
  getMyChildrenSchema,
  GetChildrenCoursesInput,
  getChildrenCoursesHandler,
  getChildrenCoursesSchema,
  GetChildrenGradesInput,
  getChildrenGradesHandler,
  getChildrenGradesSchema,
  GetChildrenUpcomingAssignmentsInput,
  getChildrenUpcomingAssignmentsHandler,
  getChildrenUpcomingAssignmentsSchema,
  GetChildrenAnnouncementsInput,
  getChildrenAnnouncementsHandler,
  getChildrenAnnouncementsSchema,
} from "./tools/parent.js";

import {
  CreateAssignmentInput,
  createAssignmentHandler,
  createAssignmentSchema,
  CreateGradeColumnInput,
  createGradeColumnHandler,
  createGradeColumnSchema,
  UpdateGradeInput,
  updateGradeHandler,
  updateGradeSchema,
  DeleteGradeInput,
  deleteGradeHandler,
  deleteGradeSchema,
  ExemptGradeInput,
  exemptGradeHandler,
  exemptGradeSchema,
  GetGradeColumnInput,
  getGradeColumnHandler,
  getGradeColumnSchema,
} from "./tools/grade-writeback.js";

import {
  ListWebhookSubscriptionsInput,
  listWebhookSubscriptionsHandler,
  listWebhookSubscriptionsSchema,
  GetWebhookSubscriptionInput,
  getWebhookSubscriptionHandler,
  getWebhookSubscriptionSchema,
  CreateWebhookSubscriptionInput,
  createWebhookSubscriptionHandler,
  createWebhookSubscriptionSchema,
  UpdateWebhookSubscriptionInput,
  updateWebhookSubscriptionHandler,
  updateWebhookSubscriptionSchema,
  DeleteWebhookSubscriptionInput,
  deleteWebhookSubscriptionHandler,
  deleteWebhookSubscriptionSchema,
} from "./tools/webhook-tools.js";

// ── MCP Server setup ──────────────────────────────────────────────────────

type ToolRegistration = {
  name: string;
  description: string;
  inputSchema: unknown;
  handler: (args: unknown) => unknown;
};

const TOOL_REGISTRATIONS: ToolRegistration[] = [
  // Student tools
  {
    name: getMyCoursesSchema.name,
    description: getMyCoursesSchema.description,
    inputSchema: GetMyCoursesInput.shape,
    handler: (args: unknown) =>
      getMyCoursesHandler(args as Parameters<typeof getMyCoursesHandler>[0]),
  },
  {
    name: listCoursesSchema.name,
    description: listCoursesSchema.description,
    inputSchema: ListCoursesInput.shape,
    handler: (args: unknown) =>
      listCoursesHandler(args as Parameters<typeof listCoursesHandler>[0]),
  },
  {
    name: getUpcomingAssignmentsSchema.name,
    description: getUpcomingAssignmentsSchema.description,
    inputSchema: GetUpcomingAssignmentsInput.shape,
    handler: (args: unknown) =>
      getUpcomingAssignmentsHandler(
        args as Parameters<typeof getUpcomingAssignmentsHandler>[0],
      ),
  },
  {
    name: getMyGradesSchema.name,
    description: getMyGradesSchema.description,
    inputSchema: GetMyGradesInput.shape,
    handler: (args: unknown) =>
      getMyGradesHandler(args as Parameters<typeof getMyGradesHandler>[0]),
  },
  {
    name: getCourseContentSchema.name,
    description: getCourseContentSchema.description,
    inputSchema: GetCourseContentInput.shape,
    handler: (args: unknown) =>
      getCourseContentHandler(
        args as Parameters<typeof getCourseContentHandler>[0],
      ),
  },
  {
    name: getCourseContentsSchema.name,
    description: getCourseContentsSchema.description,
    inputSchema: GetCourseContentsInput.shape,
    handler: (args: unknown) =>
      getCourseContentsHandler(
        args as Parameters<typeof getCourseContentsHandler>[0],
      ),
  },
  {
    name: getAssignmentFeedbackSchema.name,
    description: getAssignmentFeedbackSchema.description,
    inputSchema: GetAssignmentFeedbackInput.shape,
    handler: (args: unknown) =>
      getAssignmentFeedbackHandler(
        args as Parameters<typeof getAssignmentFeedbackHandler>[0],
      ),
  },
  {
    name: getAnnouncementsSchema.name,
    description: getAnnouncementsSchema.description,
    inputSchema: GetAnnouncementsInput.shape,
    handler: (args: unknown) =>
      getAnnouncementsHandler(
        args as Parameters<typeof getAnnouncementsHandler>[0],
      ),
  },
  {
    name: createAssignmentSubmissionSchema.name,
    description: createAssignmentSubmissionSchema.description,
    inputSchema: CreateAssignmentSubmissionInput.shape,
    handler: (args: unknown) =>
      createAssignmentSubmissionHandler(
        args as Parameters<typeof createAssignmentSubmissionHandler>[0],
      ),
  },

  // Instructor tools
  {
    name: listRosterSchema.name,
    description: listRosterSchema.description,
    inputSchema: ListRosterInput.shape,
    handler: (args: unknown) =>
      listRosterHandler(args as Parameters<typeof listRosterHandler>[0]),
  },
  {
    name: getGradesSchema.name,
    description: getGradesSchema.description,
    inputSchema: GetGradesInput.shape,
    handler: (args: unknown) =>
      getGradesHandler(args as Parameters<typeof getGradesHandler>[0]),
  },
  {
    name: getSubmissionStatusSchema.name,
    description: getSubmissionStatusSchema.description,
    inputSchema: GetSubmissionStatusInput.shape,
    handler: (args: unknown) =>
      getSubmissionStatusHandler(
        args as Parameters<typeof getSubmissionStatusHandler>[0],
      ),
  },
  {
    name: getGradeDistributionSchema.name,
    description: getGradeDistributionSchema.description,
    inputSchema: GetGradeDistributionInput.shape,
    handler: (args: unknown) =>
      getGradeDistributionHandler(
        args as Parameters<typeof getGradeDistributionHandler>[0],
      ),
  },
  {
    name: getDiscussionSummarySchema.name,
    description: getDiscussionSummarySchema.description,
    inputSchema: GetDiscussionSummaryInput.shape,
    handler: (args: unknown) =>
      getDiscussionSummaryHandler(
        args as Parameters<typeof getDiscussionSummaryHandler>[0],
      ),
  },
  {
    name: getAtRiskStudentsSchema.name,
    description: getAtRiskStudentsSchema.description,
    inputSchema: GetAtRiskStudentsInput.shape,
    handler: (args: unknown) =>
      getAtRiskStudentsHandler(
        args as Parameters<typeof getAtRiskStudentsHandler>[0],
      ),
  },
  {
    name: draftAnnouncementSchema.name,
    description: draftAnnouncementSchema.description,
    inputSchema: DraftAnnouncementInput.shape,
    handler: (args: unknown) =>
      draftAnnouncementHandler(
        args as Parameters<typeof draftAnnouncementHandler>[0],
      ),
  },

  // Shared tools
  {
    name: searchCourseMaterialsSchema.name,
    description: searchCourseMaterialsSchema.description,
    inputSchema: SearchCourseMaterialsInput.shape,
    handler: (args: unknown) =>
      searchCourseMaterialsHandler(
        args as Parameters<typeof searchCourseMaterialsHandler>[0],
      ),
  },

  // Admin tools
  {
    name: listUsersSchema.name,
    description: listUsersSchema.description,
    inputSchema: ListUsersInput.shape,
    handler: (args: unknown) =>
      listUsersHandler(args as Parameters<typeof listUsersHandler>[0]),
  },
  {
    name: getUserSchema.name,
    description: getUserSchema.description,
    inputSchema: GetUserInput.shape,
    handler: (args: unknown) =>
      getUserHandler(args as Parameters<typeof getUserHandler>[0]),
  },
  {
    name: listEnrollmentsSchema.name,
    description: listEnrollmentsSchema.description,
    inputSchema: ListEnrollmentsInput.shape,
    handler: (args: unknown) =>
      listEnrollmentsHandler(
        args as Parameters<typeof listEnrollmentsHandler>[0],
      ),
  },
  {
    name: createEnrollmentSchema.name,
    description: createEnrollmentSchema.description,
    inputSchema: CreateEnrollmentInput.shape,
    handler: (args: unknown) =>
      createEnrollmentHandler(
        args as Parameters<typeof createEnrollmentHandler>[0],
      ),
  },
  {
    name: updateEnrollmentSchema.name,
    description: updateEnrollmentSchema.description,
    inputSchema: UpdateEnrollmentInput.shape,
    handler: (args: unknown) =>
      updateEnrollmentHandler(
        args as Parameters<typeof updateEnrollmentHandler>[0],
      ),
  },
  {
    name: deleteEnrollmentSchema.name,
    description: deleteEnrollmentSchema.description,
    inputSchema: DeleteEnrollmentInput.shape,
    handler: (args: unknown) =>
      deleteEnrollmentHandler(
        args as Parameters<typeof deleteEnrollmentHandler>[0],
      ),
  },
  {
    name: listAuditLogsSchema.name,
    description: listAuditLogsSchema.description,
    inputSchema: ListAuditLogsInput.shape,
    handler: (args: unknown) =>
      listAuditLogsHandler(args as Parameters<typeof listAuditLogsHandler>[0]),
  },

  // Parent tools
  {
    name: getMyChildrenSchema.name,
    description: getMyChildrenSchema.description,
    inputSchema: GetMyChildrenInput.shape,
    handler: (args: unknown) =>
      getMyChildrenHandler(args as Parameters<typeof getMyChildrenHandler>[0]),
  },
  {
    name: getChildrenCoursesSchema.name,
    description: getChildrenCoursesSchema.description,
    inputSchema: GetChildrenCoursesInput.shape,
    handler: (args: unknown) =>
      getChildrenCoursesHandler(
        args as Parameters<typeof getChildrenCoursesHandler>[0],
      ),
  },
  {
    name: getChildrenGradesSchema.name,
    description: getChildrenGradesSchema.description,
    inputSchema: GetChildrenGradesInput.shape,
    handler: (args: unknown) =>
      getChildrenGradesHandler(
        args as Parameters<typeof getChildrenGradesHandler>[0],
      ),
  },
  {
    name: getChildrenUpcomingAssignmentsSchema.name,
    description: getChildrenUpcomingAssignmentsSchema.description,
    inputSchema: GetChildrenUpcomingAssignmentsInput.shape,
    handler: (args: unknown) =>
      getChildrenUpcomingAssignmentsHandler(
        args as Parameters<typeof getChildrenUpcomingAssignmentsHandler>[0],
      ),
  },
  {
    name: getChildrenAnnouncementsSchema.name,
    description: getChildrenAnnouncementsSchema.description,
    inputSchema: GetChildrenAnnouncementsInput.shape,
    handler: (args: unknown) =>
      getChildrenAnnouncementsHandler(
        args as Parameters<typeof getChildrenAnnouncementsHandler>[0],
      ),
  },

  // Grade write-back tools
  {
    name: createAssignmentSchema.name,
    description: createAssignmentSchema.description,
    inputSchema: CreateAssignmentInput.shape,
    handler: (args: unknown) =>
      createAssignmentHandler(
        args as Parameters<typeof createAssignmentHandler>[0],
      ),
  },
  {
    name: createGradeColumnSchema.name,
    description: createGradeColumnSchema.description,
    inputSchema: CreateGradeColumnInput.shape,
    handler: (args: unknown) =>
      createGradeColumnHandler(
        args as Parameters<typeof createGradeColumnHandler>[0],
      ),
  },
  {
    name: updateGradeSchema.name,
    description: updateGradeSchema.description,
    inputSchema: UpdateGradeInput.shape,
    handler: (args: unknown) =>
      updateGradeHandler(args as Parameters<typeof updateGradeHandler>[0]),
  },
  {
    name: deleteGradeSchema.name,
    description: deleteGradeSchema.description,
    inputSchema: DeleteGradeInput.shape,
    handler: (args: unknown) =>
      deleteGradeHandler(args as Parameters<typeof deleteGradeHandler>[0]),
  },
  {
    name: exemptGradeSchema.name,
    description: exemptGradeSchema.description,
    inputSchema: ExemptGradeInput.shape,
    handler: (args: unknown) =>
      exemptGradeHandler(args as Parameters<typeof exemptGradeHandler>[0]),
  },
  {
    name: getGradeColumnSchema.name,
    description: getGradeColumnSchema.description,
    inputSchema: GetGradeColumnInput.shape,
    handler: (args: unknown) =>
      getGradeColumnHandler(
        args as Parameters<typeof getGradeColumnHandler>[0],
      ),
  },

  // Webhook tools
  {
    name: listWebhookSubscriptionsSchema.name,
    description: listWebhookSubscriptionsSchema.description,
    inputSchema: ListWebhookSubscriptionsInput.shape,
    handler: (args: unknown) =>
      listWebhookSubscriptionsHandler(
        args as Parameters<typeof listWebhookSubscriptionsHandler>[0],
      ),
  },
  {
    name: getWebhookSubscriptionSchema.name,
    description: getWebhookSubscriptionSchema.description,
    inputSchema: GetWebhookSubscriptionInput.shape,
    handler: (args: unknown) =>
      getWebhookSubscriptionHandler(
        args as Parameters<typeof getWebhookSubscriptionHandler>[0],
      ),
  },
  {
    name: createWebhookSubscriptionSchema.name,
    description: createWebhookSubscriptionSchema.description,
    inputSchema: CreateWebhookSubscriptionInput.shape,
    handler: (args: unknown) =>
      createWebhookSubscriptionHandler(
        args as Parameters<typeof createWebhookSubscriptionHandler>[0],
      ),
  },
  {
    name: updateWebhookSubscriptionSchema.name,
    description: updateWebhookSubscriptionSchema.description,
    inputSchema: UpdateWebhookSubscriptionInput.shape,
    handler: (args: unknown) =>
      updateWebhookSubscriptionHandler(
        args as Parameters<typeof updateWebhookSubscriptionHandler>[0],
      ),
  },
  {
    name: deleteWebhookSubscriptionSchema.name,
    description: deleteWebhookSubscriptionSchema.description,
    inputSchema: DeleteWebhookSubscriptionInput.shape,
    handler: (args: unknown) =>
      deleteWebhookSubscriptionHandler(
        args as Parameters<typeof deleteWebhookSubscriptionHandler>[0],
      ),
  },
];

function buildServer(): McpServer {
  // SDK typing changed and is stricter than the JSON-schema shape used below.
  // Keep runtime behavior intact by using a compatibility cast at the server boundary.
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  }) as McpServer & {
    tool: (
      name: string,
      description: string,
      inputSchema: unknown,
      handler: (args: unknown) => unknown,
    ) => void;
    resource: (
      name: string,
      uriTemplate: string,
      handler: (uri: { pathname: string; href: string }) => Promise<unknown>,
    ) => void;
  };

  for (const tool of TOOL_REGISTRATIONS) {
    server.tool(tool.name, tool.description, tool.inputSchema, tool.handler);
  }

  // MCP Resource: course://[courseId]
  server.resource("course", "course://{courseId}", async (uri) => {
    const courseId = uri.pathname.replace(/^\/+/, "");
    const { bbClient } = await import("./bb-client.js");
    const course = await bbClient.getCourse(courseId);
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(course, null, 2),
          mimeType: "application/json",
        },
      ],
    };
  });

  return server;
}

// ── Helper: parse raw HTTP body ───────────────────────────────────────────

function chunkText(text: string, maxChunkSize = 600): string[] {
  if (!text) {
    return [""];
  }

  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += maxChunkSize) {
    chunks.push(text.slice(index, index + maxChunkSize));
  }
  return chunks;
}

function writeSseEvent(
  res: http.ServerResponse,
  event: string,
  payload: Record<string, unknown>,
): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function isTruthy(value: string | null): boolean {
  if (!value) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

// ── HTTP mode (default) ───────────────────────────────────────────────────

async function startHttpServer(): Promise<void> {
  const { config } = await import("./config.js");

  if (!config.security.mcpApiKey) {
    console.warn(
      "WARNING: MCP_API_KEY is not set. The /mcp endpoint accepts requests " +
        "from anyone who can reach this port with no credential check, and " +
        "every tool call trusts whatever caller_identity (userId, role, " +
        "ferpa_authorized) the request supplies. Set MCP_API_KEY before " +
        "exposing this server beyond localhost.",
    );
  }

  // Per-session transports (stateful SSE / streamable HTTP)
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(
      req.url ?? "/",
      `http://localhost:${config.server.port}`,
    );

    // ── Health ──
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          name: SERVER_NAME,
          version: SERVER_VERSION,
          uptime: process.uptime(),
          metrics: getMetricsSummary(),
        }),
      );
      return;
    }

    // ── Prometheus metrics ──
    if (req.method === "GET" && url.pathname === "/metrics") {
      res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4" });
      res.end(getMetricsText());
      return;
    }

    // ── Provider manifest ──
    if (req.method === "GET" && url.pathname === "/manifest") {
      const baseUrl =
        config.server.publicBaseUrl ?? `http://localhost:${config.server.port}`;
      const manifest = buildProviderManifest(baseUrl);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(manifest));
      return;
    }

    // ── OAuth authorization code flow ──
    if (req.method === "GET" && url.pathname === "/oauth/authorize") {
      const flow = startAuthorizationCodeFlow();
      const format = url.searchParams.get("format");

      if (format === "json") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            authorizationUrl: flow.authorizationUrl,
            state: flow.state,
            redirectUri: flow.redirectUri,
          }),
        );
        return;
      }

      res.writeHead(302, { Location: flow.authorizationUrl });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/oauth/callback") {
      const error = url.searchParams.get("error");
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");

      if (error) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error,
            message: "OAuth authorization was denied by the provider.",
          }),
        );
        return;
      }

      if (!code || !state) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "invalid_request",
            message: "Missing OAuth code or state.",
          }),
        );
        return;
      }

      try {
        const session = await completeAuthorizationCodeFlow({ code, state });
        const stored = getOAuthSession(session.sessionId);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            sessionId: session.sessionId,
            tokenType: stored?.token.tokenType ?? session.token.tokenType,
            expiresAt: stored?.token.expiresAt ?? session.token.expiresAt,
            scope: stored?.token.scope ?? session.token.scope,
            refreshable: Boolean(
              stored?.token.refreshToken ?? session.token.refreshToken,
            ),
          }),
        );
      } catch (oauthError) {
        const message =
          oauthError instanceof Error ? oauthError.message : String(oauthError);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "oauth_exchange_failed", message }));
      }

      return;
    }

    // ── Dedicated SSE endpoint: search_course_materials ──
    if (
      req.method === "GET" &&
      url.pathname === "/sse/search-course-materials"
    ) {
      const query = url.searchParams.get("query")?.trim();
      if (!query) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Missing required query parameter: query",
            example:
              "/sse/search-course-materials?query=syllabus&userId=student-1&role=student",
          }),
        );
        return;
      }

      const roleRaw = (url.searchParams.get("role") ?? "student").toLowerCase();
      const role =
        roleRaw === "instructor" || roleRaw === "admin" ? roleRaw : "student";

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      });

      writeSseEvent(res, "start", {
        tool: "search_course_materials",
        query,
        role,
      });

      try {
        writeSseEvent(res, "status", { step: "authorizing" });

        const result = await searchCourseMaterialsHandler({
          caller_identity: {
            userId: url.searchParams.get("userId") ?? "sse-user",
            role,
            ferpa_authorized: isTruthy(
              url.searchParams.get("ferpa_authorized"),
            ),
            clientApp: url.searchParams.get("clientApp") ?? "bb-mcp-sse",
          },
          query,
          courseId: url.searchParams.get("courseId") ?? undefined,
        });

        const textResult =
          result.content[0]?.type === "text"
            ? result.content[0].text
            : JSON.stringify(result);

        const chunks = chunkText(textResult);
        writeSseEvent(res, "status", {
          step: "streaming",
          chunks: chunks.length,
        });

        chunks.forEach((chunk, index) => {
          writeSseEvent(res, "chunk", {
            index,
            total: chunks.length,
            text: chunk,
          });
        });

        writeSseEvent(res, "complete", {
          success: true,
          chunks: chunks.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        writeSseEvent(res, "error", {
          success: false,
          message,
        });
      }

      res.end();
      return;
    }

    // ── MCP endpoint ──
    if (url.pathname === "/mcp") {
      if (!isAuthorizedMcpRequest(req, config.security.mcpApiKey)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "unauthorized",
            message:
              "Missing or invalid Authorization: Bearer <MCP_API_KEY> header.",
          }),
        );
        return;
      }

      // GET → SSE stream for existing session
      if (req.method === "GET") {
        const sessionId = url.searchParams.get("sessionId");
        if (!sessionId || !transports.has(sessionId)) {
          res.writeHead(404);
          res.end("Session not found");
          return;
        }
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res);
        return;
      }

      // DELETE → cleanup session
      if (req.method === "DELETE") {
        const sessionId = url.searchParams.get("sessionId");
        if (sessionId && transports.has(sessionId)) {
          transports.delete(sessionId);
        }
        res.writeHead(200);
        res.end("OK");
        return;
      }

      // POST → new session or message on existing session
      if (req.method === "POST") {
        const sessionId =
          url.searchParams.get("sessionId") ??
          (req.headers["mcp-session-id"] as string | undefined);

        if (sessionId && transports.has(sessionId)) {
          // Existing session
          const transport = transports.get(sessionId)!;
          await transport.handleRequest(req, res);
          return;
        }

        // New session
        const newSessionId = randomUUID();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => newSessionId,
          onsessioninitialized: (id) => {
            transports.set(id, transport);
          },
        });

        transport.onclose = () => {
          transports.delete(newSessionId);
        };

        const mcpServer = buildServer();
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res);
        return;
      }

      res.writeHead(405);
      res.end("Method Not Allowed");
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  httpServer.listen(config.server.port, () => {
    console.log(
      `blackboard-learn-mcp HTTP server listening on port ${config.server.port}`,
    );
    console.log(`  MCP endpoint : http://localhost:${config.server.port}/mcp`);
    console.log(
      `  Health       : http://localhost:${config.server.port}/health`,
    );
    console.log(
      `  Metrics      : http://localhost:${config.server.port}/metrics`,
    );
    console.log(
      `  Manifest     : http://localhost:${config.server.port}/manifest`,
    );
  });

  // Push metrics every 60s if configured
  if (config.metrics.pushUrl) {
    setInterval(() => void pushMetrics(), 60_000);
  }
}

// ── stdio mode (Claude Desktop, Cursor) ──────────────────────────────────

async function startStdioServer(): Promise<void> {
  await import("./config.js");
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// ── Entrypoint ────────────────────────────────────────────────────────────

const command = parseCliCommand(process.argv.slice(2));

switch (command.mode) {
  case "help":
    console.log(getCliHelpText());
    break;
  case "version":
    console.log(`${SERVER_NAME} v${SERVER_VERSION}`);
    break;
  case "manifest": {
    const manifest = buildProviderManifest(getManifestBaseUrl(command.baseUrl));
    console.log(JSON.stringify(manifest, null, command.json ? 2 : 0));
    break;
  }
  case "tools": {
    if (command.json) {
      const manifest = buildProviderManifest(
        getManifestBaseUrl(command.baseUrl),
      );
      console.log(JSON.stringify(manifest.tools, null, 2));
    } else {
      console.log(formatToolCatalog(command.baseUrl));
    }
    break;
  }
  case "doctor": {
    const report = buildDoctorReport();
    if (command.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatDoctorReport(report));
    }
    break;
  }
  case "probe": {
    const report = await runBlackboardProbe();
    if (command.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatProbeReport(report));
    }

    if (!report.blackboard.api) {
      process.exitCode = 1;
    }
    break;
  }
  case "server": {
    const runner = command.useStdio ? startStdioServer : startHttpServer;
    runner().catch((err) => {
      console.error("Fatal:", err);
      process.exit(1);
    });
    break;
  }
}
