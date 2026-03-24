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

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import http from 'http';
import { config } from './config.js';
import { getMetricsText, getMetricsSummary, pushMetrics } from './metrics.js';

// ── Tool imports ─────────────────────────────────────────────────────────

import {
  getMyCoursesHandler,
  getMyCoursesSchema,
  getUpcomingAssignmentsHandler,
  getUpcomingAssignmentsSchema,
  getMyGradesHandler,
  getMyGradesSchema,
  getCourseContentHandler,
  getCourseContentSchema,
  getAssignmentFeedbackHandler,
  getAssignmentFeedbackSchema,
  getAnnouncementsHandler,
  getAnnouncementsSchema,
} from './tools/student.js';

import {
  getSubmissionStatusHandler,
  getSubmissionStatusSchema,
  getGradeDistributionHandler,
  getGradeDistributionSchema,
  getDiscussionSummaryHandler,
  getDiscussionSummarySchema,
  getAtRiskStudentsHandler,
  getAtRiskStudentsSchema,
  draftAnnouncementHandler,
  draftAnnouncementSchema,
} from './tools/instructor.js';

import {
  searchCourseMaterialsHandler,
  searchCourseMaterialsSchema,
} from './tools/shared.js';

// ── MCP Server setup ──────────────────────────────────────────────────────

function buildServer(): McpServer {
  const server = new McpServer({
    name: 'blackboard-learn-mcp',
    version: '0.1.0',
  });

  // Student tools
  server.tool(
    getMyCoursesSchema.name,
    getMyCoursesSchema.description,
    getMyCoursesSchema.inputSchema as Parameters<typeof server.tool>[2],
    (args) => getMyCoursesHandler(args as Parameters<typeof getMyCoursesHandler>[0]),
  );

  server.tool(
    getUpcomingAssignmentsSchema.name,
    getUpcomingAssignmentsSchema.description,
    getUpcomingAssignmentsSchema.inputSchema as Parameters<typeof server.tool>[2],
    (args) =>
      getUpcomingAssignmentsHandler(
        args as Parameters<typeof getUpcomingAssignmentsHandler>[0],
      ),
  );

  server.tool(
    getMyGradesSchema.name,
    getMyGradesSchema.description,
    getMyGradesSchema.inputSchema as Parameters<typeof server.tool>[2],
    (args) => getMyGradesHandler(args as Parameters<typeof getMyGradesHandler>[0]),
  );

  server.tool(
    getCourseContentSchema.name,
    getCourseContentSchema.description,
    getCourseContentSchema.inputSchema as Parameters<typeof server.tool>[2],
    (args) =>
      getCourseContentHandler(args as Parameters<typeof getCourseContentHandler>[0]),
  );

  server.tool(
    getAssignmentFeedbackSchema.name,
    getAssignmentFeedbackSchema.description,
    getAssignmentFeedbackSchema.inputSchema as Parameters<typeof server.tool>[2],
    (args) =>
      getAssignmentFeedbackHandler(
        args as Parameters<typeof getAssignmentFeedbackHandler>[0],
      ),
  );

  server.tool(
    getAnnouncementsSchema.name,
    getAnnouncementsSchema.description,
    getAnnouncementsSchema.inputSchema as Parameters<typeof server.tool>[2],
    (args) => getAnnouncementsHandler(args as Parameters<typeof getAnnouncementsHandler>[0]),
  );

  // Instructor tools
  server.tool(
    getSubmissionStatusSchema.name,
    getSubmissionStatusSchema.description,
    getSubmissionStatusSchema.inputSchema as Parameters<typeof server.tool>[2],
    (args) =>
      getSubmissionStatusHandler(args as Parameters<typeof getSubmissionStatusHandler>[0]),
  );

  server.tool(
    getGradeDistributionSchema.name,
    getGradeDistributionSchema.description,
    getGradeDistributionSchema.inputSchema as Parameters<typeof server.tool>[2],
    (args) =>
      getGradeDistributionHandler(
        args as Parameters<typeof getGradeDistributionHandler>[0],
      ),
  );

  server.tool(
    getDiscussionSummarySchema.name,
    getDiscussionSummarySchema.description,
    getDiscussionSummarySchema.inputSchema as Parameters<typeof server.tool>[2],
    (args) =>
      getDiscussionSummaryHandler(
        args as Parameters<typeof getDiscussionSummaryHandler>[0],
      ),
  );

  server.tool(
    getAtRiskStudentsSchema.name,
    getAtRiskStudentsSchema.description,
    getAtRiskStudentsSchema.inputSchema as Parameters<typeof server.tool>[2],
    (args) =>
      getAtRiskStudentsHandler(args as Parameters<typeof getAtRiskStudentsHandler>[0]),
  );

  server.tool(
    draftAnnouncementSchema.name,
    draftAnnouncementSchema.description,
    draftAnnouncementSchema.inputSchema as Parameters<typeof server.tool>[2],
    (args) =>
      draftAnnouncementHandler(args as Parameters<typeof draftAnnouncementHandler>[0]),
  );

  // Shared tools
  server.tool(
    searchCourseMaterialsSchema.name,
    searchCourseMaterialsSchema.description,
    searchCourseMaterialsSchema.inputSchema as Parameters<typeof server.tool>[2],
    (args) =>
      searchCourseMaterialsHandler(
        args as Parameters<typeof searchCourseMaterialsHandler>[0],
      ),
  );

  // MCP Resource: course://[courseId]
  server.resource('course', 'course://{courseId}', async (uri) => {
    const courseId = uri.pathname.replace(/^\/+/, '');
    const { bbClient } = await import('./bb-client.js');
    const course = await bbClient.getCourse(courseId);
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(course, null, 2),
          mimeType: 'application/json',
        },
      ],
    };
  });

  return server;
}

