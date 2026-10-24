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
if (!['a051-advanced-boq', 'import-render', 'existing-price-uncertain', 'detailed-geometry', 'brief-price', 'first-job', 'programme-pdf', 'proposal-view', 'journey', 'unseeded-journey', 'pricing-payments-journey', 'terms-flow', 'reader-styled', 'programme-styled', 'build-up', 'built-up-proposal', 'activity-grouping', 'reported-calendar', 'signup-native', 'profile-sections', 'completion-native', 'existing-price-native', 'signin-native', 'existing-estimate-add', 'programme-mode', 'boq-activity-boundary', 'a003-palette', 'keyboard-price', 'callback-native', 'signup-outcome-native'].includes(scenario)) throw Error('Unknown offline scenario.');
const fixtureGlobal = scenario === 'a051-advanced-boq' ? '__a051AdvancedBoqLocal' : scenario === 'detailed-geometry' ? '__detailedGeometryLocal' : scenario === 'existing-price-uncertain' ? '__existingPriceUncertainLocal' : scenario === 'import-render' ? '__importRenderLocal' : scenario === 'signup-outcome-native' ? '__signupOutcomeNativeLocal' : scenario === 'callback-native' ? '__callbackNativeLocal' : scenario === 'keyboard-price' ? '__keyboardPriceLocal' : scenario === 'a003-palette' ? '__a003PaletteLocal' : scenario === 'boq-activity-boundary' ? '__boqBoundaryLocal' : scenario === 'programme-mode' ? '__programmeModeLocal' : scenario === 'existing-estimate-add' ? '__existingEstimateAddLocal' : scenario === 'signin-native' ? '__signinNativeLocal' : scenario === 'first-job' ? '__firstJobLocal' : scenario === 'programme-pdf' ? '__programmePdfLocal' : scenario === 'proposal-view' ? '__documentViewLocal' : scenario === 'journey' ? '__journeyLocal' : scenario === 'unseeded-journey' ? '__unseededJourneyLocal' : scenario === 'terms-flow' ? '__termsFlowLocal' : scenario === 'reader-styled' ? '__readerStyledLocal' : scenario === 'build-up' ? '__buildUpLocal' : scenario === 'built-up-proposal' ? '__builtUpProposalLocal' : scenario === 'activity-grouping' ? '__activityGroupingLocal' : scenario === 'reported-calendar' ? '__reportedCalendarLocal' : scenario === 'pricing-payments-journey' ? '__pricingPaymentsJourneyLocal' : scenario === 'signup-native' ? '__signupNativeLocal' : scenario === 'profile-sections' ? '__profileSectionsLocal' : scenario === 'completion-native' ? '__completionNativeLocal' : scenario === 'existing-price-native' ? '__existingPriceNativeLocal' : '__briefPriceLocal';
const pdfScenario = ['programme-pdf', 'proposal-view', 'journey', 'unseeded-journey', 'pricing-payments-journey', 'terms-flow', 'reader-styled', 'built-up-proposal', 'reported-calendar'].includes(scenario);
const programmeStyleScenario = ['programme-pdf', 'journey', 'unseeded-journey', 'pricing-payments-journey', 'built-up-proposal'].includes(scenario);
// The built-up proposal leg reuses the build-up leg's lazy and MOCK action hooks unchanged.
const buildUpScenario = ['a051-advanced-boq', 'existing-price-uncertain', 'build-up', 'built-up-proposal', 'activity-grouping', 'a003-palette'].includes(scenario);
// The reported-calendar leg opens the actual detailed planner through the same lazy adapter.
const plannerScenario = ['detailed-geometry', 'reported-calendar', 'programme-mode'].includes(scenario);
const lazyScenario = buildUpScenario || plannerScenario;
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
if (scenario === 'reader-styled' || scenario === 'a003-palette') delete virtual['@/lib/theme-context'];
if (scenario === 'completion-native') {
  virtual['@/lib/platform-terms-completion-action'] = `exports.completePlatformTermsAcceptanceAction=async function(input){const f=window.${fixtureGlobal};f.completionInvocationCount++;f.lastCompletionInput=input;return f.completionBehavior();};`;
}
if (scenario === 'signup-native' || scenario === 'signup-outcome-native') {
  virtual['@/lib/platform-signup-action'] = `exports.platformSignupAction=async function(input){const f=window.${fixtureGlobal};f.signupInvocationCount++;f.lastSignupInput=input;return f.signupBehavior();};`;
  virtual['@/lib/supabase/client'] = `function refused(name){window.${fixtureGlobal}.calls.push('REFUSED.'+name);return Promise.reject(new Error('Browser Supabase auth refused in offline signup-native fixture'));}exports.createClient=function(){return{auth:{signInWithPassword:function(){return refused('auth.signInWithPassword');},signUp:function(){return refused('auth.signUp');}}};};`;
}
// The build-up leg loads the actual AdvancedEstimate lazily, and answers its
// costs actions only from the fixture's explicit MOCK acknowledgement script.
if (lazyScenario) {
  // The detailed planner's own actions record any call and refuse; nothing is saved by opening it.
  if (plannerScenario) virtual['planner-actions-mock'] = ['updatePhasesAction','getEstimatePhasesAction','saveProgrammePhasesAction','generateWeeklyUpdateAction','getProgrammeUpdatesAction']
    .map(name => `exports.${name}=async(...args)=>{window.${fixtureGlobal}.plannerCalls.push({name:${JSON.stringify(name)},args:JSON.parse(JSON.stringify(args))});throw Error('Local fixture: detailed planner actions are refused');};`).join('');
  // The activity leg also answers AdvancedEstimate's activity save from the same MOCK script contract.
  if ((scenario === 'activity-grouping' || scenario === 'existing-price-uncertain' || scenario === 'a051-advanced-boq')) virtual['activity-actions-mock'] = `exports.savePriceLineActivityAction=async(...args)=>{const f=window.__buildUpLocal;f.actionCalls.push({name:'savePriceLineActivityAction',args:JSON.parse(JSON.stringify(args))});return f.answer('savePriceLineActivityAction',args);};`;
  virtual['next/dynamic'] = `const React=require('react');module.exports=function dynamic(load,options){return function LazyFixtureComponent(props){const [C,setC]=React.useState(null);React.useEffect(()=>{let live=true;load().then(m=>{if(live)setC(()=>m.default||m)});return()=>{live=false}},[]);return C?React.createElement(C,props):(options&&options.loading?options.loading():null)}};`;
  virtual['build-up-actions'] = ['createEstimateAction','updateEstimateMarginsAction','updateEstimateNameAction','addLineItemAction','updateLineItemAction','deleteLineItemAction','setActiveEstimateAction','deleteEstimateAction','setPricingModeAction','saveDiscountAction','addComponentAction','updateComponentAction','deleteComponentAction','updateLineBuiltUpRateAction','saveRateBuildupAction']
    .map(name => `exports.${name}=async(...args)=>{const f=window.__buildUpLocal;f.actionCalls.push({name:${JSON.stringify(name)},args:JSON.parse(JSON.stringify(args))});return f.answer(${JSON.stringify(name)},args);};`).join('');
}
if (scenario === 'signin-native') {
  virtual['@/lib/platform-signup-action'] = `exports.platformSignupAction=async function(){window.${fixtureGlobal}.calls.push('REFUSED.platformSignupAction');throw Error('Signup action excluded from sign-in fixture');};`;
  virtual['@/lib/supabase/client'] = `function refused(name){window.${fixtureGlobal}.calls.push('REFUSED.'+name);return Promise.reject(new Error('Browser Supabase signUp refused in offline signin-native fixture'));}exports.createClient=function(){return{auth:{signInWithPassword:async function(input){const f=window.${fixtureGlobal};f.signInInvocationCount++;f.lastSignInInput=input;return f.signInBehavior();},signUp:function(){return refused('auth.signUp');}}};};`;
}
if (scenario === 'callback-native') {
  virtual['@/lib/platform-signup-action'] = `exports.platformSignupAction=async function(){window.${fixtureGlobal}.calls.push('REFUSED.platformSignupAction');throw Error('Signup action excluded from callback fixture');};`;
  virtual['@/lib/supabase/client'] = `function refused(name){window.${fixtureGlobal}.calls.push('REFUSED.'+name);return Promise.reject(new Error('Browser Supabase auth refused in offline callback-native fixture'));}exports.createClient=function(){return{auth:{signInWithPassword:function(){return refused('auth.signInWithPassword');},signUp:function(){return refused('auth.signUp');}}};};`;
}
if (scenario === 'import-render') {
  virtual['import-render-actions'] = `exports.previewWebsiteImportAction=async function(){window.__importRenderLocal.calls.push('REFUSED.preview');return{ok:false,error:'Refused in offline import-render fixture'}};exports.applyWebsiteImportAction=async function(){window.__importRenderLocal.calls.push('REFUSED.apply');return{ok:false,error:'Refused in offline import-render fixture'}};`;
  virtual['@/lib/theme-context'] = `exports.useTheme=()=>({theme:window.__importRenderLocal.theme,setTheme:()=>{}});`;
}
const packages = {
  react: 'react/index.js',
  'react/jsx-runtime': 'react/jsx-runtime.js',
  'react-dom': 'react-dom/index.js',
  'react-dom/client': 'react-dom/client.js',
  scheduler: 'scheduler/index.js',
  'lucide-react': 'lucide-react/dist/cjs/lucide-react.js',
  zod: 'zod/index.cjs',
  // The profile form also imports the installed toast package.
  ...(lazyScenario || scenario === 'profile-sections' ? { sonner: 'sonner/dist/index.js' } : {}),
};
function resolve(specifier, parent) {
  if (virtual[specifier]) return `virtual:${specifier}`;
  if (plannerScenario && specifier === './actions' && /\/projects\/schedule\/(client-page|programme-ai-update)\.tsx$/.test(parent)) return 'virtual:planner-actions-mock';
  if ((scenario === 'activity-grouping' || scenario === 'existing-price-uncertain' || scenario === 'a051-advanced-boq') && specifier === './activity-actions' && parent.endsWith('/projects/costs/advanced-estimate.tsx')) return 'virtual:activity-actions-mock';
  if (buildUpScenario && specifier === './actions' && /\/projects\/costs\/(advanced-estimate|build-up-panel)\.tsx$/.test(parent)) return 'virtual:build-up-actions';
  // Capability-gated (off in the cohort profile) and click-only Excel export; never rendered in this leg.
  if (buildUpScenario && (specifier === '@/app/dashboard/foundations/vision-takeoff' || specifier === './boq-import' || specifier === 'xlsx')) return 'virtual:excluded-lazy';
  if ((specifier === './advanced-estimate' && !buildUpScenario) || specifier === './video-walkthrough' || (programmeStyleScenario && specifier === './client-page')) return 'virtual:excluded-lazy';
  if (specifier === './actions' && parent.endsWith('/onboarding-client.tsx')) return 'virtual:setup-action';
  if (scenario === 'pricing-payments-journey' && parent.endsWith('/payment-stages.tsx') && specifier === '../proposal/actions') return 'virtual:proposal-actions-pricing-only';
  if (scenario === 'import-render' && specifier === './actions' && parent.endsWith('/profile/import/import-client.tsx')) return 'virtual:import-render-actions';
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
const entry = scenario === 'boq-activity-boundary' ? path.join(root,'e2e/local-navigation/boq-activity-boundary-entry.tsx') : `${dir}/${scenario === 'journey' ? 'journey' : scenario}-entry.tsx`;
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
  // A003: the actual application stylesheet from the installed Tailwind v3
  // pipeline (src/app/globals.css + tailwind.config.js), invoked exactly as
  // e2e/local-navigation/compile.mjs does. It goes before the CSS modules, as
  // the app's root layout loads globals.css first.
  if (scenario === 'a003-palette' || scenario === 'detailed-geometry') {
    read(path.join(root, 'src/app/globals.css'));
    read(path.join(root, 'tailwind.config.js'));
    read(fs.realpathSync(path.join(deps, '.bin', 'tailwindcss')));
    read(path.join(deps, 'tailwindcss/package.json'));
    execFileSync(path.join(deps, '.bin', 'tailwindcss'),
      ['--config', path.join(root, 'tailwind.config.js'), '--input', path.join(root, 'src/app/globals.css'), '--output', path.join(out, 'tailwind.css')],
      { cwd: root, timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] });
    styleSheets.unshift(read(path.join(out, 'tailwind.css')));
  }
  fs.writeFileSync(`${out}/components.css`, styleSheets.join('\n'));
  const scope = scenario === 'a051-advanced-boq' ? 'Actual EstimateClient/lazy AdvancedEstimate mounted with real is_client_boq estimate;exact refs/descriptions/sections/quantities/rates/totals/groups preserved/activity controls absent by gates/zero action writes/no import/provider/save;no AuthDB/hosted' : scenario === 'detailed-geometry' ? 'Actual detailed ClientSchedulePage with installed compiledTailwind/week-grid and dated shortbar geometry; synthetic5day phases/localStorage/refusingplanneractions/no policychange/save/AuthDB/hosted' : scenario === 'existing-price-uncertain' ? 'Actual EstimateClient/lazy AdvancedEstimate existing-line quantity uncertain MOCK acknowledgement; draft retained/old acknowledged money/guarded controls/no auto retry; no AuthDB/hosted/reload persistence proof' : scenario === 'import-render' ? 'Actual ImportClient/CompanyImportFrame/bundled CSSmodule desktop and 390phone computed geometry; preview/apply/router REFUSED; no crawl/AuthDB/provider/hosted; inner Tailwind utilities NOT compiled' : scenario === 'signup-outcome-native' ? 'Actual LoginPage typed confirmationrequired versuscreatedrecorded nativepresentation; MOCK signupactionresult only/browserauth-router refused/no actualaccountconsent/AuthDB/hosted' : scenario === 'callback-native' ? 'Actual LoginPage/AuthCallbackNotice hydration from REAL browser internal aboutblank URL search;ALLauth-signup-router REFUSED/no locationmock/network/AuthDB/hosted' : scenario === 'keyboard-price' ? 'Actual EstimateClient inline keyboard Tab-ShiftTab-CmdCtrlEnter save-and-add-next;MOCKsave existingestimate/retainedrows/noAuthDB/hosted' : scenario === 'a003-palette' ? 'Actual estimating LineForm-Next-AdvancedEstimate-BuildUpPanel+ThemeProvider under actual compiled Tailwind before CSSmodules;MOCKcosts actions/refusingApply/noAuthDB/served' : scenario === 'boq-activity-boundary' ? 'Actual EstimateClient clientBoQ row structure-prices-groups/unsupported activityedit ABSENT/ordinaryestimate editable;Advanced NOTmounted;synthetic data/MOCKrefusingpricewrites/noAuthDB/hosted' : scenario === 'programme-mode' ? 'Actual SimpleProgrammeClient saved default miniGantt/unsaved refusal/ack save/SAMEphases real lazy detailed planner/close refresh return;explicit MOCKsave-router-5daystorage/no AuthDB/hosted' : scenario === 'existing-estimate-add' ? 'Actual EstimateClient add alongside two retained saved lines;MOCK saveLine refusal thenack fromsubmittedargs/existingestimateId;no downstreamreseed/AuthDB/hosted' : scenario === 'signin-native' ? 'Actual current LoginPage sign-in redacted failure/pending recovery/drafts;MOCK auth only/no real AuthDB/hosted' : scenario === 'existing-price-native' ? 'Actual EstimateClient existing simple-line quantity/rate edit/remove with real controller and totals; injectable MOCK ack/refusal only/fromsubmittedargs/synthetic savedlines/no AuthDB/durability/hosted' : scenario === 'completion-native' ? 'Actual platform terms completion client/native required/pending/fixedack link and sameaction rejection; MOCK completionaction only/no AuthDB/recorder/realconsent/hosted' : scenario === 'profile-sections' ? 'Actual ProfileForm one-section-at-a-time chooser, mounted hidden sections, whole-form FormData save over explicit MOCK save script, native hidden-invalid reveal;real profile actions/upload/AI excluded;no Auth/DB/provider/hosted journey' : scenario === 'signup-native' ? 'Actual LoginPage native requiredconsent/pending/same-invocation transportrejection with draftretention; MOCK serveraction only/browserSupabaseREFUSED/no AuthDB/real signup/hostedacceptance' : scenario === 'pricing-payments-journey' ? 'Actual EstimateClient/PricingPaymentStages from null schedule, explicit MOCK refusal/ack store/remount, same saved payment rows in actual frozen document and real jsPDF;no AuthDB/durability/publication/hosted journey' : scenario === 'reported-calendar' ? 'Reported three-stage example: actual SimpleProgrammeClient (Sunday start kept until a weekday is chosen), MOCK save of real buildProgrammePhases output with revalidation re-render, actual lazy detailed ClientSchedulePage over the same saved phases (planner actions recorded and refused, 5-day week explicit stand-in), actual ReviewSendClient frozen document and local jsPDF;no Auth/DB/provider/publication/hosted journey' : scenario === 'activity-grouping' ? 'Actual EstimateClient/lazy AdvancedEstimate existing-line activity control, gates and grouping;savePriceLineActivityAction and costs actions answered only by explicit MOCK script, ack writes trade_section only;built-up/Preliminaries controls absent by source;no Auth/DB/provider/hosted journey' : scenario === 'built-up-proposal' ? 'Actual EstimateClient/lazy AdvancedEstimate/BuildUpPanel resource entry and Apply, Next:Programme link, SimpleProgrammeClient, ReviewSendClient frozen snapshot/document and local jsPDF;costs actions MOCK-acknowledged into an in-memory store from submitted args only, no downstream reseeding;programme/inclusion/routing MOCK;publish/retry/upload/AI refused;no Auth/DB/resource library/provider/publication/hosted journey' : scenario === 'build-up' ? 'Actual EstimateClient/lazy AdvancedEstimate/BuildUpPanel with real component and running-total maths;costs actions answered only by explicit MOCK acknowledgement/refusal script;synthetic empty reference data;simple-price server refuses;VisionTakeoff/BoQImport/xlsx excluded,not rendered;no Auth/DB/resource library/provider/hosted journey' : scenario === 'programme-styled' ? 'Actual ProgrammeOverview with actual programme CSS module;existing computed plans/bars;native CSS-module geometry only;no Tailwind/preflight/Auth/DB/save/provider/hosted/assistive/release acceptance' : scenario === 'reader-styled' ? 'Actual proposal review/native document dialog/reading pages/document renderer with actual dialog/reader/workspace CSS modules and actual ThemeProvider;synthetic data/refusing actions/router;in-memory localStorage stand-in;document renderer Tailwind utilities NOT compiled;no save/send/download/Auth/DB/provider/hosted journey' : scenario === 'proposal-view' ? 'Actual proposal review/document dialog/native Edge modal;synthetic data/mock actions/router/theme;no save/send/download/Auth/DB/provider/hosted journey' : scenario === 'programme-pdf' ? 'Actual programme editor/proposal review/frozen snapshot/document/local jsPDF;mock saves/router;detailed planner excluded;no Auth/DB/provider/publication/hosted journey' : scenario === 'terms-flow' ? 'Actual proposal review terms editor/frozen snapshot/document/local jsPDF;mock draft save applies tc_overrides;programme omitted;no Auth/DB/provider/publication/send/hosted journey' : scenario === 'journey' ? 'Joined company/first-job/brief/pricing/programme/proposal draft PDF;actual components/controllers/builders;mock save/router/theme/persistence;explicit estimate seed for programme leg;price persistence refused;detailed planner excluded;no Auth/DB/provider/publication/client-acceptance/Won/hosted journey' : scenario === 'unseeded-journey' ? 'Joined company/first-job/brief/empty pricing/EstimateClient first line MOCK-acknowledged save/programme/proposal draft PDF;actual components/controllers/builders;no estimate seed;MOCK price-line acknowledgement only;detailed planner excluded;no Auth/DB/provider/publication/client-acceptance/Won/hosted journey' : 'Actual Brief/pricing components and controllers;mock Brief save/router;price persistence refuses;Advanced/video excluded,not visited;no Auth/DB/provider/hosted journey';
  fs.writeFileSync(`${out}/source-manifest.json`, JSON.stringify({sourceHashes:Object.fromEntries(sourceHashes),modules:modules.size,scope},null,2));
  console.log(JSON.stringify({result:'PASS',modules:modules.size,bundleBytes:fs.statSync(`${out}/components.js`).size,compiler:ts.version,runtime:scope}));
}

