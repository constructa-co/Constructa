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
// Additive scenario hook (1845): default 'navigation' keeps the original
// A004 three-case fixture bit-for-bit; 'brief-navigation' mounts the actual
// BriefClient and needs the css/actions/dynamic hooks below;
// 'responsive' (2125) mounts the hierarchy with the actual compiled Tailwind
// stylesheet from the installed pipeline.
const scenario = process.argv[3] ?? 'navigation';
if (!['navigation', 'brief-navigation', 'responsive', 'navigation-palette', 'shell-hierarchy'].includes(scenario)) throw Error('Unknown offline scenario.');
const globalName = scenario === 'shell-hierarchy' ? '__shellHierarchyLocal' : scenario === 'navigation-palette' ? '__navigationPaletteLocal' : scenario === 'brief-navigation' ? '__briefNavigationLocal' : scenario === 'responsive' ? '__responsiveHierarchyLocal' : '__navigationLocal';
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
// Same bounded .module.css port as e2e/local-phase1/build-brief-price.mjs:
// class names are prefixed per fixture; no handwritten CSS surrogate.
function stylesheet(file) {
  const source = read(file), prefix = 'fixture' + styleSheets.length + '_';
  const classes = Object.fromEntries([...source.matchAll(/\.([A-Za-z][\w-]*)/g)].map(m => [m[1], prefix + m[1]]));
  const id = 'css:' + file;
  if (!virtual[id]) { styleSheets.push(source.replace(/\.([A-Za-z][\w-]*)/g, (_, key) => '.' + classes[key])); virtual[id] = 'module.exports=' + JSON.stringify(classes) + ';'; }
  return 'virtual:' + id;
}

