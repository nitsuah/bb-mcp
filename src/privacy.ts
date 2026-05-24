/**
 * Privacy helpers for audit log redaction and stable subject anonymization.
 */
import { createHash } from "crypto";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const LONG_ID_PATTERN = /\b[0-9A-Za-z_-]{18,}\b/g;

export function hashIdentifier(value: string): string {
  const digest = createHash("sha256").update(value).digest("hex");
  return digest.slice(0, 12);
}

export function toAuditSubject(userId: string): string {
  return `anon:${hashIdentifier(userId)}`;
}

export function scrubLogText(value: string): string {
  return value
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(LONG_ID_PATTERN, "[redacted-id]");
}
