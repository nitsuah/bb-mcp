import { AsyncLocalStorage } from "node:async_hooks";

export type VerifiedRole = "student" | "instructor" | "admin" | "parent";

export interface VerifiedCallerIdentity {
  userId: string;
  role: VerifiedRole;
  ferpa_authorized: boolean;
  clientApp?: string;
}

const requestIdentity = new AsyncLocalStorage<VerifiedCallerIdentity>();

/** Run a single HTTP request under the identity established by server-side authentication. */
export function runWithVerifiedIdentity<T>(
  identity: VerifiedCallerIdentity,
  callback: () => T,
): T {
  return requestIdentity.run(identity, callback);
}

/** Identity is only present when the HTTP boundary has verified an OIDC token. */
export function getVerifiedIdentity(): VerifiedCallerIdentity | undefined {
  return requestIdentity.getStore();
}
