import 'dotenv/config';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const config = {
  bb: {
    clientId: required('BB_CLIENT_ID'),
    clientSecret: required('BB_CLIENT_SECRET'),
    baseUrl: (process.env.BB_BASE_URL ?? 'https://developer.blackboard.com').replace(/\/$/, ''),
  },
  oauth: {
    authorizationPath: process.env.BB_OAUTH_AUTHORIZATION_PATH ?? '/learn/api/public/v1/oauth2/authorizationcode',
    tokenPath: process.env.BB_OAUTH_TOKEN_PATH ?? '/learn/api/public/v1/oauth2/token',
    redirectUri: process.env.BB_OAUTH_REDIRECT_URI ?? null,
    scope: process.env.BB_OAUTH_SCOPE ?? null,
  },
  server: {
    port: parseInt(process.env.PORT ?? '3100', 10),
    logLevel: process.env.LOG_LEVEL ?? 'info',
    // Trusted base URL for manifest endpoint generation (e.g. https://mcp.example.com).
    // Falls back to http://localhost:<PORT> when not set.
    publicBaseUrl: process.env.PUBLIC_BASE_URL ?? null,
  },
  metrics: {
    pushUrl: process.env.METRICS_PUSH_URL ?? null,
  },
  security: {
    restrictedTools: (process.env.RESTRICTED_TOOLS ?? 'get_at_risk_students,get_grade_distribution,get_submission_status,get_grades')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    rateLimitPerMinute: {
      student: parseInt(process.env.RATE_LIMIT_STUDENT_PER_MINUTE ?? '60', 10),
      instructor: parseInt(process.env.RATE_LIMIT_INSTRUCTOR_PER_MINUTE ?? '120', 10),
      admin: parseInt(process.env.RATE_LIMIT_ADMIN_PER_MINUTE ?? '180', 10),
    },
  },
} as const;
