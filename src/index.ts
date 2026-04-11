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
import { getMetricsText, getMetricsSummary, pushMetrics } from './metrics.js';
import { buildProviderManifest } from './manifest.js';
import { SERVER_NAME, SERVER_VERSION } from './constants.js';
import {
  buildDoctorReport,
  formatDoctorReport,
  formatProbeReport,
  formatToolCatalog,
  getCliHelpText,
  getManifestBaseUrl,
  parseCliCommand,
  runBlackboardProbe,
} from './cli.js';

// ── Tool imports ─────────────────────────────────────────────────────────

import {
  GetMyCoursesInput,
  getMyCoursesHandler,
  getMyCoursesSchema,
  GetUpcomingAssignmentsInput,
  getUpcomingAssignmentsHandler,
  getUpcomingAssignmentsSchema,
  GetMyGradesInput,
  getMyGradesHandler,
  getMyGradesSchema,
  GetCourseContentInput,
  getCourseContentHandler,
  getCourseContentSchema,
  GetAssignmentFeedbackInput,
  getAssignmentFeedbackHandler,
  getAssignmentFeedbackSchema,
  GetAnnouncementsInput,
  getAnnouncementsHandler,
  getAnnouncementsSchema,
} from './tools/student.js';

import {
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
} from './tools/instructor.js';

import {
  SearchCourseMaterialsInput,
  searchCourseMaterialsHandler,
  searchCourseMaterialsSchema,
} from './tools/shared.js';

// ── MCP Server setup ──────────────────────────────────────────────────────

function buildServer(): McpServer {
  // SDK typing changed and is stricter than the JSON-schema shape used below.
  // Keep runtime behavior intact by using a compatibility cast at the server boundary.
  const server: any = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Student tools
  server.tool(
    getMyCoursesSchema.name,
    getMyCoursesSchema.description,
    GetMyCoursesInput.shape,
    (args: any) => getMyCoursesHandler(args as Parameters<typeof getMyCoursesHandler>[0]),
  );

  server.tool(
    getUpcomingAssignmentsSchema.name,
    getUpcomingAssignmentsSchema.description,
    GetUpcomingAssignmentsInput.shape,
    (args: any) =>
      getUpcomingAssignmentsHandler(
        args as Parameters<typeof getUpcomingAssignmentsHandler>[0],
      ),
  );

  server.tool(
    getMyGradesSchema.name,
    getMyGradesSchema.description,
    GetMyGradesInput.shape,
    (args: any) => getMyGradesHandler(args as Parameters<typeof getMyGradesHandler>[0]),
  );

  server.tool(
    getCourseContentSchema.name,
    getCourseContentSchema.description,
    GetCourseContentInput.shape,
    (args: any) =>
      getCourseContentHandler(args as Parameters<typeof getCourseContentHandler>[0]),
  );

  server.tool(
    getAssignmentFeedbackSchema.name,
    getAssignmentFeedbackSchema.description,
    GetAssignmentFeedbackInput.shape,
    (args: any) =>
      getAssignmentFeedbackHandler(
        args as Parameters<typeof getAssignmentFeedbackHandler>[0],
      ),
  );

  server.tool(
    getAnnouncementsSchema.name,
    getAnnouncementsSchema.description,
    GetAnnouncementsInput.shape,
    (args: any) => getAnnouncementsHandler(args as Parameters<typeof getAnnouncementsHandler>[0]),
  );

  // Instructor tools
  server.tool(
    getSubmissionStatusSchema.name,
    getSubmissionStatusSchema.description,
    GetSubmissionStatusInput.shape,
    (args: any) =>
      getSubmissionStatusHandler(args as Parameters<typeof getSubmissionStatusHandler>[0]),
  );

  server.tool(
    getGradeDistributionSchema.name,
    getGradeDistributionSchema.description,
    GetGradeDistributionInput.shape,
    (args: any) =>
      getGradeDistributionHandler(
        args as Parameters<typeof getGradeDistributionHandler>[0],
      ),
  );

  server.tool(
    getDiscussionSummarySchema.name,
    getDiscussionSummarySchema.description,
    GetDiscussionSummaryInput.shape,
    (args: any) =>
      getDiscussionSummaryHandler(
        args as Parameters<typeof getDiscussionSummaryHandler>[0],
      ),
  );

  server.tool(
    getAtRiskStudentsSchema.name,
    getAtRiskStudentsSchema.description,
    GetAtRiskStudentsInput.shape,
    (args: any) =>
      getAtRiskStudentsHandler(args as Parameters<typeof getAtRiskStudentsHandler>[0]),
  );

  server.tool(
    draftAnnouncementSchema.name,
    draftAnnouncementSchema.description,
    DraftAnnouncementInput.shape,
    (args: any) =>
      draftAnnouncementHandler(args as Parameters<typeof draftAnnouncementHandler>[0]),
  );

  // Shared tools
  server.tool(
    searchCourseMaterialsSchema.name,
    searchCourseMaterialsSchema.description,
    SearchCourseMaterialsInput.shape,
    (args: any) =>
      searchCourseMaterialsHandler(
        args as Parameters<typeof searchCourseMaterialsHandler>[0],
      ),
  );

  // MCP Resource: course://[courseId]
  server.resource('course', 'course://{courseId}', async (uri: any) => {
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
  const { config } = await import('./config.js');
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
          name: SERVER_NAME,
          version: SERVER_VERSION,
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

    // ── Provider manifest ──
    if (req.method === 'GET' && url.pathname === '/manifest') {
      const baseUrl =
        config.server.publicBaseUrl ?? `http://localhost:${config.server.port}`;
      const manifest = buildProviderManifest(baseUrl);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(manifest));
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
    console.log(`  Manifest     : http://localhost:${config.server.port}/manifest`);
  });

  // Push metrics every 60s if configured
  if (config.metrics.pushUrl) {
    setInterval(() => void pushMetrics(), 60_000);
  }
}

// ── stdio mode (Claude Desktop, Cursor) ──────────────────────────────────

async function startStdioServer(): Promise<void> {
  await import('./config.js');
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// ── Entrypoint ────────────────────────────────────────────────────────────

const command = parseCliCommand(process.argv.slice(2));

switch (command.mode) {
  case 'help':
    console.log(getCliHelpText());
    break;
  case 'version':
    console.log(`${SERVER_NAME} v${SERVER_VERSION}`);
    break;
  case 'manifest': {
    const manifest = buildProviderManifest(getManifestBaseUrl(command.baseUrl));
    console.log(JSON.stringify(manifest, null, command.json ? 2 : 2));
    break;
  }
  case 'tools': {
    if (command.json) {
      const manifest = buildProviderManifest(getManifestBaseUrl(command.baseUrl));
      console.log(JSON.stringify(manifest.tools, null, 2));
    } else {
      console.log(formatToolCatalog(command.baseUrl));
    }
    break;
  }
  case 'doctor': {
    const report = buildDoctorReport();
    if (command.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatDoctorReport(report));
    }
    break;
  }
  case 'probe': {
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
  case 'server': {
    const runner = command.useStdio ? startStdioServer : startHttpServer;
    runner().catch((err) => {
      console.error('Fatal:', err);
      process.exit(1);
    });
    break;
  }
}
