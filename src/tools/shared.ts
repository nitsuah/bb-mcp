/**
 * Shared tool: search_course_materials
 */

import { z } from "zod";
import { bbClient } from "../bb-client.js";
import { checkAuthorization, parseIdentity } from "../auth.js";
import { withMetrics } from "../metrics.js";

export const SearchCourseMaterialsInput = z.object({
  caller_identity: z.unknown(),
  query: z.string().min(1).max(500),
  courseId: z.string().optional(),
});

export const searchCourseMaterialsHandler = withMetrics(
  "search_course_materials",
  async (args: z.infer<typeof SearchCourseMaterialsInput>) => {
    const identity = parseIdentity(args.caller_identity);
    checkAuthorization({
      identity,
      toolName: "search_course_materials",
      courseId: args.courseId,
    });

    const courses = args.courseId
      ? [await bbClient.getCourse(args.courseId)]
      : await bbClient.getCourses(identity.userId);

    const q = args.query.toLowerCase();
    const results = [];

    for (const course of courses) {
      const content = await bbClient.getCourseContent(course.id);
      const matched = content.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.body?.toLowerCase().includes(q),
      );
      for (const item of matched) {
        results.push({
          courseId: course.courseId,
          courseName: course.name,
          id: item.id,
          title: item.title,
          type: item.contentHandler?.id ?? "unknown",
          bodySnippet: item.body
            ? `...${item.body.slice(
                Math.max(0, item.body.toLowerCase().indexOf(q) - 50),
                item.body.toLowerCase().indexOf(q) + 150,
              )}...`
            : null,
        });
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { query: args.query, count: results.length, results },
            null,
            2,
          ),
        },
      ],
    };
  },
);

export const searchCourseMaterialsSchema = {
  name: "search_course_materials",
  description:
    "Full-text search across course content. Optionally scoped to one course.",
  inputSchema: {
    type: "object",
    properties: {
      caller_identity: { type: "object", required: ["userId", "role"] },
      query: { type: "string", description: "Search query" },
      courseId: {
        type: "string",
        description: "Limit search to this course (optional)",
      },
    },
    required: ["caller_identity", "query"],
  },
};
