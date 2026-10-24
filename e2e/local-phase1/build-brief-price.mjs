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
if (!['brief-price', 'first-job', 'programme-pdf', 'proposal-view', 'journey', 'unseeded-journey', 'pricing-payments-journey', 'terms-flow', 'reader-styled', 'programme-styled', 'build-up', 'built-up-proposal', 'activity-grouping', 'reported-calendar', 'signup-native'].includes(scenario)) throw Error('Unknown offline scenario.');
const fixtureGlobal = scenario === 'first-job' ? '__firstJobLocal' : scenario === 'programme-pdf' ? '__programmePdfLocal' : scenario === 'proposal-view' ? '__documentViewLocal' : scenario === 'journey' ? '__journeyLocal' : scenario === 'unseeded-journey' ? '__unseededJourneyLocal' : scenario === 'terms-flow' ? '__termsFlowLocal' : scenario === 'reader-styled' ? '__readerStyledLocal' : scenario === 'build-up' ? '__buildUpLocal' : scenario === 'built-up-proposal' ? '__builtUpProposalLocal' : scenario === 'activity-grouping' ? '__activityGroupingLocal' : scenario === 'reported-calendar' ? '__reportedCalendarLocal' : scenario === 'pricing-payments-journey' ? '__pricingPaymentsJourneyLocal' : scenario === 'signup-native' ? '__signupNativeLocal' : '__briefPriceLocal';
const pdfScenario = ['programme-pdf', 'proposal-view', 'journey', 'unseeded-journey', 'pricing-payments-journey', 'terms-flow', 'reader-styled', 'built-up-proposal', 'reported-calendar'].includes(scenario);
const programmeStyleScenario = ['programme-pdf', 'journey', 'unseeded-journey', 'pricing-payments-journey', 'built-up-proposal'].includes(scenario);
// The built-up proposal leg reuses the build-up leg's lazy and MOCK action hooks unchanged.
const buildUpScenario = ['build-up', 'built-up-proposal', 'activity-grouping'].includes(scenario);
// The reported-calendar leg opens the actual detailed planner through the same lazy adapter.
const lazyScenario = buildUpScenario || scenario === 'reported-calendar';
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
  'next/navigation': `exports.useRouter=()=>window.${fixtureGlobal}.router;`,
  'next/dynamic': `module.exports=()=>function ExcludedLazyFeature(){throw Error('Advanced/video are outside this fixture')};`,
  'excluded-lazy': `module.exports={};`,
  'excluded-action': `module.exports=new Proxy({},{get:()=>()=>{throw Error('Real server action excluded from local fixture')}});`,
  '@/lib/theme-context': scenario === 'proposal-view' ? `exports.useTheme=()=>({theme:window.__documentViewOptions?.theme??'system-c'});` : `exports.useTheme=()=>({theme:'system-c'});`,
  'setup-action': `exports.saveSetupStepAction=()=>{throw Error('Real server action is excluded from verification')};`,
  ...(pdfScenario ? { jspdf: `module.exports=window.jspdf.jsPDF;` } : {}),
  ...(scenario === 'pricing-payments-journey' ? {
    'proposal-actions-pricing-only': `exports.savePricingPaymentStagesAction=async function(projectId,expectedSchedule,paymentSchedule){return window.${fixtureGlobal}.savePricingPaymentStages(projectId,expectedSchedule,paymentSchedule);};`,
  } : {}),

};
// The styled reader uses the actual ThemeProvider/useTheme, not a theme stand-in.
if (scenario === 'reader-styled') delete virtual['@/lib/theme-context'];
if (scenario === 'signup-native') {
  virtual['@/lib/platform-signup-action'] = `exports.platformSignupAction=async function(input){const f=window.${fixtureGlobal};f.signupInvocationCount++;f.lastSignupInput=input;return f.signupBehavior();};`;
  virtual['@/lib/supabase/client'] = `function refused(name){window.${fixtureGlobal}.calls.push('REFUSED.'+name);return Promise.reject(new Error('Browser Supabase auth refused in offline signup-native fixture'));}exports.createClient=function(){return{auth:{signInWithPassword:function(){return refused('auth.signInWithPassword');},signUp:function(){return refused('auth.signUp');}}};};`;
}
// The build-up leg loads the actual AdvancedEstimate lazily, and answers its
// costs actions only from the fixture's explicit MOCK acknowledgement script.
if (lazyScenario) {
  // The detailed planner's own actions record any call and refuse; nothing is saved by opening it.
  if (scenario === 'reported-calendar') virtual['planner-actions-mock'] = ['updatePhasesAction','getEstimatePhasesAction','saveProgrammePhasesAction','generateWeeklyUpdateAction','getProgrammeUpdatesAction']
    .map(name => `exports.${name}=async(...args)=>{window.__reportedCalendarLocal.plannerCalls.push({name:${JSON.stringify(name)},args:JSON.parse(JSON.stringify(args))});throw Error('Local fixture: detailed planner actions are refused');};`).join('');
  // The activity leg also answers AdvancedEstimate's activity save from the same MOCK script contract.
  if (scenario === 'activity-grouping') virtual['activity-actions-mock'] = `exports.savePriceLineActivityAction=async(...args)=>{const f=window.__buildUpLocal;f.actionCalls.push({name:'savePriceLineActivityAction',args:JSON.parse(JSON.stringify(args))});return f.answer('savePriceLineActivityAction',args);};`;
  virtual['next/dynamic'] = `const React=require('react');module.exports=function dynamic(load,options){return function LazyFixtureComponent(props){const [C,setC]=React.useState(null);React.useEffect(()=>{let live=true;load().then(m=>{if(live)setC(()=>m.default||m)});return()=>{live=false}},[]);return C?React.createElement(C,props):(options&&options.loading?options.loading():null)}};`;
  virtual['build-up-actions'] = ['createEstimateAction','updateEstimateMarginsAction','updateEstimateNameAction','addLineItemAction','updateLineItemAction','deleteLineItemAction','setActiveEstimateAction','deleteEstimateAction','setPricingModeAction','saveDiscountAction','addComponentAction','updateComponentAction','deleteComponentAction','updateLineBuiltUpRateAction','saveRateBuildupAction']
    .map(name => `exports.${name}=async(...args)=>{const f=window.__buildUpLocal;f.actionCalls.push({name:${JSON.stringify(name)},args:JSON.parse(JSON.stringify(args))});return f.answer(${JSON.stringify(name)},args);};`).join('');
}
const packages = {
  react: 'react/index.js',
  'react/jsx-runtime': 'react/jsx-runtime.js',
  'react-dom': 'react-dom/index.js',
  'react-dom/client': 'react-dom/client.js',
  scheduler: 'scheduler/index.js',
  'lucide-react': 'lucide-react/dist/cjs/lucide-react.js',
  zod: 'zod/index.cjs',
  ...(lazyScenario ? { sonner: 'sonner/dist/index.js' } : {}),
};
function resolve(specifier, parent) {
  if (virtual[specifier]) return `virtual:${specifier}`;
  if (scenario === 'reported-calendar' && specifier === './actions' && /\/projects\/schedule\/(client-page|programme-ai-update)\.tsx$/.test(parent)) return 'virtual:planner-actions-mock';
  if (scenario === 'activity-grouping' && specifier === './activity-actions' && parent.endsWith('/projects/costs/advanced-estimate.tsx')) return 'virtual:activity-actions-mock';
  if (buildUpScenario && specifier === './actions' && /\/projects\/costs\/(advanced-estimate|build-up-panel)\.tsx$/.test(parent)) return 'virtual:build-up-actions';
  // Capability-gated (off in the cohort profile) and click-only Excel export; never rendered in this leg.
  if (buildUpScenario && (specifier === '@/app/dashboard/foundations/vision-takeoff' || specifier === './boq-import' || specifier === 'xlsx')) return 'virtual:excluded-lazy';
  if ((specifier === './advanced-estimate' && !buildUpScenario) || specifier === './video-walkthrough' || (programmeStyleScenario && specifier === './client-page')) return 'virtual:excluded-lazy';
  if (specifier === './actions' && parent.endsWith('/onboarding-client.tsx')) return 'virtual:setup-action';
  if (scenario === 'pricing-payments-journey' && parent.endsWith('/payment-stages.tsx') && specifier === '../proposal/actions') return 'virtual:proposal-actions-pricing-only';
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
const entry = `${dir}/${scenario === 'journey' ? 'journey' : scenario}-entry.tsx`;
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
  const pdfRuntime = pdfScenario ? read(`${deps}/jspdf/dist/jspdf.umd.min.js`) + '\n' : '';
  const zodSetup = modules.has(`${deps}/zod/index.cjs`) ? `__load(${JSON.stringify(`${deps}/zod/index.cjs`)}).config({jitless:true});` : '';
  fs.writeFileSync(`${out}/components.js`, `${pdfRuntime}const process={env:{NODE_ENV:'development'}};const __modules={${body}};const __cache={};function __load(id){if(__cache[id])return __cache[id].exports;const [fn,map]=__modules[id];const module={exports:{}};__cache[id]=module;fn(spec=>__load(map[spec]),module,module.exports);return module.exports;}${zodSetup}__load(${JSON.stringify(entry)});`);
  fs.writeFileSync(`${out}/components.css`, styleSheets.join('\n'));
  const scope = scenario === 'signup-native' ? 'Actual LoginPage native requiredconsent/pending/same-invocation transportrejection with draftretention; MOCK serveraction only/browserSupabaseREFUSED/no AuthDB/real signup/hostedacceptance' : scenario === 'pricing-payments-journey' ? 'Actual EstimateClient/PricingPaymentStages from null schedule, explicit MOCK refusal/ack store/remount, same saved payment rows in actual frozen document and real jsPDF;no AuthDB/durability/publication/hosted journey' : scenario === 'reported-calendar' ? 'Reported three-stage example: actual SimpleProgrammeClient (Sunday start kept until a weekday is chosen), MOCK save of real buildProgrammePhases output with revalidation re-render, actual lazy detailed ClientSchedulePage over the same saved phases (planner actions recorded and refused, 5-day week explicit stand-in), actual ReviewSendClient frozen document and local jsPDF;no Auth/DB/provider/publication/hosted journey' : scenario === 'activity-grouping' ? 'Actual EstimateClient/lazy AdvancedEstimate existing-line activity control, gates and grouping;savePriceLineActivityAction and costs actions answered only by explicit MOCK script, ack writes trade_section only;built-up/Preliminaries controls absent by source;no Auth/DB/provider/hosted journey' : scenario === 'built-up-proposal' ? 'Actual EstimateClient/lazy AdvancedEstimate/BuildUpPanel resource entry and Apply, Next:Programme link, SimpleProgrammeClient, ReviewSendClient frozen snapshot/document and local jsPDF;costs actions MOCK-acknowledged into an in-memory store from submitted args only, no downstream reseeding;programme/inclusion/routing MOCK;publish/retry/upload/AI refused;no Auth/DB/resource library/provider/publication/hosted journey' : scenario === 'build-up' ? 'Actual EstimateClient/lazy AdvancedEstimate/BuildUpPanel with real component and running-total maths;costs actions answered only by explicit MOCK acknowledgement/refusal script;synthetic empty reference data;simple-price server refuses;VisionTakeoff/BoQImport/xlsx excluded,not rendered;no Auth/DB/resource library/provider/hosted journey' : scenario === 'programme-styled' ? 'Actual ProgrammeOverview with actual programme CSS module;existing computed plans/bars;native CSS-module geometry only;no Tailwind/preflight/Auth/DB/save/provider/hosted/assistive/release acceptance' : scenario === 'reader-styled' ? 'Actual proposal review/native document dialog/reading pages/document renderer with actual dialog/reader/workspace CSS modules and actual ThemeProvider;synthetic data/refusing actions/router;in-memory localStorage stand-in;document renderer Tailwind utilities NOT compiled;no save/send/download/Auth/DB/provider/hosted journey' : scenario === 'proposal-view' ? 'Actual proposal review/document dialog/native Edge modal;synthetic data/mock actions/router/theme;no save/send/download/Auth/DB/provider/hosted journey' : scenario === 'programme-pdf' ? 'Actual programme editor/proposal review/frozen snapshot/document/local jsPDF;mock saves/router;detailed planner excluded;no Auth/DB/provider/publication/hosted journey' : scenario === 'terms-flow' ? 'Actual proposal review terms editor/frozen snapshot/document/local jsPDF;mock draft save applies tc_overrides;programme omitted;no Auth/DB/provider/publication/send/hosted journey' : scenario === 'journey' ? 'Joined company/first-job/brief/pricing/programme/proposal draft PDF;actual components/controllers/builders;mock save/router/theme/persistence;explicit estimate seed for programme leg;price persistence refused;detailed planner excluded;no Auth/DB/provider/publication/client-acceptance/Won/hosted journey' : scenario === 'unseeded-journey' ? 'Joined company/first-job/brief/empty pricing/EstimateClient first line MOCK-acknowledged save/programme/proposal draft PDF;actual components/controllers/builders;no estimate seed;MOCK price-line acknowledgement only;detailed planner excluded;no Auth/DB/provider/publication/client-acceptance/Won/hosted journey' : 'Actual Brief/pricing components and controllers;mock Brief save/router;price persistence refuses;Advanced/video excluded,not visited;no Auth/DB/provider/hosted journey';
  fs.writeFileSync(`${out}/source-manifest.json`, JSON.stringify({sourceHashes:Object.fromEntries(sourceHashes),modules:modules.size,scope},null,2));
  console.log(JSON.stringify({result:'PASS',modules:modules.size,bundleBytes:fs.statSync(`${out}/components.js`).size,compiler:ts.version,runtime:scope}));
}

