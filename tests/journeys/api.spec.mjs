// API journeys: a client talking to the real bb-mcp HTTP server
// (config/playwright.journeys.config.mjs starts `node dist/index.js` on a
// loopback port with dummy Blackboard credentials and a test MCP_API_KEY).
// No real Blackboard is ever contacted: every call here is answered (or
// refused) before bb-mcp would make an upstream request.
import { test, expect, step } from "./journey.mjs";
import { API_PORT, MCP_API_KEY } from "./env.mjs";

const EXPECTED_TOOLS = 40;
const BASE = `http://127.0.0.1:${API_PORT}`;
const MCP_HEADERS = {
  Authorization: `Bearer ${MCP_API_KEY}`,
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};
const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "bb-mcp-journeys", version: "0.0.0" },
  },
};

/** Read a JSON-RPC reply, whether the server answered as JSON or as an SSE event. */
async function rpcResult(response) {
  const body = await response.text();
  const type = response.headers()["content-type"] ?? "";
  const json = type.includes("text/event-stream")
    ? body
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .at(-1)
    : body;
  return JSON.parse(json);
}

/** MCP handshake over streamable HTTP: initialize, then notifications/initialized. */
async function openSession(request) {
  const init = await request.post("/mcp", {
    headers: MCP_HEADERS,
    data: INITIALIZE,
  });
  expect(init.status()).toBe(200);
  const sessionId = init.headers()["mcp-session-id"];
  expect(sessionId).toBeTruthy();
  const reply = await rpcResult(init);
  const headers = { ...MCP_HEADERS, "mcp-session-id": sessionId };
  const ack = await request.post("/mcp", {
    headers,
    data: { jsonrpc: "2.0", method: "notifications/initialized" },
  });
  expect(ack.status()).toBe(202);
  return { headers, init: reply };
}

test(
  "operator checks the server is up",
  { tag: ["@feature:http-sse-transport-support"] },
  async ({ request }) => {
    await step(null, "GET /health answers 200 and reports ok", async () => {
      const res = await request.get("/health");
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("ok");
      expect(body.name).toBe("blackboard-learn-mcp");
      expect(body.version).toBe("0.1.0");
    });
  },
);

test(
  "integrator reads the manifest to see the 40 tools and transports",
  {
    tag: [
      "@feature:standardized-tool-schema",
      "@feature:stdio-transport-support",
      "@feature:http-sse-transport-support",
    ],
  },
  async ({ request }) => {
    let manifest;
    await step(null, "GET /manifest lists exactly 40 tools", async () => {
      const res = await request.get("/manifest");
      expect(res.status()).toBe(200);
      manifest = await res.json();
      expect(manifest.tools).toHaveLength(EXPECTED_TOOLS);
      const names = manifest.tools.map((t) => t.name);
      expect(new Set(names).size).toBe(EXPECTED_TOOLS);
      expect(names).toEqual(
        expect.arrayContaining([
          "get_my_courses",
          "get_upcoming_assignments",
          "get_at_risk_students",
          "update_grade",
          "list_users",
          "get_my_children",
          "create_webhook_subscription",
        ]),
      );
    });
    await step(
      null,
      "the manifest names both transports and the endpoints",
      async () => {
        expect(manifest.capabilities.transports).toEqual({
          stdio: true,
          streamableHttp: { enabled: true, endpoint: `${BASE}/mcp` },
        });
        expect(manifest.endpoints.mcp).toBe(`${BASE}/mcp`);
        expect(manifest.endpoints.manifest).toBe(`${BASE}/manifest`);
      },
    );
    await step(null, "every tool carries its allowed roles", async () => {
      const roles = Object.fromEntries(
        manifest.tools.map((t) => [t.name, t.roles]),
      );
      expect(roles.get_upcoming_assignments).toEqual(["student"]);
      expect(roles.list_users).toEqual(["admin"]);
      expect(roles.get_my_children).toEqual(["parent"]);
      expect(roles.update_grade).toEqual(["instructor", "admin"]);
      expect(manifest.tools.filter((t) => t.roles.length === 0)).toEqual([]);
    });
  },
);

test(
  "client without the bearer token is turned away from /mcp",
  { tag: ["@feature:fail-closed-transport-gate-mcpapikey"] },
  async ({ request }) => {
    await step(
      null,
      "POST /mcp with no Authorization header gets 401",
      async () => {
        const res = await request.post("/mcp", {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
          },
          data: INITIALIZE,
        });
        expect(res.status()).toBe(401);
        expect(await res.json()).toEqual({
          error: "unauthorized",
          message:
            "Missing or invalid Authorization: Bearer <MCP_API_KEY> header.",
        });
      },
    );
    await step(null, "POST /mcp with a wrong key gets 401 too", async () => {
      const res = await request.post("/mcp", {
        headers: { ...MCP_HEADERS, Authorization: "Bearer not-the-key" },
        data: INITIALIZE,
      });
      expect(res.status()).toBe(401);
    });
  },
);

test(
  "client with the key opens an MCP session and lists the 40 tools",
  { tag: ["@feature:mcp-protocol-implementation"] },
  async ({ request }) => {
    let session;
    await step(
      null,
      "initialize returns the server info and a session id",
      async () => {
        session = await openSession(request);
        expect(session.init.result.serverInfo.name).toBe(
          "blackboard-learn-mcp",
        );
        expect(session.init.result.capabilities.tools).toBeDefined();
      },
    );
    await step(
      null,
      "tools/list returns 40 tools matching the manifest",
      async () => {
        const res = await request.post("/mcp", {
          headers: session.headers,
          data: { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
        });
        expect(res.status()).toBe(200);
        const { result } = await rpcResult(res);
        expect(result.tools).toHaveLength(EXPECTED_TOOLS);
        const manifest = await (await request.get("/manifest")).json();
        expect(result.tools.map((t) => t.name).sort()).toEqual(
          manifest.tools.map((t) => t.name).sort(),
        );
      },
    );
  },
);

test(
  "a student tries the admin tool list_users and is denied",
  { tag: ["@feature:rbac-middleware", "@feature:listusers"] },
  async ({ request }) => {
    let session;
    await step(null, "open a session with the API key", async () => {
      session = await openSession(request);
    });
    await step(
      null,
      "list_users as a student returns the RBAC error",
      async () => {
        // ferpa_authorized is true so the FERPA gate (checked first) passes and
        // the role gate is the only possible cause of the refusal.
        const res = await request.post("/mcp", {
          headers: session.headers,
          data: {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: {
              name: "list_users",
              arguments: {
                caller_identity: {
                  userId: "journey-student-1",
                  role: "student",
                  ferpa_authorized: true,
                },
              },
            },
          },
        });
        expect(res.status()).toBe(200);
        const { result } = await rpcResult(res);
        expect(result.isError).toBe(true);
        expect(result.content).toEqual([
          {
            type: "text",
            text: 'Tool "list_users" is not available to role "student". Allowed roles: admin.',
          },
        ]);
      },
    );
  },
);
