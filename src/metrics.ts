/**
 * Lightweight metrics collector.
 *
 * Tracks per-tool call counts, latencies, and errors.
 * Exposes a Prometheus-compatible text format at /metrics.
 * Optionally pushes to a Prometheus push gateway if METRICS_PUSH_URL is set.
 */

import { config } from "./config.js";

interface ToolStats {
  calls: number;
  errors: number;
  totalMs: number;
  lastCalledAt: number | null;
}

const stats = new Map<string, ToolStats>();

function getOrCreate(toolName: string): ToolStats {
  if (!stats.has(toolName)) {
    stats.set(toolName, {
      calls: 0,
      errors: 0,
      totalMs: 0,
      lastCalledAt: null,
    });
  }
  return stats.get(toolName)!;
}

export function recordToolCall(
  toolName: string,
  durationMs: number,
  error: boolean,
): void {
  const s = getOrCreate(toolName);
  s.calls++;
  s.totalMs += durationMs;
  s.lastCalledAt = Date.now();
  if (error) s.errors++;
}

export function getMetricsText(): string {
  const lines: string[] = [
    "# HELP bb_mcp_tool_calls_total Total number of tool invocations",
    "# TYPE bb_mcp_tool_calls_total counter",
  ];

  for (const [name, s] of stats) {
    lines.push(`bb_mcp_tool_calls_total{tool="${name}"} ${s.calls}`);
  }

  lines.push("# HELP bb_mcp_tool_errors_total Total number of tool errors");
  lines.push("# TYPE bb_mcp_tool_errors_total counter");
  for (const [name, s] of stats) {
    lines.push(`bb_mcp_tool_errors_total{tool="${name}"} ${s.errors}`);
  }

  lines.push("# HELP bb_mcp_tool_avg_duration_ms Average tool duration in ms");
  lines.push("# TYPE bb_mcp_tool_avg_duration_ms gauge");
  for (const [name, s] of stats) {
    const avg = s.calls > 0 ? Math.round(s.totalMs / s.calls) : 0;
    lines.push(`bb_mcp_tool_avg_duration_ms{tool="${name}"} ${avg}`);
  }

  return lines.join("\n") + "\n";
}

export function getMetricsSummary(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, s] of stats) {
    out[name] = {
      calls: s.calls,
      errors: s.errors,
      avgMs: s.calls > 0 ? Math.round(s.totalMs / s.calls) : 0,
      errorRate:
        s.calls > 0 ? ((s.errors / s.calls) * 100).toFixed(1) + "%" : "0%",
      lastCalledAt: s.lastCalledAt
        ? new Date(s.lastCalledAt).toISOString()
        : null,
    };
  }
  return out;
}

export async function pushMetrics(): Promise<void> {
  if (!config.metrics.pushUrl) return;
  try {
    const body = getMetricsText();
    await fetch(config.metrics.pushUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body,
    });
  } catch {
    // Non-fatal — metrics push is best-effort
  }
}

/** Wrap an async tool handler with automatic metric recording */
export function withMetrics<T extends unknown[], R>(
  toolName: string,
  fn: (...args: T) => Promise<R>,
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const start = Date.now();
    let error = false;
    try {
      return await fn(...args);
    } catch (err) {
      error = true;
      throw err;
    } finally {
      recordToolCall(toolName, Date.now() - start, error);
    }
  };
}
