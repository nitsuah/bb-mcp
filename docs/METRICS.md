# Metrics

This document tracks the key performance indicators (KPIs), code quality standards, and health metrics for the `bb-mcp` project.

## Project Health & Quality Metrics

_Last refreshed: 2026-09-04, via `docker build --target test` + the commands below on this branch (`v2026/roadmap-and-docs-2026-09`)._

| Metric | Value | Status |
| :--- | :--- | :--- |
| Code Coverage | 93.70% stmts / 93.67% lines | 🟢 Pass |
| Total Test Cases | 151 | 🟢 Pass |
| Critical/High Vulnerabilities | 1 high, 1 moderate | 🟡 Tracked |
| Average Cyclomatic Complexity | 2.49 (92 functions, core scope) | 🟢 Pass |
| Cold Build Duration (Clean) | 75s (Docker builder, no cache, Windows/Docker Desktop) | 🟡 See note |
| Production Bundle Size (dist) | 672K (Docker test image) | 🟢 Pass |
| Linting Errors/Warnings | 0 | 🟢 Pass |

### Target Thresholds

- Unit Test Coverage: `> 85%`
- Total Test Cases: `> 50`
- Critical/High Vulnerabilities: `0`
- Average Cyclomatic Complexity: `< 10`
- Documentation Coverage (TSDoc): `> 90%`
- Cold Build Duration (Clean): `< 30s`
- Production Bundle Size (dist): `< 5MB`
- Linting Errors/Warnings: `0`

### Notes on the current numbers

- **Vulnerabilities (1 high, 1 moderate)**: both are transitive — `fast-uri` (high, via `@modelcontextprotocol/sdk` → `ajv`) and `qs` (moderate, via `@modelcontextprotocol/sdk` → `express`). `npm audit fix` (non-forced) has no resolvable fix; forcing would mean bumping `@modelcontextprotocol/sdk` to a version outside its current allowed range, which is out of scope for a docs/roadmap pass and risks breaking the MCP transport integration. Tracked for a dedicated dependency-bump pass; `.github/dependabot.yml`'s npm group already watches for a compatible upstream fix. This replaces a previously reported `0`, which was accurate at the time but is stale — always re-run `npm audit` rather than trusting the last recorded value.
- **Cold build duration (75s, exceeds the <30s target)**: measured on Windows + Docker Desktop, which adds virtualization and filesystem-translation overhead `npm ci`/layer export don't see on native Linux CI runners. The previous 7.08s figure was almost certainly measured pre-PR#109, before the admin/parent/grade-writeback/webhook tool set (and `output-scrub.ts`, this pass) roughly doubled `src/`. Worth re-baselining from CI (`.github/workflows/ci.yml`) rather than a local Windows Docker Desktop run for an apples-to-apples number.
- **Linting**: this repo previously had no `.gitattributes`, so a Windows checkout with `core.autocrlf=true` (a common default) produces CRLF working-tree files; `docker build`'s `COPY` reads those raw bytes and `eslint`'s `prettier/prettier` rule reported ~6700 "delete CR" errors that were pure checkout-environment noise, not code issues. Added `.gitattributes` (`eol=lf`) this pass, which fixes it for every future checkout (verified via a fresh scratch clone). The `0` above is the genuine post-fix result, not the raw pre-fix number.

Coverage scope note: Unit coverage excludes `src/index.ts`, `src/types.ts`, and `src/constants.ts` in `vitest.config.ts`.

Coverage detail: `src/tools` coverage is 98.86% lines / 78.11% branches (`admin.ts` 100%/87.3%, `grade-writeback.ts` 100%/75%, `instructor.ts` 100%/67.92%, `parent.ts` 97.14%/84%, `shared.ts` 100%/87.5%, `student.ts` 96.62%/78.75%, `webhook-tools.ts` 100%/92.85%). `src/output-scrub.ts` is 100% lines / 92% branches.

Complexity/TSDoc scope note: metrics scripts in `scripts/metrics-complexity.mjs` and `scripts/metrics-doc-coverage.mjs` use the same core scope as unit coverage. TSDoc module coverage: 11/11 modules documented (100%).

## How to Update

To refresh these metrics locally, use the following commands:

### Testing & Coverage
```bash
# Build a deterministic test image
docker build --target test -t bb-mcp:test .

# Run tests with coverage
docker run --rm bb-mcp:test npm run test:coverage
```

### Security Audits
Scans dependencies for known vulnerabilities.
```bash
# Check for vulnerabilities
docker run --rm bb-mcp:test npm audit --audit-level=high
```

### Code Quality & Complexity
Uses ESLint and specialized tools to analyze code structure.
```bash
# Run linter
docker run --rm bb-mcp:test npm run lint

# Compute average cyclomatic complexity
docker run --rm bb-mcp:test npm run metrics:complexity

# Compute TSDoc module coverage
docker run --rm bb-mcp:test npm run metrics:docs

# Calculate Lines of Code (requires 'cloc' installed)
docker run --rm -v "${PWD}:/workspace" -w /workspace node:22-slim sh -lc "apt-get update >/dev/null && apt-get install -y cloc >/dev/null && cloc src/"
```

### Build Performance
Measures the time taken to compile TypeScript to JavaScript.
```bash
# Measure clean build time in PowerShell
$duration = Measure-Command { docker build --no-cache --target builder -t bb-mcp:builder . | Out-Null }
$duration.TotalSeconds
```

### Bundle Analysis
Check the size of the compiled output in the `dist` or `build` folder.
```bash
# Check size of distribution files
docker run --rm bb-mcp:test sh -lc "du -sh dist"
```

## Review Cycle
These metrics are reviewed during every Pull Request and updated in this document on a monthly basis to track project maturity.