# TASKS

Last Updated: 2026-09-23

## Done

_All foundation, Q2, and Q3 work is shipped and condensed into `docs/ROADMAP.md`
(milestones), `docs/FEATURES.md` (shipped tool/capability catalog), and
`CHANGELOG.md` (change-by-change history) — see those files rather than a
duplicated narrative here._

## In Progress

## Todo

### P1 - High

_None open._

### P2 - Medium

- [ ] Bind `caller_identity` to real end-user authentication instead of trusting the client's claim.
  - Priority: P2
  - Context: `auth.ts` intentionally delegates end-user identity verification to the calling MCP client (documented in its module docstring) — `parseIdentity` trusts whatever `userId`/`role`/`ferpa_authorized` the request supplies. `MCP_API_KEY` (PR #115) closes the transport-level gap for any non-loopback deployment (the server refuses to start without a key at all beyond loopback, so a client without one can't reach `/mcp`) but doesn't verify that a client *holding* the key is telling the truth about who's asking — and a loopback-bound deployment still allows any local client through with no key at all, by design. The OAuth authorization-code flow in `oauth.ts` produces application-level Blackboard API sessions, not per-end-user identity tokens usable for this. Flagged by CodeRabbit on PR #115 (2026-09-09); deliberately deferred rather than redesigning the identity model blind under a review pass — needs a real design decision (e.g. requiring the calling client to forward a verified Blackboard/SSO identity token bb-mcp can validate per request) rather than a rushed fix.
  - Acceptance Criteria: a request's `caller_identity` claims are checked against some server-verifiable proof of the actual end user, not accepted as-is from the request body.

- [ ] Add JSON schemas for all shipped tool inputs.

### P3 - Exploratory

- [ ] Add `search_users` (admin directory lookup).
  - Priority: P3
  - Context: admin directory lookup is useful, but not part of the initial foundation path.
  - Acceptance Criteria: administrators can query user records safely.

- [ ] **Analytics/Product Owner tools**: event telemetry tap, engagement metrics aggregation, AI recommendation signal export. See ROADMAP.md 2027 section — depends on the event pipeline below.
- [ ] **Blackboard activity ingestion**: define an event schema for grade posts, submission events, login activity, and course changes. See ROADMAP.md 2027 section.

### 2027 (moved from Q3 — needs a real subsystem, not a tool-sized change)

See ROADMAP.md `## 2027` for the full writeup on each of these.

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
4. Before describing a PR's CI/review state, check `git log` — don't trust the last audit's snapshot without re-verifying.
-->
