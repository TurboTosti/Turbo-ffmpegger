const fs=require('node:fs'),path=require('node:path');const base=__dirname;
for(const file of ['tests/core.cjs','tests/performance.cjs','tests/renderer.cjs']){let s=fs.readFileSync(path.join(base,file),'utf8');s=s.replace("tools=path.resolve(__dirname,'../../harness/Data')","tools=process.env.TURBO_TEST_TOOLS||path.resolve(__dirname,'../../harness/Data')");s=s.replace("ffmpeg=path.resolve(__dirname,'../../harness/Data/ffmpeg.exe')","ffmpeg=path.join(process.env.TURBO_TEST_TOOLS||path.resolve(__dirname,'../../harness/Data'),'ffmpeg.exe')");fs.writeFileSync(path.join(base,file),s);}
const read=p=>JSON.parse(fs.readFileSync(path.join(base,p)));
const core=read('tests/core-results.json'),queue=read('queue-verification.json'),game=read('tests/game-results.json'),gameLifecycle=read('tests/game-lifecycle-results.json'),gameRecovery=read('tests/game-recovery-results.json'),audio=read('tests/audio-results.json'),performance=read('tests/performance-results.json');
fs.writeFileSync(path.join(base,'Verification.json'),JSON.stringify({
 version:require('./app/package.json').version,
 method:'Background tests only; no physical desktop input or visible UI tests.',
 core:{success:core.success,checks:core.checks,verifiedVersion:'1.0.0-alpha',note:'Rerun for user-supplied conversion tools; test tools are external fixtures, excluded from release packages.'},
 externalTools:read('tests/external-tools-results.json'),
 popups:{...read('tests/popups-results.json'),verifiedVersion:'1.0.0-alpha.2',note:'Retained: popup and menu code unchanged in the rebuilt public 1.0 alpha.'},
 simpleMode:{...read('tests/simple-mode-results.json'),verifiedVersion:'1.0.0-alpha',note:'Rerun with the changed media preflight and external test conversion programs; UI itself is unchanged.'},
 settingsPersistence:{...read('tests/preferences-results.json'),verifiedVersion:'1.0.0-alpha.1',note:'Retained; storage/preferences and app-close host code are unchanged.'},
 versioning:read('tests/versions-results.json'),
 queue:{...queue,verifiedVersion:'1.0.0-alpha.2',note:'Retained: queue code unchanged.'},
 publicRelease:{tag:'v1.0-alpha',packageVersion:'1.0.0-alpha',conversionProgramsIncluded:false,electronMediaLibrariesIncluded:true,note:'User-requested public label and external conversion tools. UI/game unchanged; host and media preflight now use original-root tools across updates. Local alpha.1/alpha.2 copies require a manual installation.'},
 game,gameLifecycle,gameRecovery,audio,
 retainedGameChecks:{verifiedVersion:'2.0.2',note:'ROM/emulator/audio/CRT are unchanged. Historical deterministic ROM/audio checks retained; controller lifecycle and recovery checks rerun for 1.0 alpha 1 after the options-save error handling change.'},
 aurora:{...read('previews/aurora-render-results.json'),verifiedVersion:'2.0.4',note:'Historical report: its timing did not force Canvas readback and may omit deferred raster work. Use the current background report for forced-readback software timing. Current checks also verify identical Aurora pixels.'},
 backgrounds:{...read('previews/backgrounds-render-results.json'),verifiedVersion:'2.0.5',note:'Historical full-HTML hash. The complete background renderer remains byte-identical in this public 1.0 alpha build; current UI source checks cover that comparison.'},
 uiSyntaxAndScope:read('previews/ui-checks.json'),
 performance:{...performance,measuredVersion:'2.0.1',note:'Retained measurement: game worker, audio worklet and CRT renderer remain unchanged. This does not cover the 2.0.4/2.0.5 backgrounds or native Chromium/GPU rendering.'},
 desktopUI:{status:'Centered popup styling and real animation appearance require user testing. Background tests cover popup/editor handoff, navigation, interrupted animation, reduced motion and Simple mode conversion with in-memory DOM.',userFeedback:'User confirmed game audio/CRT were good and liked the Aurora improvement; requested matching popup style and simpler menus after alpha 1.',reason:'The prior hidden Electron renderer test failed with exitCode 49 even for a minimal data page; GPU subprocess failed with 0xC0000135. Sandbox remained enabled. That blocked test was not repeated. No visible window, physical input or audio device was used.'},
 linux:{status:'packaged only; not run on Linux'},
 rustPopup:{status:'not reproduced; no Rust compiler or invocation in the application',note:'User considers another agent a likely source. Game and media lifecycle diagnostics added to Data/Logs/application.log.'},
 realLegacyProfile:{status:'not accessed by development tools; imported by the app when the user first launches it'}
},null,2));
let s=fs.readFileSync(path.join(base,'app/ui/desktop.js'),'utf8').replace('compiled Windows package','portable desktop package');fs.writeFileSync(path.join(base,'app/ui/desktop.js'),s);
