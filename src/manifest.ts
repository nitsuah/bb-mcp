/**
 * Provider manifest builder.
 * Combines all tool schemas into a single MCP provider manifest.
 */

import {
  GetMyCoursesSchema,
  ListCoursesSchema,
  GetUpcomingAssignmentsSchema,
  GetMyGradesSchema,
  GetCourseContentSchema,
  GetCourseContentsSchema,
  GetAssignmentFeedbackSchema,
  GetAnnouncementsSchema,
  CreateAssignmentSubmissionSchema,
} from "./tools/student";

import {
  ListRosterSchema,
  GetGradesSchema,
  GetSubmissionStatusSchema,
  GetGradeDistributionSchema,
  GetDiscussionSummarySchema,
  GetAtRiskStudentsSchema,
  DraftAnnouncementSchema,
} from "./tools/instructor";

import { SearchCourseMaterialsSchema } from "./tools/shared";

// Admin tools
import {
  ListUsersSchema,
  GetUserSchema,
  ListEnrollmentsSchema,
  CreateEnrollmentSchema,
  UpdateEnrollmentSchema,
  DeleteEnrollmentSchema,
  ListAuditLogsSchema,
} from "./tools/admin";

// Parent tools
import {
  GetMyChildrenSchema,
  GetChildrenCoursesSchema,
  GetChildrenGradesSchema,
  GetChildrenUpcomingAssignmentsSchema,
  GetChildrenAnnouncementsSchema,
} from "./tools/parent";

// Grade write-back tools
import {
  CreateGradeColumnSchema,
  UpdateGradeSchema,
  DeleteGradeSchema,
  ExemptGradeSchema,
  GetGradeColumnSchema,
} from "./tools/grade-writeback";

// Webhook tools
import {
  ListWebhookSubscriptionsSchema,
  GetWebhookSubscriptionSchema,
  CreateWebhookSubscriptionSchema,
  UpdateWebhookSubscriptionSchema,
  DeleteWebhookSubscriptionSchema,
} from "./tools/webhook-tools";

/**
 * Build the MCP provider manifest.
 * @param baseUrl Base URL for the server (used for resource templates)
 * @returns MCP provider manifest object
 */
export function buildProviderManifest(baseUrl: string) {
  return {
    $schema: "http://modelcontextprotocol.io/schema/manifest.json",
    version: "1.0.0",
    name: "blackboard-learn-mcp",
    description: "MCP server wrapping the Blackboard Learn REST API",
    tools: [
      // Student tools
      GetMyCoursesSchema,
      ListCoursesSchema,
      GetUpcomingAssignmentsSchema,
      GetMyGradesSchema,
      GetCourseContentSchema,
      GetCourseContentsSchema,
      GetAssignmentFeedbackSchema,
      GetAnnouncementsSchema,
      CreateAssignmentSubmissionSchema,

      // Instructor tools
      ListRosterSchema,
      GetGradesSchema,
      GetSubmissionStatusSchema,
      GetGradeDistributionSchema,
      GetDiscussionSummarySchema,
      GetAtRiskStudentsSchema,
      DraftAnnouncementSchema,

      // Shared tools
      SearchCourseMaterialsSchema,

      // Admin tools
      ListUsersSchema,
      GetUserSchema,
      ListEnrollmentsSchema,
      CreateEnrollmentSchema,
      UpdateEnrollmentSchema,
      DeleteEnrollmentSchema,
      ListAuditLogsSchema,

      // Parent tools
      GetMyChildrenSchema,
      GetChildrenCoursesSchema,
      GetChildrenGradesSchema,
      GetChildrenUpcomingAssignmentsSchema,
      GetChildrenAnnouncementsSchema,

      // Grade write-back tools
      CreateGradeColumnSchema,
      UpdateGradeSchema,
      DeleteGradeSchema,
      ExemptGradeSchema,
      GetGradeColumnSchema,

      // Webhook tools
      ListWebhookSubscriptionsSchema,
      GetWebhookSubscriptionSchema,
      CreateWebhookSubscriptionSchema,
      UpdateWebhookSubscriptionSchema,
      DeleteWebhookSubscriptionSchema,
    ],
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