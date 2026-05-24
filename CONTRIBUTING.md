# Contributing to bb-mcp

Thank you for your interest in contributing! We welcome contributions from everyone.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Releases](#releases)
- [Recognition](#recognition)
- [License](#license)
- [Questions?](#questions)

## 🤝 Code of Conduct

This project adheres to a Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to TODO: maintainer@email.com.

## 🚀 Getting Started

1.  **Fork the repository** on GitHub
2.  **Clone your fork** locally:
    ```bash
    git clone https://github.com/YOUR_USERNAME/bb-mcp.git
    cd bb-mcp
    ```
3.  **Add the upstream repository**:
    ```bash
    git remote add upstream https://github.com/nitsuah/bb-mcp.git
    ```
4.  **Create a new branch** for your changes:
    ```bash
    git checkout -b feature/your-feature-name
    ```

## 💡 How to Contribute

### Types of Contributions

-   **Bug fixes**: Fix issues or problems in the codebase
-   **New features**: Add new functionality or capabilities
-   **Documentation**: Improve or add to project documentation
-   **Tests**: Add or improve test coverage
-   **Performance**: Optimize existing code
-   **Refactoring**: Improve code quality without changing functionality

### Before You Start

-   Check existing [issues](../../issues) and [pull requests](../../pulls) to avoid duplicate work.
-   For major changes, please open an issue first to discuss what you would like to change.
-   Make sure your code follows the project's coding standards.

## 🛠️ Development Setup

### Prerequisites

-   Node.js (LTS recommended)
-   npm or Yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Run development server
npm run dev
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Code Formatting

```bash
# Format code
npm run format

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## 🔄 Pull Request Process

1.  **Update your branch** with the latest upstream changes:

    ```bash
    git fetch upstream
    git rebase upstream/main
    ```

2.  **Make your changes** following the coding standards.

3.  **Test your changes** thoroughly:
    *   Run all existing tests.
    *   Add new tests for new features.
    *   Ensure all tests pass.
    *   Check code coverage.

4.  **Commit your changes** with clear, descriptive messages:

    ```bash
    git commit -m "feat: add new feature description"
    ```

    Follow [Conventional Commits](https://www.conventionalcommits.org/):
    *   `feat:` for new features
    *   `fix:` for bug fixes
    *   `docs:` for documentation changes
    *   `test:` for adding or updating tests
    *   `refactor:` for code refactoring
    *   `chore:` for maintenance tasks

5.  **Push to your fork**:

    ```bash
    git push origin feature/your-feature-name
    ```

6.  **Open a Pull Request** on GitHub:
    *   Provide a clear title and description.
    *   Reference any related issues.
    *   Include screenshots/videos for UI changes if applicable.
    *   Ensure CI checks pass.

7.  **Respond to feedback** from maintainers and update as needed.

## 📝 Coding Standards

### General Guidelines

-   Write clean, readable, and maintainable code.
-   Follow the existing code style and conventions.
-   Add comments for complex logic.
-   Keep functions small and focused.
-   Use meaningful variable and function names.