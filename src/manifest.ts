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

const TOOL_MANIFEST = [
  { ...getMyCoursesSchema, roles: ['student', 'instructor', 'admin'] },
  { ...listCoursesSchema, roles: ['student', 'instructor', 'admin'] },
  { ...getUpcomingAssignmentsSchema, roles: ['student'] },
  { ...getMyGradesSchema, roles: ['student'] },
  { ...getCourseContentSchema, roles: ['student', 'instructor', 'admin'] },
  { ...getCourseContentsSchema, roles: ['student', 'instructor', 'admin'] },
  { ...getAssignmentFeedbackSchema, roles: ['student'] },
  { ...getAnnouncementsSchema, roles: ['student', 'instructor', 'admin'] },
  { ...getSubmissionStatusSchema, roles: ['instructor', 'admin'] },
  { ...getGradeDistributionSchema, roles: ['instructor', 'admin'] },
  { ...getDiscussionSummarySchema, roles: ['instructor', 'admin'] },
  { ...getAtRiskStudentsSchema, roles: ['instructor', 'admin'] },
  { ...draftAnnouncementSchema, roles: ['instructor', 'admin'] },
  { ...searchCourseMaterialsSchema, roles: ['student', 'instructor', 'admin'] },
];

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
