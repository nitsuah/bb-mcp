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
import { getOutputSchemaForTool } from './schemas.js';
import { config } from './config.js';

/**
 * Wraps a specific output schema in the MCP text-content envelope.
 * The agent client will:
 *   1. Receive the text-content message
 *   2. Parse the JSON in the text field using the specific outputSchema
 *   3. Type-check the result against the schema
 */
const DEFAULT_TEXT_OUTPUT_SCHEMA = (dataSchema: Record<string, unknown> | null) => ({
  type: 'object',
  properties: {
    content: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['text'] },
          text: { type: 'string' },
          dataSchema: dataSchema ?? undefined,
        },
        required: ['type', 'text'],
      },
      minItems: 1,
    },
  },
  required: ['content'],
});

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
  outputSchema: DEFAULT_TEXT_OUTPUT_SCHEMA(getOutputSchemaForTool(tool.name)),
}));

export function buildProviderManifest(baseUrl: string) {
  const oauthRedirectUri = config.oauth.redirectUri ?? `${baseUrl}/oauth/callback`;

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
        authorizationCode: {
          enabled: true,
          authorizeEndpoint: `${baseUrl}/oauth/authorize`,
          callbackEndpoint: `${baseUrl}/oauth/callback`,
          redirectUri: oauthRedirectUri,
          scope: config.oauth.scope,
        },
      },
    },
    endpoints: {
      health: `${baseUrl}/health`,
      metrics: `${baseUrl}/metrics`,
      manifest: `${baseUrl}/manifest`,
      mcp: `${baseUrl}/mcp`,
      oauthAuthorize: `${baseUrl}/oauth/authorize`,
      oauthCallback: `${baseUrl}/oauth/callback`,
    },
    tools: TOOL_MANIFEST,
  };
}
