/**
 * Constant-time HMAC-SHA256 verification for inbound webhook bodies.
 * Verification primitive only; route and secret wiring live elsewhere.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Lowercase hex HMAC-SHA256 of the raw request body. */
export function signWebhookBody(
  rawBody: string | Buffer,
  secret: string,
): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

/**
 * Verify a hex HMAC-SHA256 signature (optionally prefixed "sha256=") against the raw body.
 * Constant-time compare; returns false for a missing secret, a missing header or a malformed signature.
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | undefined | null,
  secret: string | undefined | null,
): boolean {
  if (!secret || !signatureHeader) return false;
  const provided = signatureHeader
    .trim()
    .replace(/^sha256=/i, "")
    .toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(provided)) return false;
  const expected = signWebhookBody(rawBody, secret);
  return timingSafeEqual(
    Buffer.from(provided, "hex"),
    Buffer.from(expected, "hex"),
  );
}