// Only the Next transport is simulated. SidebarNav, ProjectNavBar,
// PhoneMenuFocus, requestProjectNavigation, phone-nav and job-workflow are
// the application modules, not recreated fixture UI.
const virtual = {
  // Plain-anchor stand-in for next/link with Next-style client click
  // interception: a plain left click commits the fixture route through the
  // fixture global; modified clicks keep default behaviour.
  'next/link': `const React=require('react');module.exports=React.forwardRef(function Link({href,children,onClick,target,...props},ref){return React.createElement('a',{...props,href,target,ref,onClick:(event)=>{onClick?.(event);if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||target==='_blank')return;event.preventDefault();window.${globalName}.follow(String(href));}},children)});`,
  // Mocked Next router/path/query over the explicit fixture. The URLSearchParams
  // object is cached per query string so hook identity stays stable between
  // renders (useSearchParams is an effect dependency in SidebarNav).
  'next/navigation': `const cache=new Map();function params(query){if(!cache.has(query))cache.set(query,new URLSearchParams(query));return cache.get(query);}exports.useRouter=()=>window.${globalName}.router;exports.usePathname=()=>window.${globalName}.pathname;exports.useSearchParams=()=>params(window.${globalName}.query);`,
  // Mocked theme (no /api/theme fetch in the offline fixture).
  '@/lib/theme-context': `exports.useTheme=()=>({theme:window.${globalName}.theme,setTheme:(next)=>{window.${globalName}.theme=next;window.${globalName}.rerender();}});`,
  // BriefClient-only hooks: lazy/video and server actions are excluded, the
  // entry injects explicit mock ask/save props instead.
  'next/dynamic': `module.exports=()=>function ExcludedLazyFeature(){throw Error('Advanced/video are outside this fixture')};`,
  'excluded-action': `module.exports=new Proxy({},{get:()=>()=>{throw Error('Real server action excluded from local fixture')}});`,
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
  if (specifier.split('/').at(-1) === 'actions' || specifier.endsWith('-actions')) return 'virtual:excluded-action';
  if (specifier.endsWith('.module.css')) return stylesheet(specifier.startsWith('@/') ? path.resolve(root, 'src', specifier.slice(2)) : path.resolve(path.dirname(parent), specifier));
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
const entry = scenario === 'shell-hierarchy' ? path.join(dir, 'shell-hierarchy-entry.tsx') : scenario === 'navigation-palette' ? path.join(dir, 'navigation-palette-entry.tsx') : `${dir}/${scenario === 'brief-navigation' ? 'brief-navigation-entry.tsx' : scenario === 'responsive' ? 'responsive-hierarchy-entry.tsx' : 'entry.tsx'}`;
compile(entry);
// 2125 responsive provenance: compile the ACTUAL application stylesheet with
// the installed Tailwind v3 pipeline — inputs are exactly src/app/globals.css
// + tailwind.config.js, scanning ./src per the config's content globs. No
// surrogate CSS, no handwritten rules.
if (scenario === 'shell-hierarchy' || scenario === 'responsive' || scenario === 'navigation-palette') {
  read(path.join(root, 'src/app/globals.css'));
  read(path.join(root, 'tailwind.config.js'));
  read(fs.realpathSync(path.join(deps, '.bin', 'tailwindcss')));
  read(path.join(deps, 'tailwindcss/package.json'));
  execFileSync(path.join(deps, '.bin', 'tailwindcss'),
    ['--config', path.join(root, 'tailwind.config.js'), '--input', path.join(root, 'src/app/globals.css'), '--output', path.join(out, 'tailwind.css')],
    { cwd: root, timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] });
  styleSheets.push(read(path.join(out, 'tailwind.css')));
}
fs.writeFileSync(`${out}/pending-browser.json`, JSON.stringify([...pending].map(([file, bytes]) => ({file,bytes})), null, 2));
if (pending.size) {
  console.log(JSON.stringify({result:'DEPENDENCIES_PENDING',files:pending.size,bytes:[...pending.values()].reduce((a,b)=>a+b,0)}));
  process.exitCode = 2;
} else {
  const body = [...modules].map(([id, value]) => `${JSON.stringify(id)}:[function(require,module,exports){\n${value.code}\n},${JSON.stringify(value.dependencies)}]`).join(',\n');
  fs.writeFileSync(`${out}/components.js`, `const process={env:{NODE_ENV:'development'}};const __modules={${body}};const __cache={};function __load(id){if(__cache[id])return __cache[id].exports;const [fn,map]=__modules[id];const module={exports:{}};__cache[id]=module;fn(spec=>__load(map[spec]),module,module.exports);return module.exports;}__load(${JSON.stringify(entry)});`);
  fs.writeFileSync(`${out}/components.css`, styleSheets.join('\n'));
  const scope = scenario === 'shell-hierarchy' ? 'Actual DashboardShell SidebarNav ProjectNavBar mainoffset desktopphone geometry; actualTailwind3 pipeline; MOCKNext/theme/storage/syntheticbody; noDashboardLayoutAuthDB/hosted/assistive' : scenario === 'navigation-palette' ? 'Actual SidebarNav-ProjectNavBar-PhoneMenuFocus computed activepalette under actual installed Tailwind3/globals/config/provenance;MOCKNexttheme-storage/syntheticbody/noAuthDB/served' : scenario === 'responsive'
    ? 'Actual SidebarNav/ProjectNavBar/PhoneMenuFocus/requestProjectNavigation/phone-nav/job-workflow;actual compiled Tailwind stylesheet (globals.css+tailwind.config.js via installed tailwindcss v3);mocked Next link/router/path/query and theme;explicit memory localStorage;synthetic jobs;no Auth/DB/backend/provider/hosted journey'
    : scenario === 'brief-navigation'
    ? 'Actual BriefClient/SidebarNav/ProjectNavBar/PhoneMenuFocus/requestProjectNavigation/guided-brief;mock saves (acknowledge/refuse) and mocked Next link/router/path/query/theme;explicit memory localStorage;getRandomValues v4 id bridge;synthetic jobs;no AI transport/server action/Auth/DB/provider/hosted journey'
    : 'Actual SidebarNav/ProjectNavBar/PhoneMenuFocus/requestProjectNavigation/phone-nav/job-workflow;mocked Next link/router/path/query and theme;explicit memory localStorage;synthetic jobs and synthetic dirty editor;no Auth/DB/backend/provider/hosted journey';
  fs.writeFileSync(`${out}/source-manifest.json`, JSON.stringify({sourceHashes:Object.fromEntries(sourceHashes),modules:modules.size,scope},null,2));
  console.log(JSON.stringify({result:'PASS',modules:modules.size,bundleBytes:fs.statSync(`${out}/components.js`).size,compiler:ts.version,runtime:scope}));
}
