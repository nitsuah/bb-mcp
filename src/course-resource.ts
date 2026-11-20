/**
 * MCP resource handler for course://{courseId}. Resources carry no
 * caller_identity argument, so only a server-verified principal may read them.
 */
import {
  AuthorizationError,
  checkAuthorization,
  checkCourseMemberEntitlement,
  type CourseMembershipLookup,
} from "./auth.js";
import { getVerifiedIdentity } from "./request-identity.js";
import type { BbCourse } from "./types.js";

export interface CourseResourceClient extends CourseMembershipLookup {
  getCourse(courseId: string): Promise<BbCourse>;
}

export async function readCourseResource(
  uri: { pathname: string; href: string },
  client: CourseResourceClient,
) {
  const courseId = decodeURIComponent(uri.pathname.replace(/^\/+/, ""));
  const verified = getVerifiedIdentity();
  if (!verified) {
    throw new AuthorizationError(
      "Course resources require a verified caller identity.",
    );
  }
  const authCtx = {
    identity: { ...verified },
    toolName: "course_resource",
    courseId,
  };
  checkAuthorization(authCtx);
  await checkCourseMemberEntitlement(authCtx, client);
  const course = await client.getCourse(courseId);
  return {
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify(course, null, 2),
        mimeType: "application/json",
      },
    ],
  };
}
