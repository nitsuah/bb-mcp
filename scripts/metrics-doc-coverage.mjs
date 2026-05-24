import ts from "typescript";

const MIN_DOC_COVERAGE = Number(process.env.MIN_TSDOC_COVERAGE ?? "90");
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

function hasJsDoc(node) {
  const jsDocs = ts.getJSDocCommentsAndTags(node);
  return jsDocs.length > 0;
}

function hasModuleTsDoc(sourceText) {
  return /^\s*\/\*\*/.test(sourceText);
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

  const modules = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile || !isInScope(sourceFile.fileName)) {
      continue;
    }

    const filePath = toPosixPath(sourceFile.fileName);

    const sourceText = sourceFile.getFullText();
    const hasAnyExport = sourceFile.statements.some((statement) => {
      const modifiers = ts.canHaveModifiers(statement)
        ? ts.getModifiers(statement) ?? []
        : [];
      return modifiers.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword);
    });

    if (!hasAnyExport) {
      continue;
    }

    modules.push({
      file: filePath,
      documented: hasModuleTsDoc(sourceText),
    });
  }

  if (modules.length === 0) {
    console.log("No exported modules found in TSDoc scope.");
    process.exit(1);
  }

  const documentedCount = modules.filter((item) => item.documented).length;
  const coverage = (documentedCount / modules.length) * 100;

  console.log(`TSDoc scope modules: ${modules.length}`);
  console.log(`Documented modules: ${documentedCount}`);
  console.log(`Documentation coverage: ${coverage.toFixed(2)}%`);

  if (coverage < MIN_DOC_COVERAGE) {
    const undocumented = modules
      .filter((item) => !item.documented)
      .slice(0, 25)
      .map((item) => item.file);

    console.error(
      `Documentation coverage ${coverage.toFixed(2)}% is below required ${MIN_DOC_COVERAGE}%.`,
    );
    if (undocumented.length > 0) {
      console.error("Undocumented modules:");
      for (const entry of undocumented) {
        console.error(`- ${entry}`);
      }
    }
    process.exit(1);
  }
}

main();
