/**
 * Provider manifest builder.
 * Combines all tool schemas into a single MCP provider manifest.
 */

import {
  getMyCoursesSchema,
  listCoursesSchema,
  getUpcomingAssignmentsSchema,
  getMyGradesSchema,
  getCourseContentSchema,
  getCourseContentsSchema,
  getAssignmentFeedbackSchema,
  getAnnouncementsSchema,
  createAssignmentSubmissionSchema,
} from "./tools/student.js";

import {
  listRosterSchema,
  getGradesSchema,
  getSubmissionStatusSchema,
  getGradeDistributionSchema,
  getDiscussionSummarySchema,
  getAtRiskStudentsSchema,
  draftAnnouncementSchema,
} from "./tools/instructor.js";

import { searchCourseMaterialsSchema } from "./tools/shared.js";

import { getAllowedRolesForTool } from "./rbac.js";
import { getOutputSchemaForTool } from "./schemas.js";

// Admin tools
import {
  listUsersSchema,
  getUserSchema,
  listEnrollmentsSchema,
  createEnrollmentSchema,
  updateEnrollmentSchema,
  deleteEnrollmentSchema,
  listAuditLogsSchema,
} from "./tools/admin.js";

// Parent tools
import {
  getMyChildrenSchema,
  getChildrenCoursesSchema,
  getChildrenGradesSchema,
  getChildrenUpcomingAssignmentsSchema,
  getChildrenAnnouncementsSchema,
} from "./tools/parent.js";

// Grade write-back tools
import {
  createAssignmentSchema,
  createGradeColumnSchema,
  updateGradeSchema,
  deleteGradeSchema,
  exemptGradeSchema,
  getGradeColumnSchema,
} from "./tools/grade-writeback.js";

// Webhook tools
import {
  listWebhookSubscriptionsSchema,
  getWebhookSubscriptionSchema,
  createWebhookSubscriptionSchema,
  updateWebhookSubscriptionSchema,
  deleteWebhookSubscriptionSchema,
} from "./tools/webhook-tools.js";

const RAW_TOOL_SCHEMAS = [
  // Student tools
  getMyCoursesSchema,
  listCoursesSchema,
  getUpcomingAssignmentsSchema,
  getMyGradesSchema,
  getCourseContentSchema,
  getCourseContentsSchema,
  getAssignmentFeedbackSchema,
  getAnnouncementsSchema,
  createAssignmentSubmissionSchema,

  // Instructor tools
  listRosterSchema,
  getGradesSchema,
  getSubmissionStatusSchema,
  getGradeDistributionSchema,
  getDiscussionSummarySchema,
  getAtRiskStudentsSchema,
  draftAnnouncementSchema,

  // Shared tools
  searchCourseMaterialsSchema,

  // Admin tools
  listUsersSchema,
  getUserSchema,
  listEnrollmentsSchema,
  createEnrollmentSchema,
  updateEnrollmentSchema,
  deleteEnrollmentSchema,
  listAuditLogsSchema,

  // Parent tools
  getMyChildrenSchema,
  getChildrenCoursesSchema,
  getChildrenGradesSchema,
  getChildrenUpcomingAssignmentsSchema,
  getChildrenAnnouncementsSchema,

  // Grade write-back tools
  createAssignmentSchema,
  createGradeColumnSchema,
  updateGradeSchema,
  deleteGradeSchema,
  exemptGradeSchema,
  getGradeColumnSchema,

  // Webhook tools
  listWebhookSubscriptionsSchema,
  getWebhookSubscriptionSchema,
  createWebhookSubscriptionSchema,
  updateWebhookSubscriptionSchema,
  deleteWebhookSubscriptionSchema,
];

/**
 * Every tool handler responds with the standard MCP tool-call envelope
 * (`{ content: [{ type, text }], isError? }`). When a tool has a
 * tool-specific structured schema registered in schemas.ts, it's attached
 * under `structuredContent` describing the JSON embedded in `content[].text`.
 */
function buildOutputSchema(toolName: string) {
  const dataSchema = getOutputSchemaForTool(toolName);

  const schema: Record<string, unknown> = {
    type: "object",
    properties: {
      content: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            text: { type: "string" },
          },
          required: ["type", "text"],
        },
      },
      isError: { type: "boolean" },
      ...(dataSchema ? { structuredContent: dataSchema } : {}),
    },
    required: ["content"],
  };

  return schema;
}

interface McpToolManifestEntry {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  roles: readonly string[];
  outputSchema: Record<string, unknown>;
}

export interface ProviderManifest {
  $schema: string;
  version: string;
  name: string;
  description: string;
  provider: { id: string; name: string };
  endpoints: {
    manifest: string;
    mcp: string;
    oauthAuthorize: string;
    oauthCallback: string;
  };
  capabilities: {
    transports: {
      stdio: boolean;
      streamableHttp: { enabled: boolean; endpoint: string };
    };
    auth: {
      callerIdentity: boolean;
      authorizationCode: {
        enabled: boolean;
        authorizeEndpoint: string;
        callbackEndpoint: string;
      };
    };
  };
  tools: McpToolManifestEntry[];
  resources: Array<{
    name: string;
    uriTemplate: string;
    description: string;
    mimeType: string;
  }>;
}

/**
 * Build the MCP provider manifest.
 * @param baseUrl Base URL for the server (used for endpoints and resource templates)
 * @returns MCP provider manifest object
 */
export function buildProviderManifest(baseUrl: string): ProviderManifest {
  return {
    $schema: "http://modelcontextprotocol.io/schema/manifest.json",
    version: "1.0.0",
    name: "blackboard-learn-mcp",
    description: "MCP server wrapping the Blackboard Learn REST API",
    provider: {
      id: "blackboard-learn-mcp",
      name: "Blackboard Learn MCP",
    },
    endpoints: {
      manifest: `${baseUrl}/manifest`,
      mcp: `${baseUrl}/mcp`,
      oauthAuthorize: `${baseUrl}/oauth/authorize`,
      oauthCallback: `${baseUrl}/oauth/callback`,
    },
    capabilities: {
      transports: {
        stdio: true,
        streamableHttp: {
          enabled: true,
          endpoint: `${baseUrl}/mcp`,
        },
      },
      auth: {
        callerIdentity: true,
        authorizationCode: {
          enabled: true,
          authorizeEndpoint: `${baseUrl}/oauth/authorize`,
          callbackEndpoint: `${baseUrl}/oauth/callback`,
        },
      },
    },
    tools: RAW_TOOL_SCHEMAS.map((schema) => ({
      ...schema,
      roles: getAllowedRolesForTool(schema.name),
      outputSchema: buildOutputSchema(schema.name),
    })),
    resources: [
      {
        name: "Course",
        uriTemplate: "course://{courseId}",
        description: "Get details of a specific course",
        mimeType: "application/json",
      },
    ],
  };
}