// ── Helper: parse raw HTTP body ───────────────────────────────────────────

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// ── HTTP mode (default) ───────────────────────────────────────────────────

async function startHttpServer(): Promise<void> {
  const server = buildServer();

  // Per-session transports (stateful SSE / streamable HTTP)
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${config.server.port}`);

    // ── Health ──
    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          name: 'blackboard-learn-mcp',
          version: '0.1.0',
          uptime: process.uptime(),
          metrics: getMetricsSummary(),
        }),
      );
      return;
    }

    // ── Prometheus metrics ──
    if (req.method === 'GET' && url.pathname === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
      res.end(getMetricsText());
      return;
    }

    // ── MCP endpoint ──
    if (url.pathname === '/mcp') {
      // GET → SSE stream for existing session
      if (req.method === 'GET') {
        const sessionId = url.searchParams.get('sessionId');
        if (!sessionId || !transports.has(sessionId)) {
          res.writeHead(404);
          res.end('Session not found');
          return;
        }
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res);
        return;
      }

      // DELETE → cleanup session
      if (req.method === 'DELETE') {
        const sessionId = url.searchParams.get('sessionId');
        if (sessionId && transports.has(sessionId)) {
          transports.delete(sessionId);
        }
        res.writeHead(200);
        res.end('OK');
        return;
      }

      // POST → new session or message on existing session
      if (req.method === 'POST') {
        const sessionId = url.searchParams.get('sessionId') ?? req.headers['mcp-session-id'] as string | undefined;

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
      res.end('Method Not Allowed');
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  httpServer.listen(config.server.port, () => {
    console.log(`blackboard-learn-mcp HTTP server listening on port ${config.server.port}`);
    console.log(`  MCP endpoint : http://localhost:${config.server.port}/mcp`);
    console.log(`  Health       : http://localhost:${config.server.port}/health`);
    console.log(`  Metrics      : http://localhost:${config.server.port}/metrics`);
  });

  // Push metrics every 60s if configured
  if (config.metrics.pushUrl) {
    setInterval(() => void pushMetrics(), 60_000);
  }
}

// ── stdio mode (Claude Desktop, Cursor) ──────────────────────────────────

async function startStdioServer(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// ── Entrypoint ────────────────────────────────────────────────────────────

const useStdio = process.argv.includes('--stdio');
if (useStdio) {
  startStdioServer().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
} else {
  startHttpServer().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
