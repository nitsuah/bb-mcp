import { describe, expect, it } from 'vitest';
import { signWebhookBody, verifyWebhookSignature } from '../src/webhook-signature.js';

const BODY = '{"event":"grade.updated"}';
const SECRET = 'shared-secret';

describe('signWebhookBody', () => {
  it('returns 64 lowercase hex characters', () => {
    expect(signWebhookBody('a', 'k')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives the same signature for a Buffer and the equal string body', () => {
    expect(signWebhookBody(Buffer.from(BODY), SECRET)).toBe(signWebhookBody(BODY, SECRET));
  });
});

describe('verifyWebhookSignature', () => {
  const sig = signWebhookBody(BODY, SECRET);

  it('accepts a valid signature', () => {
    expect(verifyWebhookSignature(BODY, sig, SECRET)).toBe(true);
  });

  it('accepts a sha256= prefix and upper-case hex', () => {
    expect(verifyWebhookSignature(BODY, `sha256=${sig}`, SECRET)).toBe(true);
    expect(verifyWebhookSignature(BODY, sig.toUpperCase(), SECRET)).toBe(true);
  });

  it('accepts a Buffer body', () => {
    expect(verifyWebhookSignature(Buffer.from(BODY), sig, SECRET)).toBe(true);
  });

  it('rejects a changed body and a wrong secret', () => {
    expect(verifyWebhookSignature(`${BODY} `, sig, SECRET)).toBe(false);
    expect(verifyWebhookSignature(BODY, sig, 'other-secret')).toBe(false);
  });

  it('rejects an empty or missing secret', () => {
    expect(verifyWebhookSignature(BODY, sig, '')).toBe(false);
    expect(verifyWebhookSignature(BODY, sig, undefined)).toBe(false);
    expect(verifyWebhookSignature(BODY, sig, null)).toBe(false);
  });

  it('rejects an empty or missing header', () => {
    expect(verifyWebhookSignature(BODY, '', SECRET)).toBe(false);
    expect(verifyWebhookSignature(BODY, undefined, SECRET)).toBe(false);
    expect(verifyWebhookSignature(BODY, null, SECRET)).toBe(false);
  });

  it('rejects short and non-hex signatures', () => {
    expect(verifyWebhookSignature(BODY, sig.slice(0, 32), SECRET)).toBe(false);
    expect(verifyWebhookSignature(BODY, 'z'.repeat(64), SECRET)).toBe(false);
  });
});
