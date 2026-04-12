/**
 * Instructor-facing MCP tools.
 * All require role=instructor|admin and most require ferpa_authorized=true.
 */

import { z } from 'zod';
import { bbClient } from '../bb-client.js';
import { checkAuthorization, parseIdentity } from '../auth.js';
import { withMetrics } from '../metrics.js';

// ── list_roster ───────────────────────────────────────────────────────────

export const ListRosterInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string(),
});

export const listRosterHandler = withMetrics(
  'list_roster',
  async (args: z.infer<typeof ListRosterInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({ identity, toolName: 'list_roster', courseId: args.courseId });

    const enrolled = await bbClient.getEnrolledUsers(args.courseId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              courseId: args.courseId,
              count: enrolled.length,
              users: enrolled.map((user) => ({
                userId: user.id,
                userName: user.userName,
                name: user.name
                  ? `${user.name.given ?? ''} ${user.name.family ?? ''}`.trim() || null
                  : null,
                emailAddress: user.emailAddress ?? null,
              })),
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const listRosterSchema = {
  name: 'list_roster',
  description: 'Returns the enrolled user roster for a course. Requires instructor or admin role.',
  inputSchema: {
    type: 'object',
    properties: {
      caller_identity: { type: 'object', required: ['userId', 'role'] },
      courseId: { type: 'string' },
    },
    required: ['caller_identity', 'courseId'],
  },
};

// ── get_submission_status ─────────────────────────────────────────────────

export const GetSubmissionStatusInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string(),
  columnId: z.string(),
});

export const getSubmissionStatusHandler = withMetrics(
  'get_submission_status',
  async (args: z.infer<typeof GetSubmissionStatusInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: 'get_submission_status',
      courseId: args.courseId,
    });

    const [attempts, enrolled] = await Promise.all([
      bbClient.getAttempts(args.courseId, args.columnId),
      bbClient.getEnrolledUsers(args.courseId),
    ]);

    const submittedIds = new Set(attempts.map((a) => a.userId));
    const notSubmitted = enrolled.filter((u) => !submittedIds.has(u.id));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              totalEnrolled: enrolled.length,
              submitted: submittedIds.size,
              notSubmitted: notSubmitted.length,
              submittedUsers: attempts.map((a) => ({
                userId: a.userId,
                status: a.status ?? null,
                submittedAt: a.created ?? null,
              })),
              missingUsers: notSubmitted.map((u) => ({
                userId: u.id,
                userName: u.userName,
                name: u.name
                  ? `${u.name.given ?? ''} ${u.name.family ?? ''}`.trim()
                  : null,
              })),
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const getSubmissionStatusSchema = {
  name: 'get_submission_status',
  description:
    'Returns who has and has not submitted an assignment. Requires instructor role and FERPA authorization.',
  inputSchema: {
    type: 'object',
    properties: {
      caller_identity: { type: 'object', required: ['userId', 'role'] },
      courseId: { type: 'string' },
      columnId: { type: 'string' },
    },
    required: ['caller_identity', 'courseId', 'columnId'],
  },
};

// ── get_grade_distribution ────────────────────────────────────────────────

export const GetGradeDistributionInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string(),
  columnId: z.string(),
});

export const getGradeDistributionHandler = withMetrics(
  'get_grade_distribution',
  async (args: z.infer<typeof GetGradeDistributionInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: 'get_grade_distribution',
      courseId: args.courseId,
    });

    const grades = await bbClient.getColumnGrades(args.courseId, args.columnId);
    const scores = grades.map((g) => g.score ?? 0).filter((s) => s > 0);

    if (scores.length === 0) {
      return { content: [{ type: 'text', text: 'No scores found for this column.' }] };
    }

    const sorted = [...scores].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / sorted.length;
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    const variance =
      sorted.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / sorted.length;
    const stddev = Math.sqrt(variance);

    // Bucket into grade bands
    const buckets = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const s of scores) {
      const pct = s; // assume scores are already 0–100; adjust if maxScore differs
      if (pct >= 90) buckets.A++;
      else if (pct >= 80) buckets.B++;
      else if (pct >= 70) buckets.C++;
      else if (pct >= 60) buckets.D++;
      else buckets.F++;
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              count: scores.length,
              mean: mean.toFixed(1),
              median: median.toFixed(1),
              stddev: stddev.toFixed(1),
              min: sorted[0],
              max: sorted[sorted.length - 1],
              distribution: buckets,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const getGradeDistributionSchema = {
  name: 'get_grade_distribution',
  description:
    'Returns grade statistics (mean, median, std dev, distribution) for an assignment column.',
  inputSchema: {
    type: 'object',
    properties: {
      caller_identity: { type: 'object', required: ['userId', 'role'] },
      courseId: { type: 'string' },
      columnId: { type: 'string' },
    },
    required: ['caller_identity', 'courseId', 'columnId'],
  },
};

// ── get_discussion_summary ────────────────────────────────────────────────

export const GetDiscussionSummaryInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string(),
  threadId: z.string(),
});

