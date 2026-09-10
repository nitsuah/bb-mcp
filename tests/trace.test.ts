import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadTraceModule() {
  vi.resetModules();
  return import('../src/trace.js');
}

let stdoutSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  stdoutSpy.mockRestore();
  vi.resetModules();
});

describe('per-request lifecycle tracing', () => {
  it('records a structured trace entry with a request ID and latency for a successful call', async () => {
    const { withTrace, getLocalTraceEntries, __resetTraceForTests } = await loadTraceModule();
    __resetTraceForTests();

    const result = await withTrace('get_my_courses', async () => 'ok');

    expect(result).toBe('ok');
    const { entries, total } = getLocalTraceEntries();
    expect(total).toBe(1);
    expect(entries[0].tool).toBe('get_my_courses');
    expect(entries[0].error).toBe(false);
    expect(entries[0].upstreamCalls).toBe(0);
    expect(typeof entries[0].requestId).toBe('string');
    expect(entries[0].requestId.length).toBeGreaterThan(0);
    expect(entries[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(entries[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('writes the trace entry to stdout as structured JSON', async () => {
    const { withTrace, __resetTraceForTests } = await loadTraceModule();
    __resetTraceForTests();

    await withTrace('get_my_grades', async () => 'ok');

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const written = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(written.event).toBe('trace');
    expect(written.tool).toBe('get_my_grades');
  });

  it('records error=true and still captures latency when the wrapped call throws', async () => {
    const { withTrace, getLocalTraceEntries, __resetTraceForTests } = await loadTraceModule();
    __resetTraceForTests();

    await expect(
      withTrace('create_assignment', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const { entries } = getLocalTraceEntries();
    expect(entries[0].tool).toBe('create_assignment');
    expect(entries[0].error).toBe(true);
  });

  it('counts upstream calls made via noteUpstreamCall within the trace scope', async () => {
    const { withTrace, noteUpstreamCall, getLocalTraceEntries, __resetTraceForTests } =
      await loadTraceModule();
    __resetTraceForTests();

    await withTrace('get_grades', async () => {
      noteUpstreamCall();
      noteUpstreamCall();
      return 'ok';
    });

    const { entries } = getLocalTraceEntries();
    expect(entries[0].upstreamCalls).toBe(2);
  });

  it('does not attribute upstream calls to unrelated concurrent trace scopes', async () => {
    const { withTrace, noteUpstreamCall, getLocalTraceEntries, __resetTraceForTests } =
      await loadTraceModule();
    __resetTraceForTests();

    await Promise.all([
      withTrace('tool_a', async () => {
        noteUpstreamCall();
      }),
      withTrace('tool_b', async () => {
        noteUpstreamCall();
        noteUpstreamCall();
        noteUpstreamCall();
      }),
    ]);

    const { entries } = getLocalTraceEntries();
    const a = entries.find((e) => e.tool === 'tool_a');
    const b = entries.find((e) => e.tool === 'tool_b');
    expect(a?.upstreamCalls).toBe(1);
    expect(b?.upstreamCalls).toBe(3);
  });

  it('is a no-op outside any active trace scope', async () => {
    const { noteUpstreamCall, getCurrentTraceId } = await loadTraceModule();

    expect(() => noteUpstreamCall()).not.toThrow();
    expect(getCurrentTraceId()).toBeUndefined();
  });

  it('returns entries most-recent-first and reports total independent of the requested limit', async () => {
    const { withTrace, getLocalTraceEntries, __resetTraceForTests } = await loadTraceModule();
    __resetTraceForTests();

    await withTrace('first', async () => undefined);
    await withTrace('second', async () => undefined);
    await withTrace('third', async () => undefined);

    const { entries, total } = getLocalTraceEntries(2);
    expect(total).toBe(3);
    expect(entries).toHaveLength(2);
    expect(entries[0].tool).toBe('third');
    expect(entries[1].tool).toBe('second');
  });

  it('bounds the ring buffer to its capacity, dropping the oldest entries', async () => {
    const { withTrace, getLocalTraceEntries, __resetTraceForTests } = await loadTraceModule();
    __resetTraceForTests();

    for (let i = 0; i < 1005; i++) {
      await withTrace(`tool_${i}`, async () => undefined);
    }

    const { entries, total } = getLocalTraceEntries(1000);
    expect(total).toBe(1000);
    expect(entries[0].tool).toBe('tool_1004');
    expect(entries[entries.length - 1].tool).toBe('tool_5');
  });
});
