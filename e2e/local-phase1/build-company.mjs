import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const dir = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(dir, '../..');
const deps = path.join(root, 'node_modules');
const out = process.argv[2];
if (!out || !path.isAbsolute(out) || out === root || out.startsWith(root + path.sep)) throw Error('Provide a fresh absolute output directory outside the application.');
fs.mkdirSync(out);
const sourceHashes = new Map();
const ts = createRequire(import.meta.url)(`${deps}/typescript/lib/typescript.js`);
const pending = new Map();
function read(file) {
  const flag = execFileSync('/usr/bin/stat', ['-f', '%Sf', file], { encoding: 'utf8', timeout: 2000 });
  if (flag.includes('dataless')) {
    pending.set(file, fs.statSync(file).size);
    throw new Error(`Dependency unavailable: ${file}`);
  }
  const source = fs.readFileSync(file, 'utf8');
  sourceHashes.set(file, createHash('sha256').update(source).digest('hex'));
  return source;
}
const modules = new Map();
const cssFile = path.resolve(root, 'src/components/first-session.module.css');
const css = read(cssFile);
const classes = Object.fromEntries([...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map(m => [m[1], `session_${m[1]}`]));
const styles = css.replace(/\.([A-Za-z][\w-]*)/g, (match, key) => `.${classes[key]}`);
const virtual = {
  'next/link': `const React=require('react');module.exports=React.forwardRef(function Link({href,children,...props},ref){return React.createElement('a',{...props,href,ref},children)});`,
  'next/navigation': `exports.useRouter=()=>window.__phase1Local.router;`,
  '@/lib/theme-context': `exports.useTheme=()=>({theme:'system-c'});`,
  'setup-action': `exports.saveSetupStepAction=()=>{throw Error('Real server action is excluded from verification')};`,
  'styles': `module.exports=${JSON.stringify(classes)};`,
};
const packages = {
  react: 'react/index.js',
  'react/jsx-runtime': 'react/jsx-runtime.js',
  'react-dom': 'react-dom/index.js',
  'react-dom/client': 'react-dom/client.js',
  scheduler: 'scheduler/index.js',
  'lucide-react': 'lucide-react/dist/cjs/lucide-react.js',
};
function resolve(specifier, parent) {
  if (virtual[specifier]) return `virtual:${specifier}`;
  if (specifier === './actions' && parent.endsWith('/onboarding-client.tsx')) return 'virtual:setup-action';
  if (specifier.endsWith('.module.css')) return 'virtual:styles';
  if (packages[specifier]) return `${deps}/${packages[specifier]}`;
  const base = specifier.startsWith('@/') ? path.resolve(root, 'src', specifier.slice(2)) : path.resolve(path.dirname(parent), specifier);
  if (!specifier.startsWith('@/') && !specifier.startsWith('.')) throw Error(`Unexpected browser dependency: ${specifier}`);
  for (const suffix of ['', '.ts', '.tsx', '.js', '/index.ts', '/index.js']) {
    if (fs.existsSync(base + suffix) && fs.statSync(base + suffix).isFile()) return base + suffix;
  }
  throw Error(`Cannot resolve ${specifier} from ${parent}`);
}
function compile(id) {
  if (modules.has(id)) return;
  modules.set(id, null);
  let source;
  try { source = id.startsWith('virtual:') ? virtual[id.slice(8)] : read(id); }
  catch (error) { if (pending.size) return; throw error; }
  const result = ts.transpileModule(source, {
    fileName: id,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  if (result.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error)) throw Error(ts.formatDiagnosticsWithColorAndContext(result.diagnostics, {getCanonicalFileName:p=>p,getCurrentDirectory:()=>dir,getNewLine:()=> '\n'}));
  const dependencies = {};
  const ast = ts.createSourceFile(id, result.outputText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require' && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      const specifier = node.arguments[0].text;
      dependencies[specifier] = resolve(specifier, id);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  modules.set(id, { code: result.outputText, dependencies });
  for (const child of Object.values(dependencies)) compile(child);
}
const entry = `${dir}/company-entry.tsx`;
compile(entry);
fs.writeFileSync(`${out}/pending-browser.json`, JSON.stringify([...pending].map(([file, bytes]) => ({file,bytes})), null, 2));
if (pending.size) {
  console.log(JSON.stringify({result:'DEPENDENCIES_PENDING',files:pending.size,bytes:[...pending.values()].reduce((a,b)=>a+b,0)}));
  process.exitCode = 2;
} else {
  const body = [...modules].map(([id, value]) => `${JSON.stringify(id)}:[function(require,module,exports){\n${value.code}\n},${JSON.stringify(value.dependencies)}]`).join(',\n');
  fs.writeFileSync(`${out}/components.js`, `const process={env:{NODE_ENV:'development'}};const __modules={${body}};const __cache={};function __load(id){if(__cache[id])return __cache[id].exports;const [fn,map]=__modules[id];const module={exports:{}};__cache[id]=module;fn(spec=>__load(map[spec]),module,module.exports);return module.exports;}__load(${JSON.stringify(entry)});`);
  fs.writeFileSync(`${out}/components.css`, styles);
  fs.writeFileSync(`${out}/source-manifest.json`, JSON.stringify({sourceHashes:Object.fromEntries(sourceHashes),modules:modules.size,scope:'Actual company setup/readiness components;save/Next routing/theme stand-ins;no server/Auth/PostgREST/email/hosted journey'},null,2));
  console.log(JSON.stringify({result:'PASS',modules:modules.size,bundleBytes:fs.statSync(`${out}/components.js`).size,compiler:ts.version,runtime:'Actual React/ReactDOM company setup/readiness;save/Next routing/theme stand-ins'}));
}
