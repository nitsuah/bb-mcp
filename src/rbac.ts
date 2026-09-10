/**
 * Role-based access policy map and role lookup helpers for tool authorization.
 */
import type { Role } from "./auth.js";

export const TOOL_ROLE_RULES: Readonly<Record<string, readonly Role[]>> = {
  get_my_courses: ["student", "instructor", "admin"],
  list_courses: ["student", "instructor", "admin"],
  get_upcoming_assignments: ["student"],
  get_my_grades: ["student"],
  get_course_content: ["student", "instructor", "admin"],
  get_course_contents: ["student", "instructor", "admin"],
  get_assignment_feedback: ["student"],
  get_announcements: ["student", "instructor", "admin"],
  create_assignment_submission: ["student", "admin"],
  list_roster: ["instructor", "admin"],
  get_grades: ["instructor", "admin"],
  get_submission_status: ["instructor", "admin"],
  get_grade_distribution: ["instructor", "admin"],
  get_discussion_summary: ["instructor", "admin"],
  get_at_risk_students: ["instructor", "admin"],
  draft_announcement: ["instructor", "admin"],
  search_course_materials: ["student", "instructor", "admin"],
  // Admin tools
  list_users: ["admin"],
  get_user: ["admin"],
  list_enrollments: ["admin"],
  create_enrollment: ["admin"],
  update_enrollment: ["admin"],
  delete_enrollment: ["admin"],
  list_audit_logs: ["admin"],
  // Parent tools
  get_my_children: ["parent"],
  get_children_courses: ["parent"],
  get_children_grades: ["parent"],
  get_children_upcoming_assignments: ["parent"],
  get_children_announcements: ["parent"],
  // Grade write-back tools
  create_assignment: ["instructor", "admin"],
  create_grade_column: ["instructor", "admin"],
  update_grade: ["instructor", "admin"],
  delete_grade: ["instructor", "admin"],
  exempt_grade: ["instructor", "admin"],
  get_grade_column: ["instructor", "admin"],
  // Webhook tools
  list_webhook_subscriptions: ["admin"],
  get_webhook_subscription: ["admin"],
  create_webhook_subscription: ["admin"],
  update_webhook_subscription: ["admin"],
  delete_webhook_subscription: ["admin"],
};

export function getAllowedRolesForTool(toolName: string): readonly Role[] {
  return TOOL_ROLE_RULES[toolName] ?? [];
}

export function canRoleAccessTool(role: Role, toolName: string): boolean {
  return getAllowedRolesForTool(toolName).includes(role);
}
