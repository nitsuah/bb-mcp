/**
 * Build direct mTLS listener options. Optional mode does not request client
 * certificates; required mode requests and validates them against the configured CA.
 */
export type DirectMtlsMode = "disabled" | "optional" | "required" | "trusted-proxy";

export function getDirectMtlsTlsOptions(
  mode: DirectMtlsMode,
  ca?: Buffer,
): { requestCert?: boolean; rejectUnauthorized?: boolean; ca?: Buffer } {
  if (mode === "required") {
    return {
      requestCert: true,
      rejectUnauthorized: true,
      ...(ca ? { ca } : {}),
    };
  }
  if (mode === "optional") return ca ? { ca } : {};
  // trusted-proxy terminates mTLS upstream; this listener must not request a
  // direct client certificate in that mode.
  return {};
}

/**
 * Assemble the exact options passed to https.createServer. Read the client CA
 * only in direct modes that use it; disabled/trusted-proxy must not fail
 * startup because an irrelevant CA path is missing or unreadable.
 */
export function buildHttpsServerOptions(
  mode: DirectMtlsMode,
  certPath: string,
  keyPath: string,
  caPath: string | null | undefined,
  readFile: (path: string) => Buffer,
): {
  cert: Buffer;
  key: Buffer;
  requestCert?: boolean;
  rejectUnauthorized?: boolean;
  ca?: Buffer;
} {
  const ca =
    (mode === "optional" || mode === "required") && caPath
      ? readFile(caPath)
      : undefined;

  return {
    cert: readFile(certPath),
    key: readFile(keyPath),
    ...getDirectMtlsTlsOptions(mode, ca),
  };
}
