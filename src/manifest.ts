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

/**
 * Build the MCP provider manifest.
 * @param baseUrl Base URL for the server (used for resource templates)
 * @returns MCP provider manifest object
 */
export function buildProviderManifest(baseUrl: string) {
  void baseUrl; // reserved for future resource-template URIs
  return {
    $schema: "http://modelcontextprotocol.io/schema/manifest.json",
    version: "1.0.0",
    name: "blackboard-learn-mcp",
    description: "MCP server wrapping the Blackboard Learn REST API",
    tools: [
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
