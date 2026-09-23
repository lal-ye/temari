import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/reader-core');
const allowed = new Set(['react', 'react-markdown', 'remark-gfm', 'remark-math', 'rehype-raw', 'rehype-sanitize', 'rehype-katex']);
const forbidden = new Set(['localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'XMLHttpRequest', 'WebSocket', 'Worker', 'eval']);
const files = fs.readdirSync(root, { recursive: true }).filter(name => /\.(ts|tsx)$/.test(name) && !name.includes('.test.'));
for (const name of files) {
  const file = path.join(root, name);
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function checkImport(specifier) {
    if (specifier.startsWith('.')) {
      if (!path.resolve(path.dirname(file), specifier).startsWith(root + path.sep)) {
        throw new Error(`${name}: reader imports outside its source boundary: ${specifier}`);
      }
    } else if (!allowed.has(specifier)) {
      throw new Error(`${name}: dependency not reviewed for DOM reader: ${specifier}`);
    }
  }
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      checkImport(node.moduleSpecifier.text);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) checkImport(node.argument.literal.text);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === 'require')) {
      if (node.arguments.length !== 1 || !ts.isStringLiteral(node.arguments[0])) throw new Error(`${name}: dynamic module expression not allowed`);
      checkImport(node.arguments[0].text);
    }
    if ((ts.isIdentifier(node) || ts.isStringLiteral(node)) && forbidden.has(node.text)) {
      throw new Error(`${name}: forbidden reader API ${node.text}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
console.log(`Reader boundary: ${files.length} source modules checked; no app/native/store/network imports or APIs.`);
