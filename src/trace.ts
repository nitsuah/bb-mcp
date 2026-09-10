/**
 * Per-request lifecycle tracing.
 *
 * `metrics.ts` answers "how is tool X doing in aggregate" (call counts,
 * error rate, average latency). This module answers "what happened on this
 * one call" — a structured trace entry per tool invocation carrying a
 * request ID, total latency, and how many upstream Blackboard HTTP calls it
 * made. Wired into `withMetrics()` so every tool handler in `src/tools/*.ts`
 * gets it automatically, the same way PII output-scrubbing is.
 *
 * Each entry is written to stdout as structured JSON (same convention as
 * auth.ts's access-audit log) for ingestion by any log aggregator, and kept
 * in a bounded in-memory ring buffer for local inspection/testing.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

interface TraceStore {
  requestId: string;
  tool: string;
  upstreamCalls: number;
}

const als = new AsyncLocalStorage<TraceStore>();

export interface TraceEntry {
  requestId: string;
  tool: string;
  timestamp: string;
  durationMs: number;
  upstreamCalls: number;
  error: boolean;
}

const TRACE_CAPACITY = 1000;
const traceBuffer: TraceEntry[] = [];

function recordTrace(entry: TraceEntry): void {
  traceBuffer.push(entry);
  if (traceBuffer.length > TRACE_CAPACITY) {
    traceBuffer.splice(0, traceBuffer.length - TRACE_CAPACITY);
  }
}

/**
 * Called from bb-client's request interceptor to count an upstream
 * Blackboard HTTP call against whichever tool call is currently in scope.
 * Outside a traced tool call (server startup, CLI --probe/--doctor) this is
 * a no-op — there's no active request to attribute the call to.
 */
export function noteUpstreamCall(): void {
  const store = als.getStore();
  if (store) store.upstreamCalls += 1;
}

/** Returns the request ID of the currently-executing traced tool call, if any. */
export function getCurrentTraceId(): string | undefined {
  return als.getStore()?.requestId;
}

/**
 * Runs `fn` inside a fresh trace scope, recording a structured trace entry
 * once it settles (success or throw) — total latency and upstream call
 * count are always captured, whichever way the call ends.
 */
export async function withTrace<T>(
  tool: string,
  fn: () => Promise<T>,
): Promise<T> {
  const requestId = randomUUID();
  const store: TraceStore = { requestId, tool, upstreamCalls: 0 };
  const start = Date.now();
  let error = false;
  try {
    return await als.run(store, fn);
  } catch (err) {
    error = true;
    throw err;
  } finally {
    const entry: TraceEntry = {
      requestId,
      tool,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
      upstreamCalls: store.upstreamCalls,
      error,
    };
    process.stdout.write(JSON.stringify({ event: "trace", ...entry }) + "\n");
    recordTrace(entry);
  }
}

/** Read back the server's own local trace buffer (most recent first). */
export function getLocalTraceEntries(limit = 50): {
  entries: TraceEntry[];
  total: number;
} {
  const ordered = traceBuffer.slice().reverse();
  return { entries: ordered.slice(0, limit), total: traceBuffer.length };
}

export function __resetTraceForTests(): void {
  traceBuffer.length = 0;
}
