/**
 * Build direct mTLS listener options. Optional mode does not request client
 * certificates; required mode requests and validates them against the configured CA.
 */
export function getDirectMtlsTlsOptions(
  mode: "disabled" | "optional" | "required" | "trusted-proxy",
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
