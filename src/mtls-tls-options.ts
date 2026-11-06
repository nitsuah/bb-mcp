/**
 * Build direct mTLS listener options. Optional mode does not request client
 * certificates; required mode requests and validates them against the configured CA.
 */
export type DirectMtlsMode =
  "disabled" | "optional" | "required" | "trusted-proxy";

/**
 * Validate the startup requirements for direct mTLS modes.
 * Optional mode uses OIDC over HTTPS but does not request or verify client
 * certificates, so it needs the server certificate/key but no client CA.
 */
export function assertDirectMtlsStartupConfig(
  mode: DirectMtlsMode,
  tlsConfigured: boolean,
  caPath: string | null | undefined,
): void {
  if (mode === "optional" && !tlsConfigured) {
    throw new Error(
      "OIDC_MTLS_MODE=optional requires TLS_CERT_PATH and TLS_KEY_PATH.",
    );
  }
  if (mode === "required" && (!tlsConfigured || !caPath)) {
    throw new Error(
      "OIDC_MTLS_MODE=required requires TLS_CERT_PATH, TLS_KEY_PATH and MTLS_CA_PATH (the trusted client-certificate CA bundle).",
    );
  }
}

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
  if (mode === "optional") return {};
  // trusted-proxy terminates mTLS upstream; this listener must not request a
  // direct client certificate in that mode.
  return {};
}

/**
 * Assemble the exact options passed to https.createServer. Read the client CA
 * only in required mode; optional mode does not request or verify client
 * certificates, and disabled/trusted-proxy do not use a client CA.
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
  const ca = mode === "required" && caPath ? readFile(caPath) : undefined;

  return {
    cert: readFile(certPath),
    key: readFile(keyPath),
    ...getDirectMtlsTlsOptions(mode, ca),
  };
}
