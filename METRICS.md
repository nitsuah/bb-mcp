# Metrics

This document tracks the key performance indicators (KPIs), code quality standards, and health metrics for the `bb-mcp` project.

## Project Health & Quality Metrics

| Metric | Current | Target | Status |
| :--- | :--- | :--- | :--- |
| **Unit Test Coverage** | 0% | > 85% | 🔴 Pending |
| **Total Test Cases** | 0 | > 50 | 🔴 Pending |
| **CI/CD Pipeline Success Rate** | TBD | 100% | 🟡 Initializing |
| **Critical/High Vulnerabilities** | 0 | 0 | 🟢 Pass |
| **TypeScript Strict Mode Compliance** | 100% | 100% | 🟢 Pass |
| **Average Cyclomatic Complexity** | TBD | < 10 | 🟡 Monitoring |
| **Documentation Coverage (TSDoc)** | TBD | > 90% | 🔴 Pending |
| **Cold Build Duration (Clean)** | TBD | < 30s | 🟡 Monitoring |
| **Production Bundle Size (dist)** | TBD | < 5MB | 🟡 Monitoring |
| **Linting Errors/Warnings** | 0 | 0 | 🟢 Pass |

## How to Update

To refresh these metrics locally, use the following commands:

### Testing & Coverage
Requires a testing framework like Jest or Vitest.
```bash
# Generate coverage report
npm test -- --coverage
```

### Security Audits
Scans dependencies for known vulnerabilities.
```bash
# Check for vulnerabilities
npm audit
```

### Code Quality & Complexity
Uses ESLint and specialized tools to analyze code structure.
```bash
# Run linter
npm run lint

# Calculate Lines of Code (requires 'cloc' installed)
cloc src/
```

### Build Performance
Measures the time taken to compile TypeScript to JavaScript.
```bash
# Measure build time
time npm run build
```

### Bundle Analysis
Check the size of the compiled output in the `dist` or `build` folder.
```bash
# Check size of distribution files
du -sh ./dist
```

## Review Cycle
These metrics are reviewed during every Pull Request and updated in this document on a monthly basis to track project maturity.