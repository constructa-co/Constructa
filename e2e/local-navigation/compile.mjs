import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

// A004 Real Navigation Interaction — offline transpiler for the local
// navigation fixture. Reuses the existing small transpilation approach from
// e2e/local-phase1 (typescript.transpileModule + explicit require map); no
// bundler/framework/runner hardening, no network, no installs.
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

// Only the Next transport is simulated. SidebarNav, ProjectNavBar,
// PhoneMenuFocus, requestProjectNavigation, phone-nav and job-workflow are
// the application modules, not recreated fixture UI.
const virtual = {
  // Plain-anchor stand-in for next/link with Next-style client click
  // interception: a plain left click commits the fixture route through
  // window.__navigationLocal.follow; modified clicks keep default behaviour.
  'next/link': `const React=require('react');module.exports=React.forwardRef(function Link({href,children,onClick,target,...props},ref){return React.createElement('a',{...props,href,target,ref,onClick:(event)=>{onClick?.(event);if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||target==='_blank')return;event.preventDefault();window.__navigationLocal.follow(String(href));}},children)});`,
  // Mocked Next router/path/query over the explicit fixture. The URLSearchParams
  // object is cached per query string so hook identity stays stable between
  // renders (useSearchParams is an effect dependency in SidebarNav).
  'next/navigation': `const cache=new Map();function params(query){if(!cache.has(query))cache.set(query,new URLSearchParams(query));return cache.get(query);}exports.useRouter=()=>window.__navigationLocal.router;exports.usePathname=()=>window.__navigationLocal.pathname;exports.useSearchParams=()=>params(window.__navigationLocal.query);`,
  // Mocked theme (no /api/theme fetch in the offline fixture).
  '@/lib/theme-context': `exports.useTheme=()=>({theme:window.__navigationLocal.theme,setTheme:(next)=>{window.__navigationLocal.theme=next;window.__navigationLocal.rerender();}});`,
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
  if (packages[specifier]) return `${deps}/${packages[specifier]}`;
  if (!specifier.startsWith('@/') && !specifier.startsWith('.')) throw Error(`Unexpected browser dependency: ${specifier}`);
  const base = specifier.startsWith('@/') ? path.resolve(root, 'src', specifier.slice(2)) : path.resolve(path.dirname(parent), specifier);
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
const entry = `${dir}/entry.tsx`;
compile(entry);
fs.writeFileSync(`${out}/pending-browser.json`, JSON.stringify([...pending].map(([file, bytes]) => ({file,bytes})), null, 2));
if (pending.size) {
  console.log(JSON.stringify({result:'DEPENDENCIES_PENDING',files:pending.size,bytes:[...pending.values()].reduce((a,b)=>a+b,0)}));
  process.exitCode = 2;
} else {
  const body = [...modules].map(([id, value]) => `${JSON.stringify(id)}:[function(require,module,exports){\n${value.code}\n},${JSON.stringify(value.dependencies)}]`).join(',\n');
  fs.writeFileSync(`${out}/components.js`, `const process={env:{NODE_ENV:'development'}};const __modules={${body}};const __cache={};function __load(id){if(__cache[id])return __cache[id].exports;const [fn,map]=__modules[id];const module={exports:{}};__cache[id]=module;fn(spec=>__load(map[spec]),module,module.exports);return module.exports;}__load(${JSON.stringify(entry)});`);
  fs.writeFileSync(`${out}/components.css`, '');
  const scope = 'Actual SidebarNav/ProjectNavBar/PhoneMenuFocus/requestProjectNavigation/phone-nav/job-workflow;mocked Next link/router/path/query and theme;explicit memory localStorage;synthetic jobs and synthetic dirty editor;no Auth/DB/backend/provider/hosted journey';
  fs.writeFileSync(`${out}/source-manifest.json`, JSON.stringify({sourceHashes:Object.fromEntries(sourceHashes),modules:modules.size,scope},null,2));
  console.log(JSON.stringify({result:'PASS',modules:modules.size,bundleBytes:fs.statSync(`${out}/components.js`).size,compiler:ts.version,runtime:scope}));
}
