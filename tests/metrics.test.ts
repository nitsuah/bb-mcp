import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadMetricsModule() {
  vi.resetModules();
  process.env.BB_CLIENT_ID ??= 'test-client-id';
  process.env.BB_CLIENT_SECRET ??= 'test-client-secret';
  return import('../src/metrics.js');
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.BB_CLIENT_ID = 'test-client-id';
  process.env.BB_CLIENT_SECRET = 'test-client-secret';
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe('metrics collector', () => {
  it('records tool calls, errors, and average durations', async () => {
    const { getMetricsSummary, recordToolCall } = await loadMetricsModule();

    recordToolCall('tool_a', 100, false);
    recordToolCall('tool_a', 300, true);

    const summary = getMetricsSummary() as Record<string, any>;
    expect(summary.tool_a.calls).toBe(2);
    expect(summary.tool_a.errors).toBe(1);
    expect(summary.tool_a.avgMs).toBe(200);
    expect(summary.tool_a.errorRate).toBe('50.0%');
    expect(summary.tool_a.lastCalledAt).toBeTruthy();
  });

  it('renders Prometheus metrics text with all counters and gauges', async () => {
    const { getMetricsText, recordToolCall } = await loadMetricsModule();

    recordToolCall('tool_alpha', 40, false);
    recordToolCall('tool_alpha', 60, true);

    const text = getMetricsText();
    expect(text).toContain('bb_mcp_tool_calls_total{tool="tool_alpha"} 2');
    expect(text).toContain('bb_mcp_tool_errors_total{tool="tool_alpha"} 1');
    expect(text).toContain('bb_mcp_tool_avg_duration_ms{tool="tool_alpha"} 50');
  });

  it('returns an empty summary object before any calls are recorded', async () => {
    const { getMetricsSummary } = await loadMetricsModule();
    expect(getMetricsSummary()).toEqual({});
  });

  it('skips push when metrics push URL is not configured', async () => {
    delete process.env.METRICS_PUSH_URL;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { pushMetrics, recordToolCall } = await loadMetricsModule();
    recordToolCall('tool_beta', 25, false);

    await pushMetrics();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('pushes metrics payload to configured endpoint', async () => {
    process.env.METRICS_PUSH_URL = 'https://push.example.edu/metrics/job/bb-mcp';
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);

    const { pushMetrics, recordToolCall } = await loadMetricsModule();
    recordToolCall('tool_gamma', 10, false);

    await pushMetrics();

    expect(fetchSpy).toHaveBeenCalledOnce();
    const call = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe('https://push.example.edu/metrics/job/bb-mcp');
    expect(call[1].method).toBe('POST');
    expect(call[1].headers).toEqual({ 'Content-Type': 'text/plain' });
    expect(String(call[1].body)).toContain('bb_mcp_tool_calls_total{tool="tool_gamma"} 1');
  });

  it('swallows push errors because export is best-effort', async () => {
    process.env.METRICS_PUSH_URL = 'https://push.example.edu/metrics/job/bb-mcp';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const { pushMetrics } = await loadMetricsModule();

    await expect(pushMetrics()).resolves.toBeUndefined();
  });

  it('withMetrics records successful calls', async () => {
    const { getMetricsSummary, withMetrics } = await loadMetricsModule();

    const wrapped = withMetrics('tool_success', async (name: string) => `hello ${name}`);
    const result = await wrapped('world');

    expect(result).toBe('hello world');

    const summary = getMetricsSummary() as Record<string, any>;
    expect(summary.tool_success.calls).toBe(1);
    expect(summary.tool_success.errors).toBe(0);
  });

  it('withMetrics records failures and rethrows original errors', async () => {
    const { getMetricsSummary, withMetrics } = await loadMetricsModule();

    const wrapped = withMetrics('tool_failure', async () => {
      throw new Error('boom');
    });

    await expect(wrapped()).rejects.toThrow('boom');

    const summary = getMetricsSummary() as Record<string, any>;
    expect(summary.tool_failure.calls).toBe(1);
    expect(summary.tool_failure.errors).toBe(1);
  });
});
