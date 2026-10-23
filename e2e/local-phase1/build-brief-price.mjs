import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const dir = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(dir, '../..');
const deps = path.join(root, 'node_modules');
const out = process.argv[2];
const scenario = process.argv[3] ?? 'brief-price';
if (!['brief-price', 'first-job', 'programme-pdf', 'proposal-view'].includes(scenario)) throw Error('Unknown offline scenario.');
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
const styleSheets = [];
function stylesheet(file) {
  const source=read(file),prefix='fixture'+styleSheets.length+'_';
  const classes=Object.fromEntries([...source.matchAll(/\.([A-Za-z][\w-]*)/g)].map(m=>[m[1],prefix+m[1]]));
  const id='css:'+file;
  if (!virtual[id]) { styleSheets.push(source.replace(/\.([A-Za-z][\w-]*)/g,(_,key)=>'.'+classes[key])); virtual[id]='module.exports='+JSON.stringify(classes)+';'; }
  return 'virtual:'+id;
}
const virtual = {
  'next/link': `const React=require('react');module.exports=React.forwardRef(function Link({href,children,...props},ref){return React.createElement('a',{...props,href,ref},children)});`,
  'next/navigation': `exports.useRouter=()=>window.${scenario === 'first-job' ? '__firstJobLocal' : scenario === 'programme-pdf' ? '__programmePdfLocal' : scenario === 'proposal-view' ? '__documentViewLocal' : '__briefPriceLocal'}.router;`,
  'next/dynamic': `module.exports=()=>function ExcludedLazyFeature(){throw Error('Advanced/video are outside this fixture')};`,
  'excluded-lazy': `module.exports={};`,
  'excluded-action': `module.exports=new Proxy({},{get:()=>()=>{throw Error('Real server action excluded from local fixture')}});`,
  '@/lib/theme-context': scenario === 'proposal-view' ? `exports.useTheme=()=>({theme:window.__documentViewOptions?.theme??'system-c'});` : `exports.useTheme=()=>({theme:'system-c'});`,
  'setup-action': `exports.saveSetupStepAction=()=>{throw Error('Real server action is excluded from verification')};`,
  ...(['programme-pdf', 'proposal-view'].includes(scenario) ? { jspdf: `module.exports=window.jspdf.jsPDF;` } : {}),

};
const packages = {
  react: 'react/index.js',
  'react/jsx-runtime': 'react/jsx-runtime.js',
  'react-dom': 'react-dom/index.js',
  'react-dom/client': 'react-dom/client.js',
  scheduler: 'scheduler/index.js',
  'lucide-react': 'lucide-react/dist/cjs/lucide-react.js',
  zod: 'zod/index.cjs',
};
function resolve(specifier, parent) {
  if (virtual[specifier]) return `virtual:${specifier}`;
  if (specifier === './advanced-estimate' || specifier === './video-walkthrough' || (scenario === 'programme-pdf' && specifier === './client-page')) return 'virtual:excluded-lazy';
  if (specifier.split('/').at(-1) === 'actions' || specifier.endsWith('-actions')) return 'virtual:excluded-action';
  if (specifier.endsWith('.module.css')) return stylesheet(specifier.startsWith('@/') ? path.resolve(root,'src',specifier.slice(2)) : path.resolve(path.dirname(parent),specifier));
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
const entry = `${dir}/${scenario}-entry.tsx`;
compile(entry);
fs.writeFileSync(`${out}/pending-browser.json`, JSON.stringify([...pending].map(([file, bytes]) => ({file,bytes})), null, 2));
if (pending.size) {
  console.log(JSON.stringify({result:'DEPENDENCIES_PENDING',files:pending.size,bytes:[...pending.values()].reduce((a,b)=>a+b,0)}));
  process.exitCode = 2;
} else {
  const body = [...modules].map(([id, value]) => `${JSON.stringify(id)}:[function(require,module,exports){\n${value.code}\n},${JSON.stringify(value.dependencies)}]`).join(',\n');
  // Keep the offline fixture's strict CSP: use Zod's installed interpreter,
  // not its optional generated-function fast path. Application config is untouched.
  // Use the installed browser distribution, not a PDF stub or provider.
  const pdfRuntime = ['programme-pdf', 'proposal-view'].includes(scenario) ? read(`${deps}/jspdf/dist/jspdf.umd.min.js`) + '\n' : '';
  const zodSetup = modules.has(`${deps}/zod/index.cjs`) ? `__load(${JSON.stringify(`${deps}/zod/index.cjs`)}).config({jitless:true});` : '';
  fs.writeFileSync(`${out}/components.js`, `${pdfRuntime}const process={env:{NODE_ENV:'development'}};const __modules={${body}};const __cache={};function __load(id){if(__cache[id])return __cache[id].exports;const [fn,map]=__modules[id];const module={exports:{}};__cache[id]=module;fn(spec=>__load(map[spec]),module,module.exports);return module.exports;}${zodSetup}__load(${JSON.stringify(entry)});`);
  fs.writeFileSync(`${out}/components.css`, styleSheets.join('\n'));
  const scope = scenario === 'proposal-view' ? 'Actual proposal review/document dialog/native Edge modal;synthetic data/mock actions/router/theme;no save/send/download/Auth/DB/provider/hosted journey' : scenario === 'programme-pdf' ? 'Actual programme editor/proposal review/frozen snapshot/document/local jsPDF;mock saves/router;detailed planner excluded;no Auth/DB/provider/publication/hosted journey' : 'Actual Brief/pricing components and controllers;mock Brief save/router;price persistence refuses;Advanced/video excluded,not visited;no Auth/DB/provider/hosted journey';
  fs.writeFileSync(`${out}/source-manifest.json`, JSON.stringify({sourceHashes:Object.fromEntries(sourceHashes),modules:modules.size,scope},null,2));
  console.log(JSON.stringify({result:'PASS',modules:modules.size,bundleBytes:fs.statSync(`${out}/components.js`).size,compiler:ts.version,runtime:scope}));
}

