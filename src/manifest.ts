import {
  getMyCoursesSchema,
  listCoursesSchema,
  getUpcomingAssignmentsSchema,
  getMyGradesSchema,
  getCourseContentSchema,
  getCourseContentsSchema,
  getAssignmentFeedbackSchema,
  getAnnouncementsSchema,
} from './tools/student.js';
import {
  getSubmissionStatusSchema,
  getGradeDistributionSchema,
  getDiscussionSummarySchema,
  getAtRiskStudentsSchema,
  draftAnnouncementSchema,
} from './tools/instructor.js';
import { searchCourseMaterialsSchema } from './tools/shared.js';
import { SERVER_NAME, SERVER_VERSION } from './constants.js';
import { getAllowedRolesForTool } from './rbac.js';

const DEFAULT_TEXT_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    content: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['text'] },
          text: { type: 'string' },
        },
        required: ['type', 'text'],
      },
      minItems: 1,
    },
  },
  required: ['content'],
} as const;

const TOOL_MANIFEST = [
  getMyCoursesSchema,
  listCoursesSchema,
  getUpcomingAssignmentsSchema,
  getMyGradesSchema,
  getCourseContentSchema,
  getCourseContentsSchema,
  getAssignmentFeedbackSchema,
  getAnnouncementsSchema,
  getSubmissionStatusSchema,
  getGradeDistributionSchema,
  getDiscussionSummarySchema,
  getAtRiskStudentsSchema,
  draftAnnouncementSchema,
  searchCourseMaterialsSchema,
].map((tool) => ({
  ...tool,
  roles: getAllowedRolesForTool(tool.name),
  outputSchema: DEFAULT_TEXT_OUTPUT_SCHEMA,
}));

export function buildProviderManifest(baseUrl: string) {
  return {
    provider: {
      id: SERVER_NAME,
      name: 'Blackboard Learn MCP',
      version: SERVER_VERSION,
      protocol: 'mcp',
    },
    capabilities: {
      transports: {
        stdio: true,
        streamableHttp: {
          enabled: true,
          mcpPath: '/mcp',
          supportsSessionReuse: true,
        },
      },
      resources: {
        supported: ['course://{courseId}'],
      },
      auth: {
        callerIdentity: true,
      },
    },
    endpoints: {
      health: `${baseUrl}/health`,
      metrics: `${baseUrl}/metrics`,
      manifest: `${baseUrl}/manifest`,
      mcp: `${baseUrl}/mcp`,
    },
    tools: TOOL_MANIFEST,
  };
}
