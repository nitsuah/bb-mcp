/**
 * Tool-specific output schemas for structured parsing.
 *
 * Each schema describes the JSON structure that a tool's handler returns
 * in the text content of its response, allowing agent clients to reliably
 * deserialize and type-check results.
 */

export const OUTPUT_SCHEMAS = {
  // Course list schema
  courseListSchema: {
    type: 'object',
    properties: {
      courses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            courseId: { type: 'string' },
            name: { type: 'string' },
            description: { type: ['string', 'null'] },
            instructor: { type: ['string', 'null'] },
            term: { type: ['string', 'null'] },
            status: { type: 'string' },
          },
          required: ['id', 'courseId', 'name'],
        },
      },
    },
    required: ['courses'],
  },

  // Assignments/upcoming due dates schema
  assignmentListSchema: {
    type: 'object',
    properties: {
      upcoming: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            course: { type: ['string', 'null'] },
            courseId: { type: ['string', 'null'] },
            due: { type: 'string' },
            dueIn: { type: ['string', 'null'] },
            maxScore: { type: ['number', 'null'] },
          },
          required: ['id', 'title', 'due'],
        },
      },
      summary: {
        type: 'object',
        properties: {
          totalCount: { type: 'number' },
          daysAhead: { type: 'number' },
        },
        required: ['totalCount', 'daysAhead'],
      },
    },
    required: ['upcoming', 'summary'],
  },

  // Grades schema
  gradesSchema: {
    type: 'object',
    properties: {
      courses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            course: { type: 'string' },
            courseId: { type: 'string' },
            average: { type: ['string', 'null'] },
            grades: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  columnId: { type: 'string' },
                  status: { type: ['string', 'null'] },
                  score: { type: ['number', 'null'] },
                  text: { type: ['string', 'null'] },
                  feedback: { type: ['string', 'null'] },
                },
              },
            },
          },
          required: ['course', 'courseId'],
        },
      },
    },
    required: ['courses'],
  },

  // Course content/materials schema
  courseContentSchema: {
    type: 'object',
    properties: {
      course: { type: 'string' },
      courseId: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            type: { type: 'string' },
            available: { type: 'string' },
            body: { type: ['string', 'null'] },
          },
          required: ['id', 'title'],
        },
      },
    },
    required: ['items'],
  },

  // Announcements schema
  announcementsSchema: {
    type: 'object',
    properties: {
      course: { type: 'string' },
      courseId: { type: 'string' },
      announcements: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            body: { type: 'string' },
            created: { type: ['string', 'null'] },
            modified: { type: ['string', 'null'] },
            author: { type: ['string', 'null'] },
          },
          required: ['id', 'title', 'body'],
        },
      },
    },
    required: ['announcements'],
  },

  // Instructor roster schema
  rosterSchema: {
    type: 'object',
    properties: {
      courseId: { type: 'string' },
      count: { type: 'number' },
      users: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            userName: { type: 'string' },
            name: { type: ['string', 'null'] },
            emailAddress: { type: ['string', 'null'] },
          },
          required: ['userId', 'userName'],
        },
      },
    },
    required: ['courseId', 'count', 'users'],
  },

  // Instructor grade read schema
  instructorGradesSchema: {
    type: 'object',
    properties: {
      courseId: { type: 'string' },
      columnId: { type: ['string', 'null'] },
      count: { type: 'number' },
      users: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            userName: { type: 'string' },
            name: { type: ['string', 'null'] },
            grades: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  columnId: { type: 'string' },
                  status: { type: ['string', 'null'] },
                  score: { type: ['number', 'null'] },
                  text: { type: ['string', 'null'] },
                  feedback: { type: ['string', 'null'] },
                },
                required: ['columnId'],
              },
            },
          },
          required: ['userId', 'userName', 'grades'],
        },
      },
      grades: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            userName: { type: ['string', 'null'] },
            name: { type: ['string', 'null'] },
            status: { type: ['string', 'null'] },
            score: { type: ['number', 'null'] },
            text: { type: ['string', 'null'] },
            feedback: { type: ['string', 'null'] },
          },
          required: ['userId'],
        },
      },
    },
    required: ['courseId', 'count'],
  },

  // Submission status / "who submitted" schema
  submissionStatusSchema: {
    type: 'object',
    properties: {
      assignment: { type: 'string' },
      courseId: { type: 'string' },
      stats: {
        type: 'object',
        properties: {
          totalEnrolled: { type: 'number' },
          submitted: { type: 'number' },
          notSubmitted: { type: 'number' },
        },
        required: ['totalEnrolled', 'submitted', 'notSubmitted'],
      },
      submitted: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            status: { type: ['string', 'null'] },
            submittedAt: { type: ['string', 'null'] },
          },
        },
      },
      missing: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            userName: { type: 'string' },
            name: { type: ['string', 'null'] },
          },
        },
      },
    },
    required: ['stats', 'submitted', 'missing'],
  },

  // Grade distribution (statistics) schema
  gradeDistributionSchema: {
    type: 'object',
    properties: {
      assignment: { type: 'string' },
      courseId: { type: 'string' },
      statistics: {
        type: 'object',
        properties: {
          count: { type: 'number' },
          mean: { type: 'string' },
          median: { type: 'string' },
          stddev: { type: 'string' },
          min: { type: 'number' },
          max: { type: 'number' },
        },
        required: ['count', 'mean', 'median', 'stddev', 'min', 'max'],
      },
      distribution: {
        type: 'object',
        properties: {
          A: { type: 'number' },
          B: { type: 'number' },
          C: { type: 'number' },
          D: { type: 'number' },
          F: { type: 'number' },
        },
        required: ['A', 'B', 'C', 'D', 'F'],
      },
    },
    required: ['statistics', 'distribution'],
  },

  // Discussion summary schema
  discussionSummarySchema: {
    type: 'object',
    properties: {
      threadId: { type: 'string' },
      courseId: { type: 'string' },
      summary: {
        type: 'object',
        properties: {
          totalPosts: { type: 'number' },
          uniqueParticipants: { type: 'number' },
        },
        required: ['totalPosts', 'uniqueParticipants'],
      },
      posts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            authorId: { type: ['string', 'null'] },
            created: { type: ['string', 'null'] },
            bodySnippet: { type: ['string', 'null'] },
          },
        },
      },
    },
    required: ['threadId', 'summary', 'posts'],
  },

  // At-risk students schema
  atRiskStudentsSchema: {
    type: 'object',
    properties: {
      courseId: { type: 'string' },
      threshold: { type: 'number' },
      students: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            userName: { type: 'string' },
            name: { type: ['string', 'null'] },
            averageScore: { type: 'string' },
            missingAssignments: { type: 'number' },
            risk: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
          required: ['userId', 'userName', 'averageScore', 'risk'],
        },
      },
    },
    required: ['courseId', 'threshold', 'students'],
  },

  // Search results schema
  searchResultsSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      courseId: { type: ['string', 'null'] },
      count: { type: 'number' },
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            courseId: { type: 'string' },
            courseName: { type: 'string' },
            id: { type: 'string' },
            title: { type: 'string' },
            type: { type: 'string' },
            bodySnippet: { type: ['string', 'null'] },
          },
          required: ['courseId', 'id', 'title'],
        },
      },
    },
    required: ['query', 'count', 'results'],
  },

  // Submission attempt schema (for created attempts)
  submissionAttemptSchema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      userId: { type: 'string' },
      status: { type: ['string', 'null'] },
      created: { type: ['string', 'null'] },
      modified: { type: ['string', 'null'] },
      studentComments: { type: ['string', 'null'] },
      feedback: { type: ['string', 'null'] },
      score: { type: ['number', 'null'] },
    },
    required: ['id', 'userId'],
  },
} as const;

