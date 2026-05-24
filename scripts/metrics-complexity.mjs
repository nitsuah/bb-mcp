import ts from "typescript";

const MAX_ALLOWED_AVERAGE = Number(process.env.MAX_COMPLEXITY_AVG ?? "10");
const EXCLUDE_SUFFIXES = [
  "src/index.ts",
  "src/types.ts",
  "src/constants.ts",
];

function toPosixPath(value) {
  return value.replaceAll("\\", "/");
}

function isInScope(filePath) {
  const normalized = toPosixPath(filePath);
  if (!normalized.includes("/src/")) {
    return false;
  }
  if (normalized.includes("/src/tools/")) {
    return false;
  }
  return !EXCLUDE_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function functionName(node, sourceFile) {
  if (ts.isFunctionDeclaration(node) && node.name) {
    return node.name.text;
  }
  if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
    return node.name.text;
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    const parent = node.parent;
    if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }
    if (parent && ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }
    if (parent && ts.isCallExpression(parent)) {
      return "<callback>";
    }
    return "<anonymous>";
  }
  return "<anonymous>";
}

function computeComplexity(node) {
  let complexity = 1;

  function visit(current) {
    if (current !== node) {
      if (
        ts.isFunctionDeclaration(current) ||
        ts.isMethodDeclaration(current) ||
        ts.isArrowFunction(current) ||
        ts.isFunctionExpression(current)
      ) {
        return;
      }
    }

    if (
      ts.isIfStatement(current) ||
      ts.isForStatement(current) ||
      ts.isForInStatement(current) ||
      ts.isForOfStatement(current) ||
      ts.isWhileStatement(current) ||
      ts.isDoStatement(current) ||
      ts.isConditionalExpression(current) ||
      ts.isCatchClause(current)
    ) {
      complexity += 1;
    }

    if (ts.isCaseClause(current)) {
      complexity += 1;
    }

    if (ts.isBinaryExpression(current)) {
      const operator = current.operatorToken.kind;
      if (
        operator === ts.SyntaxKind.AmpersandAmpersandToken ||
        operator === ts.SyntaxKind.BarBarToken ||
        operator === ts.SyntaxKind.QuestionQuestionToken
      ) {
        complexity += 1;
      }
    }

    ts.forEachChild(current, visit);
  }

  ts.forEachChild(node, visit);
  return complexity;
}

function main() {
  const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, "tsconfig.json");
  if (!configPath) {
    throw new Error("Could not find tsconfig.json");
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    process.cwd(),
  );

  const program = ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: parsedConfig.options,
  });

  const measurements = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile || !isInScope(sourceFile.fileName)) {
      continue;
    }

    const filePath = toPosixPath(sourceFile.fileName);

    function walk(node) {
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node)
      ) {
        measurements.push({
          file: filePath,
          name: functionName(node, sourceFile),
          complexity: computeComplexity(node),
        });
      }

      ts.forEachChild(node, walk);
    }

    walk(sourceFile);
  }

  if (measurements.length === 0) {
    console.log("No functions found in complexity scope.");
    process.exit(1);
  }

  const total = measurements.reduce((sum, item) => sum + item.complexity, 0);
  const average = total / measurements.length;
  const maxEntry = measurements.reduce((max, item) =>
    item.complexity > max.complexity ? item : max,
  );

  console.log(`Complexity scope functions: ${measurements.length}`);
  console.log(`Average cyclomatic complexity: ${average.toFixed(2)}`);
  console.log(
    `Max complexity: ${maxEntry.complexity} (${maxEntry.name} in ${maxEntry.file})`,
  );

  if (average >= MAX_ALLOWED_AVERAGE) {
    console.error(
      `Average complexity ${average.toFixed(2)} exceeds allowed threshold ${MAX_ALLOWED_AVERAGE}.`,
    );
    process.exit(1);
  }
}

main();
