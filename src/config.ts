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
  server: {
    port: parseInt(process.env.PORT ?? '3100', 10),
    logLevel: process.env.LOG_LEVEL ?? 'info',
  },
  metrics: {
    pushUrl: process.env.METRICS_PUSH_URL ?? null,
  },
  security: {
    restrictedTools: (process.env.RESTRICTED_TOOLS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
} as const;
