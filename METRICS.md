# Metrics

This document tracks the key performance indicators (KPIs), code quality standards, and health metrics for the `bb-mcp` project.

## Project Health & Quality Metrics

| Metric | Current | Status |
| :--- | :--- | :--- |
| **Unit Test Coverage** | 91.86% lines | 🟢 Pass |
| **Total Test Cases** | 79 | 🟢 Pass |
| **Critical/High Vulnerabilities** | 0 | 🟢 Pass |
| **Average Cyclomatic Complexity** | 2.63 (70 functions, core scope) | 🟢 Pass |
| **Documentation Coverage (TSDoc)** | 100% module coverage (core scope) | 🟢 Pass |
| **Cold Build Duration (Clean)** | 7.08s (Docker builder, no cache) | 🟢 Pass |
| **Production Bundle Size (dist)** | 424K (Docker test image) | 🟢 Pass |
| **Linting Errors/Warnings** | 0 | 🟢 Pass |

### Target Thresholds

- Unit Test Coverage: `> 85%`
- Total Test Cases: `> 50`
- Critical/High Vulnerabilities: `0`
- Average Cyclomatic Complexity: `< 10`
- Documentation Coverage (TSDoc): `> 90%`
- Cold Build Duration (Clean): `< 30s`
- Production Bundle Size (dist): `< 5MB`
- Linting Errors/Warnings: `0`

Coverage scope note: Unit coverage excludes `src/index.ts`, `src/types.ts`, and `src/constants.ts` in `vitest.config.ts`.

Coverage detail: `src/tools` coverage is now 98.57% lines / 72.16% branches (`student.ts` 96.62% lines / 78.75% branches, `instructor.ts` 100% lines / 66.03% branches, `shared.ts` 100% lines / 87.5% branches).

Complexity/TSDoc scope note: metrics scripts in `scripts/metrics-complexity.mjs` and `scripts/metrics-doc-coverage.mjs` use the same core scope as unit coverage.

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