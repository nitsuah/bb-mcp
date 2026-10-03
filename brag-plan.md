# brag-plan.md — bb-mcp

## What is it?
A standalone MCP server wrapping the Blackboard Learn REST API — point any MCP-compatible client (Claude Desktop, Cursor, agent-board) at it and get structured access to courses, grades, assignments, announcements, and more.

## Who is it for, and what does it do for them?
- **Students** — "What's due this week?" "How am I doing in CS101?" — answers in seconds, no LMS click-mine.
- **Instructors** — "Who hasn't submitted?" "Class average on the midterm?" "Draft a 'reminder' announcement in my voice" — FERPA-gated, one tool call.
- **Admins** — "List all enrollments for term 2026" "Audit who accessed grades" — same server, role-gated.
- **Guardians** — "Show my kid's upcoming work" — read-only, guardian-scoped.
- **AI builders** — Drop-in MCP server; build an agent once, it works everywhere.

## What sets it apart?
- **40+ tools, 5 personas** — student, instructor, grade-writeback, admin, parent — all from one server.
- **Security first** — `MCP_API_KEY` fail-closed transport gate (when configured), per-role rate limits, FERPA gate on sensitive tools, email scrubbing on successful registered tool responses, local audit trail.
- **Docker-first** — hardened multi-stage build, read-only fs, dropped caps, `no-new-privileges`, Makefile targets for dev/prod.
- **Zero-credential dev loop** — free Blackboard developer sandbox; `npm run inspect` validates the MCP contract without any live API keys.
- **Production observability** — Prometheus `/metrics`, structured JSON access logs, per-request tracing, `--doctor`/ `--probe` CLI for operators.

## Most impressive/funny claim?
"Blackboard's own team points internal tooling at this server without touching frontend code." — the LMS vendor dogfoods the wrapper. (Self-reported; not independently verified.)

## Visual hook?
The **architecture diagram** from the README — client on left, bb-mcp in middle, Blackboard on right — animated: a tool call flows left→center→right, response emits metrics, scrubs emails on successful tool responses, returns clean JSON. One frame = the whole value prop.

## Real UI/flow to show?
1. **Student asks**: "What's due?" → `get_upcoming_assignments` → clean list with due dates.
2. **Instructor asks**: "Who's at risk?" → `get_at_risk_students` → table with names, grades, missing count.
3. **Admin asks**: "Audit log for grade access" → `list_audit_logs` → JSON lines with hashed subjects.

## Tone?
`polished` — serious, elegant, restrained. This is infra for institutions; it earns trust by being boring in the right ways.

## One-line share caption
**bb-mcp: the MCP server Blackboard's own team uses. 40 tools, 5 personas, zero PII leaks.**

---

## Storyboard (target: ~20s)

| Scene | Duration | Visual | Audio |
|-------|----------|--------|-------|
| 1. Hook | 2.5s | Blackboard logo → morphs into bb-mcp hexagon → "bb-mcp" lockup | Low synth pad, single pluck |
| 2. Reveal | 3s | Architecture diagram animates: client → bb-mcp → Blackboard → return (PII scrub, metrics, audit) | Pad swells, subtle whoosh on flow |
| 3. Highlight: Student | 3.5s | Terminal: `get_upcoming_assignments` → typed → JSON result cards slide in | Click, soft chord |
| 4. Highlight: Instructor | 3.5s | Terminal: `get_at_risk_students` → typed → table builds row by row | Click, chord |
| 5. Highlight: Security | 3s | Icons appear: 🔐 API key gate → ⏱ rate limit → 🛡 FERPA gate → 🧹 PII scrub → 📝 audit log | Five soft ticks, one per icon |
| 6. Highlight: Docker/Dev | 2.5s | `make docker-up` → container spins → `npm run inspect` → "0 errors" badge | Terminal typing, success chime |
| 7. Punchline/Outro | 2.5s | "bb-mcp" lockup + GitHub URL + "npm i -g bb-mcp" (or docker) | Pad resolves, final pluck |

**Total: ~21s** — sweet spot.

---

## Visual Identity (from repo)
- **Colors**: Dark charcoal `#1a1a2e` bg, electric cyan `#00d4ff` accent, warm white `#f5f5f5` text, muted slate `#6b7280` secondary
- **Font**: System UI stack (Inter on web, SF Mono / JetBrains Mono in terminal)
- **Logo**: Minimal hexagon with "bb" negative space (derive from repo's ASCII art vibe)
- **Terminal**: Dark theme, cyan prompt, green success, amber warning

---

## Build Notes
- Use browser-based render (Puppeteer/Playwright) — draw each frame as pure function of time
- Reuse real terminal output from `npm run inspect`, `make docker-doctor`, actual tool JSON
- Wait for fonts/images before capture
- Check mid-transition frames for overflow/collision
- Poster frame = Scene 2 settled (architecture diagram fully resolved)
- Output: `brag-output/brag.mp4`, `brag.jpg`, `share-copy.txt`