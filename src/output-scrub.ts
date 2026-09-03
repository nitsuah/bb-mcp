/**
 * Tool-output PII scrubbing.
 *
 * `src/privacy.ts` scrubs the server's own structured audit logs (stdout).
 * That left a gap flagged across two prior audit cycles: raw student data
 * returned *to the MCP client* in tool response payloads (`src/tools/*.ts`)
 * was never sanitized. This module closes that gap by scrubbing the actual
 * response payload every tool hands back, before it leaves the server.
 *
 * Design constraints (why this isn't a blanket redact-everything pass):
 *  - Opaque identifiers (`id`, `courseId`, `columnId`, `userId`, `threadId`,
 *    `authorId`, ...) are structurally indistinguishable from the "long
 *    opaque token" pattern used for PII redaction in log text (see
 *    `LONG_ID_PATTERN` in privacy.ts), but callers — and chained tool calls,
 *    e.g. list_roster's userId feeding get_grades — depend on getting the
 *    real value back. Applying that pattern to arbitrary tool-output *prose*
 *    is also unsafe in a way log scrubbing isn't: log `reason` strings are
 *    short and server-generated, but a discussion post body, feedback
 *    comment, or announcement can legitimately contain any long unbroken
 *    token (a URL, a hash a student pasted, even a long word) and silently
 *    mangling that isn't a fix, it's data corruption. So this module does
 *    NOT reuse the long-ID pattern at all — only structured contact-PII
 *    fields and embedded email addresses are scrubbed.
 *  - Direct contact-PII fields (`email` / `emailAddress`) are always masked,
 *    by key name, everywhere they appear.
 *  - Embedded email addresses are stripped out of every string value,
 *    keyed or not — an email doesn't collide with any legitimate opaque
 *    identifier or prose shape, so this has no meaningful false-positive
 *    risk (unlike the long-ID case above).
 *  - Names, scores, and other fields that are the literal purpose of an
 *    RBAC- and FERPA-gated tool response are left intact; redacting them
 *    would silently break the tool for its authorized caller.
 */
import { EMAIL_PATTERN } from "./privacy.js";

/** Field keys whose string value is direct contact PII and always fully masked. */
const EMAIL_FIELD_KEYS = new Set(["email", "emailAddress"]);

function scrubString(key: string | null, value: string): string {
  if (value.length === 0) return value;

  if (key && EMAIL_FIELD_KEYS.has(key)) {
    return "[redacted-email]";
  }

  // Embedded email addresses are stripped everywhere — see module docs for
  // why this (and only this) pattern is safe to apply unconditionally to
  // free-form prose.
  return value.replace(EMAIL_PATTERN, "[redacted-email]");
}

function scrubNode(value: unknown, key: string | null): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => scrubNode(item, key));
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      out[childKey] = scrubNode(childValue, childKey);
    }
    return out;
  }

  if (typeof value === "string") {
    return scrubString(key, value);
  }

  return value;
}

/** Deep-scrub PII out of an arbitrary JSON-serializable tool payload. */
export function scrubToolOutput<T>(value: T): T {
  return scrubNode(value, null) as T;
}

interface McpTextContent {
  type: "text";
  text: string;
  [extra: string]: unknown;
}

interface McpToolResult {
  content?: Array<McpTextContent | Record<string, unknown>>;
  [extra: string]: unknown;
}

function isTextContent(
  block: McpTextContent | Record<string, unknown>,
): block is McpTextContent {
  return (
    !!block &&
    (block as Record<string, unknown>).type === "text" &&
    typeof (block as Record<string, unknown>).text === "string"
  );
}

/**
 * Scrub the standard MCP tool-call envelope (`{ content: [{ type: "text",
 * text }] }`) returned by every handler in `src/tools/*.ts`.
 *
 * Each text block's payload is almost always JSON produced by
 * `JSON.stringify(...)`; when it parses, the scrub runs on the object tree
 * (key-aware, see module docs) and is re-serialized with the same
 * formatting. Plain-text blocks (e.g. "No grade found for this
 * assignment.") fall back to a flat embedded-email scrub of the string.
 * Anything that isn't the expected shape is returned unchanged.
 */
export function scrubMcpToolResult<T>(result: T): T {
  if (!result || typeof result !== "object") return result;

  const candidate = result as unknown as McpToolResult;
  if (!Array.isArray(candidate.content)) return result;

  const scrubbedContent = candidate.content.map((block) => {
    if (!isTextContent(block)) return block;

    try {
      const parsed = JSON.parse(block.text);
      const scrubbed = scrubToolOutput(parsed);
      return { ...block, text: JSON.stringify(scrubbed, null, 2) };
    } catch {
      // Not JSON — a plain-text tool message. Still strip any embedded
      // email PII rather than leaving it untouched.
      return {
        ...block,
        text: block.text.replace(EMAIL_PATTERN, "[redacted-email]"),
      };
    }
  });

  return { ...candidate, content: scrubbedContent } as unknown as T;
}