export const getDiscussionSummaryHandler = withMetrics(
  'get_discussion_summary',
  async (args: z.infer<typeof GetDiscussionSummaryInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({ identity, toolName: 'get_discussion_summary', courseId: args.courseId });

    const posts = await bbClient.getDiscussionPosts(args.courseId, args.threadId);
    const authorIds = [...new Set(posts.map((p) => p.authorId).filter(Boolean))];

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              threadId: args.threadId,
              totalPosts: posts.length,
              uniqueParticipants: authorIds.length,
              posts: posts.map((p) => ({
                id: p.id,
                authorId: p.authorId ?? null,
                created: p.created ?? null,
                bodySnippet: p.body ? p.body.slice(0, 300) : null,
              })),
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const getDiscussionSummarySchema = {
  name: 'get_discussion_summary',
  description: 'Returns participant count and post excerpts for a discussion thread.',
  inputSchema: {
    type: 'object',
    properties: {
      caller_identity: { type: 'object', required: ['userId', 'role'] },
      courseId: { type: 'string' },
      threadId: { type: 'string' },
    },
    required: ['caller_identity', 'courseId', 'threadId'],
  },
};

// ── get_at_risk_students ──────────────────────────────────────────────────

export const GetAtRiskStudentsInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string(),
  gradingThreshold: z.number().min(0).max(100).default(70),
});

export const getAtRiskStudentsHandler = withMetrics(
  'get_at_risk_students',
  async (args: z.infer<typeof GetAtRiskStudentsInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: 'get_at_risk_students',
      courseId: args.courseId,
    });

    const [enrolled, columns] = await Promise.all([
      bbClient.getEnrolledUsers(args.courseId),
      bbClient.getAssignments(args.courseId),
    ]);

    const atRisk = [];
    for (const user of enrolled) {
      const grades = await bbClient.getGrades(args.courseId, user.id);
      const scored = grades.filter((g) => g.score != null);
      if (scored.length === 0) continue;
      const avg = scored.reduce((s, g) => s + (g.score ?? 0), 0) / scored.length;
      const missing = columns.filter(
        (c) => !grades.find((g) => g.columnId === c.id && g.score != null),
      ).length;

      if (avg < args.gradingThreshold || missing > 2) {
        atRisk.push({
          userId: user.id,
          userName: user.userName,
          name: user.name
            ? `${user.name.given ?? ''} ${user.name.family ?? ''}`.trim()
            : null,
          averageScore: avg.toFixed(1),
          missingAssignments: missing,
          risk: avg < 60 ? 'high' : avg < args.gradingThreshold ? 'medium' : 'low',
        });
      }
    }

    atRisk.sort((a, b) => parseFloat(a.averageScore) - parseFloat(b.averageScore));

    return {
      content: [{ type: 'text', text: JSON.stringify(atRisk, null, 2) }],
    };
  },
);

export const getAtRiskStudentsSchema = {
  name: 'get_at_risk_students',
  description:
    'Returns students with low grades or many missing assignments. Requires FERPA authorization.',
  inputSchema: {
    type: 'object',
    properties: {
      caller_identity: { type: 'object', required: ['userId', 'role'] },
      courseId: { type: 'string' },
      gradingThreshold: {
        type: 'number',
        description: 'Score below this % is flagged as at-risk (default 70)',
        default: 70,
      },
    },
    required: ['caller_identity', 'courseId'],
  },
};

// ── draft_announcement ────────────────────────────────────────────────────

export const DraftAnnouncementInput = z.object({
  caller_identity: z.unknown(),
  courseId: z.string(),
  topic: z.string().min(3).max(500),
  tone: z.enum(['friendly', 'formal', 'urgent']).default('friendly'),
  post: z.boolean().default(false), // if true, posts the draft directly to Blackboard
});

export const draftAnnouncementHandler = withMetrics(
  'draft_announcement',
  async (args: z.infer<typeof DraftAnnouncementInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({ identity, toolName: 'draft_announcement', courseId: args.courseId });

    const toneGuide: Record<string, string> = {
      friendly:
        'Write in a warm, encouraging tone. Use first person (I / we). Keep it concise.',
      formal:
        'Write professionally and formally. Avoid contractions. Be precise.',
      urgent:
        'Write with urgency. Lead with the action item. Use bold for key dates.',
    };

    // The draft is produced by the LLM that called this tool — we return a
    // structured prompt that the calling model should render.
    const draftPrompt = [
      `Draft an announcement for a university course with the following topic: "${args.topic}".`,
      toneGuide[args.tone],
      'Include: subject line, body (3–5 sentences), and a clear call to action.',
      'Do NOT include any actual PII or fabricated student names.',
    ].join('\n');

    let posted: null | { id: string; created?: string } = null;
    if (args.post) {
      const title = args.topic.slice(0, 100);
      const body = `[Draft generated by Blackboard Learn MCP]\n\n${args.topic}`;
      const ann = await bbClient.createAnnouncement(args.courseId, title, body);
      posted = { id: ann.id, created: ann.created };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              draftPrompt,
              posted,
              instructions:
                'Use the draftPrompt to generate the announcement text. Review before sending.',
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const draftAnnouncementSchema = {
  name: 'draft_announcement',
  description:
    'Generates an AI-assisted announcement draft for instructor review. Optionally posts it.',
  inputSchema: {
    type: 'object',
    properties: {
      caller_identity: { type: 'object', required: ['userId', 'role'] },
      courseId: { type: 'string' },
      topic: { type: 'string', description: 'Subject or context for the announcement' },
      tone: {
        type: 'string',
        enum: ['friendly', 'formal', 'urgent'],
        default: 'friendly',
      },
      post: {
        type: 'boolean',
        description: 'Post the draft directly to Blackboard (default false)',
        default: false,
      },
    },
    required: ['caller_identity', 'courseId', 'topic'],
  },
};
