import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.BB_CLIENT_ID ??= 'test-client-id';
  process.env.BB_CLIENT_SECRET ??= 'test-client-secret';
});

describe('bb-mcp CLI', () => {
  it('parses help, manifest, tools, doctor, and stdio server modes', async () => {
    const { parseCliCommand } = await import('../src/cli.js');
    expect(parseCliCommand(['--help'])).toEqual({ mode: 'help' });
    expect(parseCliCommand(['--version'])).toEqual({ mode: 'version' });
    expect(parseCliCommand(['--manifest', '--base-url', 'https://example.test'])).toEqual({
      mode: 'manifest',
      json: false,
      baseUrl: 'https://example.test',
    });
    expect(parseCliCommand(['--tools', '--json'])).toEqual({
      mode: 'tools',
      json: true,
      baseUrl: undefined,
    });
    expect(parseCliCommand(['--doctor', '--json'])).toEqual({ mode: 'doctor', json: true });
    expect(parseCliCommand(['--probe', '--json'])).toEqual({ mode: 'probe', json: true });
    expect(parseCliCommand(['--stdio'])).toEqual({ mode: 'server', useStdio: true });
    expect(parseCliCommand([])).toEqual({ mode: 'server', useStdio: false });
  });

  it('builds a doctor report without exposing secrets', async () => {
    const { buildDoctorReport } = await import('../src/cli.js');
    const report = buildDoctorReport({
      BB_CLIENT_ID: 'client-id',
      BB_CLIENT_SECRET: 'secret',
      BB_BASE_URL: 'https://blackboard.example.edu/',
      BB_OAUTH_REDIRECT_URI: 'https://mcp.example.edu/oauth/callback',
      BB_OAUTH_SCOPE: 'read write',
      PORT: '4100',
      PUBLIC_BASE_URL: 'https://mcp.example.edu',
      METRICS_PUSH_URL: 'https://push.example.edu',
      RESTRICTED_TOOLS: 'get_submission_status,get_grade_distribution',
    });

    expect(report.environment.bbClientId).toBe(true);
    expect(report.environment.bbClientSecret).toBe(true);
    expect(report.environment.bbBaseUrl).toBe('https://blackboard.example.edu');
    expect(report.environment.oauthRedirectUri).toBe('https://mcp.example.edu/oauth/callback');
    expect(report.environment.oauthScope).toBe('read write');
    expect(report.environment.port).toBe(4100);
    expect(report.environment.publicBaseUrl).toBe('https://mcp.example.edu');
    expect(report.environment.metricsPushUrl).toBe(true);
    expect(report.environment.restrictedToolCount).toBe(2);
    expect(report.readiness.blackboardCredentialsReady).toBe(true);
    expect(report.readiness.authorizationCodeFlowReady).toBe(true);
  });

  it('formats help text and tool catalog for inspection commands', async () => {
    const { formatDoctorReport, formatProbeReport, formatToolCatalog, getCliHelpText } = await import('../src/cli.js');
    const help = getCliHelpText();
    const catalog = formatToolCatalog('https://example.test');
    const probe = formatProbeReport({
      provider: {
        name: 'blackboard-learn-mcp',
        version: '0.1.0',
      },
      blackboard: {
        baseUrl: 'https://blackboard.example.edu',
        oauth: true,
        api: true,
        sampleCourseCount: 1,
        message: 'Probe succeeded.',
      },
    });

    expect(help).toContain('bb-mcp --manifest');
    expect(help).toContain('bb-mcp --doctor');
    expect(help).toContain('bb-mcp --probe');
    expect(catalog).toContain('get_my_courses');
    expect(catalog).toContain('draft_announcement');
    expect(catalog).toContain('[student, instructor, admin]');
    expect(probe).toContain('OAuth token exchange: ok');
    expect(probe).toContain('Probe succeeded.');

    const doctorText = formatDoctorReport({
      provider: { name: 'blackboard-learn-mcp', version: '0.1.0' },
      environment: {
        bbClientId: true,
        bbClientSecret: true,
        bbBaseUrl: 'https://blackboard.example.edu',
        oauthRedirectUri: 'https://mcp.example.edu/oauth/callback',
        oauthScope: 'read',
        port: 3100,
        publicBaseUrl: 'https://mcp.example.edu',
        metricsPushUrl: false,
        restrictedToolCount: 1,
      },
      readiness: {
        httpServer: true,
        stdioServer: true,
        blackboardCredentialsReady: true,
        authorizationCodeFlowReady: true,
      },
    });

    expect(doctorText).toContain('OAuth redirect URI');
    expect(doctorText).toContain('Auth code flow ready     : yes');
  });
});