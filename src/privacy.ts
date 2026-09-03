/**
 * Privacy helpers for audit log redaction, tool-output sanitization, and
 * stable subject anonymization.
 */
import { createHash } from "crypto";

// Exported so other modules (output-scrub.ts) can reuse the exact same
// detection rules instead of drifting out of sync with the log scrubber.
export const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
export const LONG_ID_PATTERN = /\b[0-9A-Za-z_-]{18,}\b/g;

export function hashIdentifier(value: string): string {
  const digest = createHash("sha256").update(value).digest("hex");
  return digest.slice(0, 12);
}

export function toAuditSubject(userId: string): string {
  return `anon:${hashIdentifier(userId)}`;
}

/** Redact embedded email addresses only (leaves opaque IDs like courseId intact). */
export function scrubEmails(value: string): string {
  return value.replace(EMAIL_PATTERN, "[redacted-email]");
}

/** Redact embedded email addresses and long opaque-ID-shaped tokens. */
export function scrubLogText(value: string): string {
  return value
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(LONG_ID_PATTERN, "[redacted-id]");
}
