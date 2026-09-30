import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const repoRoot = process.cwd();
const coreRoot = path.resolve(repoRoot, 'packages/core');
const manifestPath = path.join(coreRoot, 'package.json');
const configPath = path.join(coreRoot, 'tsconfig.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const dependencyNames = [
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.devDependencies ?? {}),
  ...Object.keys(manifest.peerDependencies ?? {}),
];
const forbiddenDependency = dependencyNames.find((name) =>
  /^(react|react-dom|react-native|expo)(-|$)/.test(name) || name === 'react' || name === 'react-dom'
);

if (forbiddenDependency) {
  console.error(`Core boundary violation: ${forbiddenDependency} is a UI/native dependency.`);
  process.exitCode = 1;
}

const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) {
  console.error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  process.exitCode = 1;
} else {
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length > 0) {
    console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => repoRoot,
      getNewLine: () => '\n',
    }));
    process.exitCode = 1;
  }

  const foreignSource = program.getSourceFiles().find((sourceFile) => {
    if (sourceFile.isDeclarationFile) return false;
    const fileName = path.resolve(sourceFile.fileName);
    return !fileName.startsWith(`${coreRoot}${path.sep}`) && !fileName.includes(`${path.sep}node_modules${path.sep}`);
  });

  if (foreignSource) {
    console.error(`Core boundary violation: ${foreignSource.fileName} is outside packages/core.`);
    process.exitCode = 1;
  }

  // AST walk (same shape as check-reader-boundary.mjs): comments and string
  // literals never visit as identifiers, so prose like "that id in
  // localStorage" cannot trip the guard — only real references flag.
  // Property *names* are skipped (a.process is data, not the global); the
  // value side (process.env) still flags. fetch/URL/AbortSignal stay allowed:
  // universal across Node, browsers and Hermes (http.ts calls global fetch).
  const sourceFiles = program.getSourceFiles().filter((sourceFile) => {
    if (sourceFile.isDeclarationFile) return false;
    const fileName = path.resolve(sourceFile.fileName);
    return fileName.startsWith(`${coreRoot}${path.sep}`) && !fileName.includes(`${path.sep}node_modules${path.sep}`);
  });
  const bannedGlobals = new Set([
    'process', 'Buffer', 'window', 'document', 'navigator',
    'localStorage', 'sessionStorage', 'indexedDB',
    'XMLHttpRequest', 'WebSocket', 'Worker',
  ]);
  for (const sourceFile of sourceFiles) {
    const name = path.relative(repoRoot, sourceFile.fileName);
    let failed = false;
    const fail = (what) => {
      console.error(`Core boundary violation: ${name}: ${what}.`);
      process.exitCode = 1;
      failed = true;
    };
    const visit = (node) => {
      if (failed) return;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        const spec = node.moduleSpecifier.text;
        if (spec.startsWith('node:') || spec === 'buffer' || spec === 'process') {
          fail(`Node import ${spec}`);
          return;
        }
      }
      if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
        const callee = node.expression;
        const isRequire = ts.isIdentifier(callee) && callee.text === 'require';
        const isImport = callee.kind === ts.SyntaxKind.ImportKeyword;
        if ((isRequire || isImport) && node.arguments[0].text.startsWith('node:')) {
          fail(`Node import ${node.arguments[0].text}`);
          return;
        }
      }
      if (ts.isIdentifier(node) && bannedGlobals.has(node.text)) {
        const parent = node.parent;
        const isPropertyName =
          (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
          (ts.isPropertyAssignment(parent) && parent.name === node) ||
          (ts.isPropertySignature(parent) && parent.name === node);
        if (!isPropertyName) {
          fail(`banned global ${node.text}`);
          return;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    if (process.exitCode) break;
  }
}

if (!process.exitCode) {
  console.log('Core boundary clean: no UI/native dependencies, DOM diagnostics, or imports outside packages/core; no node:*/process/Buffer/DOM globals.');
}
