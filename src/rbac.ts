import type { Role } from './auth.js';

export const TOOL_ROLE_RULES: Readonly<Record<string, readonly Role[]>> = {
  get_my_courses: ['student', 'instructor', 'admin'],
  list_courses: ['student', 'instructor', 'admin'],
  get_upcoming_assignments: ['student'],
  get_my_grades: ['student'],
  get_course_content: ['student', 'instructor', 'admin'],
  get_course_contents: ['student', 'instructor', 'admin'],
  get_assignment_feedback: ['student'],
  get_announcements: ['student', 'instructor', 'admin'],
  list_roster: ['instructor', 'admin'],
  get_submission_status: ['instructor', 'admin'],
  get_grade_distribution: ['instructor', 'admin'],
  get_discussion_summary: ['instructor', 'admin'],
  get_at_risk_students: ['instructor', 'admin'],
  draft_announcement: ['instructor', 'admin'],
  search_course_materials: ['student', 'instructor', 'admin'],
};

export function getAllowedRolesForTool(toolName: string): readonly Role[] {
  return TOOL_ROLE_RULES[toolName] ?? [];
}

export function canRoleAccessTool(role: Role, toolName: string): boolean {
  return getAllowedRolesForTool(toolName).includes(role);
}