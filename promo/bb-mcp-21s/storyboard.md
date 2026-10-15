# bb-mcp 21s Spot Storyboard

## Scene Breakdown (target: 21s)

| Scene | Duration | Visual | Audio |
|-------|----------|--------|-------|
| 1. Hook | 2.5s | Blackboard logo → morphs into bb-mcp hexagon → "bb-mcp" lockup | Low synth pad, single pluck |
| 2. Reveal | 3s | Architecture diagram animates: client → bb-mcp → Blackboard → return (PII scrub, metrics, audit) | Pad swells, subtle whoosh on flow |
| 3. Student | 3s | Terminal: `get_upcoming_assignments` → typed → JSON result cards slide in | Click, soft chord |
| 4. Instructor | 3s | Terminal: `get_at_risk_students` → typed → table builds row by row | Click, chord |
| 5. Infographic | 4s | 5 persona cards cascade in: Student(9) Instructor(8) Grade(6) Admin(12) Parent(5) = 40 tools | Rising arpeggio, each card chimes |
| 6. Security | 3s | Icons appear: 🔐 API key gate → ⏱ rate limit → 🛡 FERPA gate → 🧹 PII scrub → 📝 audit log | Five soft ticks, one per icon |
| 7. Docker/Dev | 2s | `make docker-up` → container spins → `npm run inspect` → "0 errors" badge | Terminal typing, success chime |
| 8. Outro | 0.5s | "bb-mcp" lockup + GitHub URL + "npm i -g bb-mcp" | Pad resolves, final pluck |

**Total: 21s**

## Visual Identity
- **Colors**: Dark charcoal `#1a1a2e` bg, electric cyan `#00d4ff` accent, warm white `#f5f5f5` text, muted slate `#6b7280` secondary
- **Font**: System UI stack (Inter on web, JetBrains Mono in terminal)
- **Logo**: Minimal hexagon with "bb" negative space
- **Terminal**: Dark theme, cyan prompt, green success, amber warning