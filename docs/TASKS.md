# TASKS

> 🧭 [bb-mcp](../README.md) · [Features](./FEATURES.md) · [Roadmap](./ROADMAP.md) · **Tasks** · [Changelog](./CHANGELOG.md) · [Metrics](./METRICS.md) <!-- nav -->

Last Updated: 2026-10-15

## Done

_All completed foundation, 2026 Q2, and 2026 Q3 work is shipped and condensed into
`docs/FEATURES.md` (shipped tool/capability catalog) and `docs/CHANGELOG.md`
(change-by-change history)._

## In Progress

## Todo

- [ ] Capture for promo: course-courseid (generate a visual of a `course://{courseId}` resource read, an MCP resource response from a fixture; extend scripts/visual-docs.mjs).

### P1 - High


### P2 - Medium

- [ ] **[2027-Q1]** Bind `caller_identity` to real end-user authentication instead of trusting the client's claim.
  - Priority: P2
  - Context: implementation is underway on `feat/oidc-verified-caller-identity`: provider-neutral RS256 JWT verification against configured issuer, audience and JWKS; verified identity bound to each HTTP request; signed role/FERPA claims; mandatory OIDC on non-loopback deployments; and direct or trusted-proxy mTLS modes. The existing Blackboard OAuth flow remains separate because it yields Blackboard API sessions, not institutional end-user identity tokens. Keep this task open until the implementation and CI checks are reviewed and green.
  - Acceptance Criteria: a request's `caller_identity` claims are checked against some server-verifiable proof of the actual end user, not accepted as-is from the request body.

### P3 - Exploratory

- [ ] Add `search_users` (admin directory lookup).
  - Priority: P3
  - Context: admin directory lookup is useful, but not part of the initial foundation path.
  - Acceptance Criteria: administrators can query user records safely.

- [ ] **Analytics/Product Owner tools**: event telemetry tap, engagement metrics aggregation, AI recommendation signal export. See ROADMAP.md 2027 Q1 — depends on the event pipeline below.
- [ ] **Blackboard activity ingestion**: define an event schema for grade posts, submission events, login activity, and course changes. See ROADMAP.md 2027 Q1.

### 2027 Q1 — needs scoping (moved from 2026 Q3; a real subsystem, not a tool-sized change)

See ROADMAP.md `## 2027 Q1` → *Needs scoping* for the full writeup on each of these.

- [ ] Webhook-to-SSE bridge — receive and authenticate inbound Blackboard webhook calls, fan out to active SSE sessions.
- [ ] Event-driven pipeline scaling — normalized event schema + durable storage decision, ahead of "scaling" being a meaningful question.
- [ ] Vector store integration for semantic course content search and AI recommendation signals — needs an RBAC/FERPA-safe indexing pipeline, not just a vector store.
- [ ] Publish a stable MCP client SDK / integration contract — a versioned deliverable on top of `GET /manifest`, separate from bb-mcp itself.
- [ ] Tool call batching — needs a batch envelope + partial-failure semantics decision at the transport layer.

<!--
AGENT INSTRUCTIONS:
1. Keep the foundation work separate from later tools.
2. Use short task bullets with one context line and one acceptance line.
3. When an item finishes, remove it from Todo rather than parking a verbose
   narrative in Done — condense the outcome into `docs/ROADMAP.md` (milestone),
   `docs/FEATURES.md` (shipped capability), or `CHANGELOG.md` (Unreleased),
   extending an existing entry there if one already covers that area.
4. Before describing a PR's CI/review state, check current PR metadata and checks (`gh pr view <n> --json state,statusCheckRollup,reviewDecision`) — don't trust the last audit's snapshot without re-verifying.
-->
