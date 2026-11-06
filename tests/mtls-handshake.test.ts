import {
  createPublicKey,
  generateKeyPairSync,
  sign,
  type KeyObject,
} from "node:crypto";
import { once } from "node:events";
import https from "node:https";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildHttpsServerOptions,
  type DirectMtlsMode,
} from "../src/mtls-tls-options.js";

/**
 * Loopback TLS handshake coverage for the direct mTLS modes. The option-object
 * assertions in oidc-auth.test.ts do not prove behaviour: Node only applies
 * rejectUnauthorized on a server when requestCert is true. These tests start a
 * real https server from buildHttpsServerOptions and connect to it.
 *
 * Certificates are minted in-process (minimal DER X.509, ECDSA P-256) so the
 * test needs no openssl binary and no committed key material.
 */

// ---- minimal DER / X.509 helpers (test only) ------------------------------

const der = (tag: number, ...parts: Buffer[]): Buffer => {
  const body = Buffer.concat(parts);
  const len =
    body.length < 0x80
      ? Buffer.from([body.length])
      : body.length < 0x100
        ? Buffer.from([0x81, body.length])
        : Buffer.from([0x82, body.length >> 8, body.length & 0xff]);
  return Buffer.concat([Buffer.from([tag]), len, body]);
};
const seq = (...p: Buffer[]) => der(0x30, ...p);
const set = (...p: Buffer[]) => der(0x31, ...p);
const oid = (bytes: number[]) => der(0x06, Buffer.from(bytes));
const utf8 = (s: string) => der(0x0c, Buffer.from(s, "utf8"));
const utcTime = (d: Date) =>
  der(
    0x17,
    Buffer.from(
      d
        .toISOString()
        .replace(
          /^\d\d(\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d).*$/,
          "$1$2$3$4$5$6Z",
        ),
    ),
  );

const OID_ECDSA_SHA256 = [0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02];
const OID_COMMON_NAME = [0x55, 0x04, 0x03];
const OID_BASIC_CONSTRAINTS = [0x55, 0x1d, 0x13];

const name = (cn: string) => seq(set(seq(oid(OID_COMMON_NAME), utf8(cn))));

interface Identity {
  cert: string;
  key: string;
}

let serial = 1;

function issue(
  subjectCn: string,
  subjectKey: KeyObject,
  issuerCn: string,
  issuerKey: KeyObject,
  isCa: boolean,
): string {
  const now = Date.now();
  const sigAlg = seq(oid(OID_ECDSA_SHA256));
  const extensions = isCa
    ? [
        der(
          0xa3,
          seq(
            seq(
              oid(OID_BASIC_CONSTRAINTS),
              der(0x01, Buffer.from([0xff])), // critical
              der(0x04, seq(der(0x01, Buffer.from([0xff])))), // cA: TRUE
            ),
          ),
        ),
      ]
    : [];
  const tbs = seq(
    der(0xa0, der(0x02, Buffer.from([0x02]))), // v3
    der(0x02, Buffer.from([serial++])),
    sigAlg,
    name(issuerCn),
    seq(
      utcTime(new Date(now - 24 * 3600 * 1000)),
      utcTime(new Date(now + 24 * 3600 * 1000)),
    ),
    name(subjectCn),
    createPublicKey(subjectKey).export({ type: "spki", format: "der" }),
    ...extensions,
  );
  const signature = sign("sha256", tbs, issuerKey); // DER-encoded for EC keys
  const certDer = seq(
    tbs,
    sigAlg,
    der(0x03, Buffer.concat([Buffer.from([0]), signature])),
  );
  const b64 = certDer
    .toString("base64")
    .match(/.{1,64}/g)!
    .join("\n");
  return `-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----\n`;
}

function newKey(): KeyObject {
  return generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey;
}
const keyPem = (k: KeyObject) =>
  k.export({ type: "pkcs8", format: "pem" }).toString();

function makeCa(cn: string) {
  const key = newKey();
  return { key, cn, cert: issue(cn, key, cn, key, true) };
}
function makeLeaf(cn: string, ca: { key: KeyObject; cn: string }): Identity {
  const key = newKey();
  return { cert: issue(cn, key, ca.cn, ca.key, false), key: keyPem(key) };
}

// ---- fixtures -------------------------------------------------------------

const trustedCa = makeCa("bb-mcp test trusted client CA");
const untrustedCa = makeCa("bb-mcp test untrusted client CA");
const serverCa = makeCa("bb-mcp test server CA");
const serverIdentity = makeLeaf("localhost", serverCa);
const trustedClient = makeLeaf("trusted-client", trustedCa);
const untrustedClient = makeLeaf("untrusted-client", untrustedCa);

const files: Record<string, Buffer> = {
  "server-cert.pem": Buffer.from(serverIdentity.cert),
  "server-key.pem": Buffer.from(serverIdentity.key),
  "client-ca.pem": Buffer.from(trustedCa.cert),
};
const readFile = (path: string): Buffer => {
  const data = files[path];
  if (!data) throw new Error(`unexpected read of ${path}`);
  return data;
};

const servers: https.Server[] = [];

async function startServer(mode: DirectMtlsMode): Promise<number> {
  const server = https.createServer(
    buildHttpsServerOptions(
      mode,
      "server-cert.pem",
      "server-key.pem",
      "client-ca.pem",
      readFile,
    ),
    (_req, res) => res.end("ok"),
  );
  // Rejected handshakes surface as tlsClientError; they are expected here.
  server.on("tlsClientError", () => undefined);
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return (server.address() as AddressInfo).port;
}

/** Resolves with the response body, or rejects if the handshake/request fails. */
function request(port: number, client?: Identity): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      {
        host: "127.0.0.1",
        port,
        path: "/",
        agent: false,
        ca: serverCa.cert,
        // The server cert is for "localhost"; the test connects by IP.
        checkServerIdentity: () => undefined,
        ...(client ? { cert: client.cert, key: client.key } : {}),
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve(body));
      },
    );
    req.on("error", reject);
    req.setTimeout(5000, () => req.destroy(new Error("timeout")));
  });
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise<void>((resolve) => {
          s.closeAllConnections();
          s.close(() => resolve());
        }),
    ),
  );
});

describe("direct mTLS loopback handshake", () => {
  it("required mode accepts a client certificate signed by the configured CA", async () => {
    const port = await startServer("required");
    await expect(request(port, trustedClient)).resolves.toBe("ok");
  });

  it("required mode rejects a client that presents no certificate", async () => {
    const port = await startServer("required");
    await expect(request(port)).rejects.toThrow();
  });

  it("required mode rejects a client certificate from an untrusted CA", async () => {
    const port = await startServer("required");
    await expect(request(port, untrustedClient)).rejects.toThrow();
  });

  it("optional mode accepts a client that presents no certificate", async () => {
    const port = await startServer("optional");
    await expect(request(port)).resolves.toBe("ok");
  });

  it("optional mode does not request a client certificate", async () => {
    const port = await startServer("optional");
    // An untrusted certificate is neither requested nor validated, so it is
    // never treated as authentication: identity comes from the OIDC token.
    await expect(request(port, untrustedClient)).resolves.toBe("ok");
  });
});
