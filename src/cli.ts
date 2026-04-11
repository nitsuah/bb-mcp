import { buildProviderManifest } from './manifest.js';
import { SERVER_NAME, SERVER_VERSION } from './constants.js';

export type CliCommand =
  | { mode: 'server'; useStdio: boolean }
  | { mode: 'help' }
  | { mode: 'version' }
  | { mode: 'manifest'; json: boolean; baseUrl?: string }
  | { mode: 'tools'; json: boolean; baseUrl?: string }
  | { mode: 'doctor'; json: boolean }
  | { mode: 'probe'; json: boolean };

export interface DoctorReport {
  provider: {
    name: string;
    version: string;
  };
  environment: {
    bbClientId: boolean;
    bbClientSecret: boolean;
    bbBaseUrl: string;
    port: number;
    publicBaseUrl: string | null;
    metricsPushUrl: boolean;
    restrictedToolCount: number;
  };
  readiness: {
    httpServer: boolean;
    stdioServer: boolean;
    blackboardCredentialsReady: boolean;
  };
}

export interface BlackboardProbeReport {
  provider: {
    name: string;
    version: string;
  };
  blackboard: {
    baseUrl: string;
    oauth: boolean;
    api: boolean;
    sampleCourseCount: number | null;
    message: string;
  };
}

function hasFlag(argv: string[], ...flags: string[]): boolean {
  return flags.some((flag) => argv.includes(flag));
}

function getOptionValue(argv: string[], ...flags: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (flags.includes(current)) {
      return argv[index + 1];
    }

    for (const flag of flags) {
      if (current.startsWith(`${flag}=`)) {
        return current.slice(flag.length + 1);
      }
    }
  }

  return undefined;
}

export function parseCliCommand(argv: string[]): CliCommand {
  const json = hasFlag(argv, '--json');
  const baseUrl = getOptionValue(argv, '--base-url');

  if (hasFlag(argv, '--help', '-h')) {
    return { mode: 'help' };
  }

  if (hasFlag(argv, '--version', '-v')) {
    return { mode: 'version' };
  }

  if (hasFlag(argv, '--manifest', '--print-manifest')) {
    return { mode: 'manifest', json, baseUrl };
  }

  if (hasFlag(argv, '--tools', '--list-tools')) {
    return { mode: 'tools', json, baseUrl };
  }

  if (hasFlag(argv, '--doctor')) {
    return { mode: 'doctor', json };
  }

  if (hasFlag(argv, '--probe', '--probe-blackboard')) {
    return { mode: 'probe', json };
  }

  return { mode: 'server', useStdio: hasFlag(argv, '--stdio') };
}

export function getCliHelpText(): string {
  return [
    `${SERVER_NAME} v${SERVER_VERSION}`,
    '',
    'Usage:',
    '  bb-mcp                 Start the HTTP MCP server',
    '  bb-mcp --stdio         Start the stdio MCP server',
    '  bb-mcp --help          Show CLI help',
    '  bb-mcp --version       Show version',
    '  bb-mcp --manifest      Print provider manifest JSON',
    '  bb-mcp --tools         Print tool catalog',
    '  bb-mcp --doctor        Print environment readiness report',
    '  bb-mcp --probe         Validate Blackboard auth + a minimal API call',
    '',
    'Options:',
    '  --base-url <url>       Override manifest base URL for --manifest/--tools',
    '  --json                 Print machine-readable JSON for --tools/--doctor',
  ].join('\n');
}

export function buildDoctorReport(env: NodeJS.ProcessEnv = process.env): DoctorReport {
  const restrictedToolCount = (env.RESTRICTED_TOOLS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean).length;

  const bbClientId = Boolean(env.BB_CLIENT_ID);
  const bbClientSecret = Boolean(env.BB_CLIENT_SECRET);
  const blackboardCredentialsReady = bbClientId && bbClientSecret;

  return {
    provider: {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    environment: {
      bbClientId,
      bbClientSecret,
      bbBaseUrl: (env.BB_BASE_URL ?? 'https://developer.blackboard.com').replace(/\/$/, ''),
      port: Number.parseInt(env.PORT ?? '3100', 10),
      publicBaseUrl: env.PUBLIC_BASE_URL ?? null,
      metricsPushUrl: Boolean(env.METRICS_PUSH_URL),
      restrictedToolCount,
    },
    readiness: {
      httpServer: true,
      stdioServer: true,
      blackboardCredentialsReady,
    },
  };
}

export function formatDoctorReport(report: DoctorReport): string {
  return [
    `${report.provider.name} v${report.provider.version}`,
    'Doctor report',
    `  Blackboard client ID     : ${report.environment.bbClientId ? 'set' : 'missing'}`,
    `  Blackboard client secret : ${report.environment.bbClientSecret ? 'set' : 'missing'}`,
    `  Blackboard base URL      : ${report.environment.bbBaseUrl}`,
    `  HTTP port                : ${report.environment.port}`,
    `  Public base URL          : ${report.environment.publicBaseUrl ?? '(not set)'}`,
    `  Metrics push URL         : ${report.environment.metricsPushUrl ? 'set' : 'not set'}`,
    `  Restricted tools         : ${report.environment.restrictedToolCount}`,
    `  Blackboard ready         : ${report.readiness.blackboardCredentialsReady ? 'yes' : 'no'}`,
  ].join('\n');
}

export function formatProbeReport(report: BlackboardProbeReport): string {
  return [
    `${report.provider.name} v${report.provider.version}`,
    'Blackboard probe',
    `  Blackboard base URL : ${report.blackboard.baseUrl}`,
    `  OAuth token exchange: ${report.blackboard.oauth ? 'ok' : 'failed'}`,
    `  API request         : ${report.blackboard.api ? 'ok' : 'failed'}`,
    `  Sample course count : ${report.blackboard.sampleCourseCount ?? '(unavailable)'}`,
    `  Message             : ${report.blackboard.message}`,
  ].join('\n');
}

export function getManifestBaseUrl(baseUrl?: string): string {
  return baseUrl ?? process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? '3100'}`;
}

export function formatToolCatalog(baseUrl?: string): string {
  const manifest = buildProviderManifest(getManifestBaseUrl(baseUrl));
  return manifest.tools
    .map((tool) => `${tool.name} [${tool.roles.join(', ')}] - ${tool.description}`)
    .join('\n');
}

export async function runBlackboardProbe(): Promise<BlackboardProbeReport> {
  const { bbClient } = await import('./bb-client.js');

  try {
    const courses = await bbClient.getCourses();
    return {
      provider: {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
      blackboard: {
        baseUrl: (process.env.BB_BASE_URL ?? 'https://developer.blackboard.com').replace(/\/$/, ''),
        oauth: true,
        api: true,
        sampleCourseCount: courses.length,
        message: 'OAuth token exchange succeeded and Blackboard API returned a course list.',
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lowerMessage = message.toLowerCase();
    const oauthFailure = lowerMessage.includes('oauth')
      || lowerMessage.includes('unauthorized')
      || lowerMessage.includes('401')
      || lowerMessage.includes('invalid_client');

    return {
      provider: {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
      blackboard: {
        baseUrl: (process.env.BB_BASE_URL ?? 'https://developer.blackboard.com').replace(/\/$/, ''),
        oauth: !oauthFailure,
        api: false,
        sampleCourseCount: null,
        message,
      },
    };
  }
}