/**
 * Map tool names to their output schemas.
 * Used by manifest generation to assign the correct schema to each tool.
 */
export function getOutputSchemaForTool(
  toolName: string,
): (typeof OUTPUT_SCHEMAS)[keyof typeof OUTPUT_SCHEMAS] | null {
  const toolSchemaMap: Record<
    string,
    (typeof OUTPUT_SCHEMAS)[keyof typeof OUTPUT_SCHEMAS]
  > = {
    get_my_courses: OUTPUT_SCHEMAS.courseListSchema,
    list_courses: OUTPUT_SCHEMAS.courseListSchema,
    get_upcoming_assignments: OUTPUT_SCHEMAS.assignmentListSchema,
    get_my_grades: OUTPUT_SCHEMAS.gradesSchema,
    get_course_content: OUTPUT_SCHEMAS.courseContentSchema,
    get_course_contents: OUTPUT_SCHEMAS.courseContentSchema,
    get_assignment_feedback: OUTPUT_SCHEMAS.courseContentSchema,
    get_announcements: OUTPUT_SCHEMAS.announcementsSchema,
    list_roster: OUTPUT_SCHEMAS.rosterSchema,
    get_grades: OUTPUT_SCHEMAS.instructorGradesSchema,
    get_submission_status: OUTPUT_SCHEMAS.submissionStatusSchema,
    get_grade_distribution: OUTPUT_SCHEMAS.gradeDistributionSchema,
    get_discussion_summary: OUTPUT_SCHEMAS.discussionSummarySchema,
    get_at_risk_students: OUTPUT_SCHEMAS.atRiskStudentsSchema,
    create_assignment_submission: OUTPUT_SCHEMAS.submissionAttemptSchema,
    draft_announcement: OUTPUT_SCHEMAS.announcementsSchema,
    search_course_materials: OUTPUT_SCHEMAS.searchResultsSchema,
  };

  return toolSchemaMap[toolName] ?? null;
}
