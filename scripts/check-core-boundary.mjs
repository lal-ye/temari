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
}

if (!process.exitCode) {
  console.log('Core boundary clean: no UI/native dependencies, DOM diagnostics, or imports outside packages/core.');
}
