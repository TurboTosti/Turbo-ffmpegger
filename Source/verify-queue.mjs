import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {parse} from 'acorn';

// Run the shipped queue functions in memory. This never opens the app or uses desktop input.
const html=fs.readFileSync(new URL('./app/ui/index.html',import.meta.url),'utf8');
const main=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const desktop=fs.readFileSync(new URL('./app/ui/desktop.js',import.meta.url),'utf8');
const names=new Set(['applyPresetSelection','applyPresetToJobs','toggleJobSelected','restartJob','startQueue','updateRunButton','renderJobs','updateTally','confirmApplyAll','confirmApplySelected','jobCanBeSelected','prepareJobForConversion','ffmpegErrorReason']);
let definitions='';
for(const source of [main,desktop]){
 for(const node of parse(source,{ecmaVersion:'latest'}).body){
  if(node.type==='FunctionDeclaration'&&names.has(node.id.name)){definitions+=source.slice(node.start,node.end)+'\n';names.delete(node.id.name);}
 }
}
assert.equal(names.size,0,'Extract all production queue functions');
const elements=new Map();
const context=vm.createContext({
 jobs:[],selectedPreset:null,running:false,updateInstalling:false,stopRequested:false,pendingApply:null,
 document:{getElementById(id){if(!elements.has(id))elements.set(id,{innerHTML:'',style:{},disabled:false});return elements.get(id);}},
 getT:()=>({ac:'#aa0',bord:'#444',text:'#fff',muted:'#aaa',surf:'#222',surf2:'#333',ok:'#0a0',err:'#a00',acText:'#000',logBg:'#111'}),
 L:(key,...values)=>key+' '+values.join(' '),esc:value=>String(value??''),escJs:value=>String(value??''),
 refreshMatchScores:()=>{},renderPresets:()=>{},probeWarning:()=>'',seqFpsHint:()=>'',estimateOutputSize:()=>null,
 fmtSec:String,fmtBytes:String,fso:{FileExists:()=>false},
 showApplyPresetModal(p,all,sel){context.pendingApply={preset:p,all,sel};},
 closeApplyModal(){context.pendingApply=null;},
 runNext(list){context.started=list.map(j=>({id:j.id,input:j.inputPath,preset:j.preset.id}));}
});
vm.runInContext(definitions,context);
const checks=[];
function check(name,body){body();checks.push(name);}
const original={id:'original',name:'Original'},replacement={id:'new-template',name:'New template'};
function job(id,status,selected=true){return {id,status,selected,preset:original,inputPath:'C:\\media\\source '+id+'.mp4',filename:'source '+id+'.mp4',log:'previous log',outputPath:'C:\\out\\previous.mp4',prog:{timeSec:12},totalSec:12,probe:{ok:true,duration:12},aborted:status==='cancelled',outSizeBytes:1234,token:null};}
function setup(jobs){context.jobs=jobs;context.selectedPreset=original;context.running=false;context.updateInstalling=false;context.pendingApply=null;context.started=null;}

for(const status of ['done','cancelled','error','pending']){
 check(status+' video keeps its selection control',()=>{
  setup([job(1,status,false)]);context.renderJobs();
  assert.match(elements.get('job-list').innerHTML,/toggleJobSelected\(1\)/);
  context.toggleJobSelected(1);assert.equal(context.jobs[0].selected,true);
 });
 check(status+' video accepts a new template and converts from its original source',()=>{
  const j=context.jobs[0],input=j.inputPath,probe=j.probe;
  context.applyPresetSelection(replacement);
  assert.equal(j.status,'pending');assert.equal(j.preset,replacement);assert.equal(j.inputPath,input);assert.equal(j.probe,probe);
  if(status!=='pending'){assert.equal(j.aborted,false);assert.equal(j.outputPath,'');assert.equal(j.prog,null);assert.equal(j.totalSec,12);}
  assert.equal(elements.get('btn-run').disabled,false);assert.equal(context.started,null,'Wait for Convert instead of starting automatically');
  context.startQueue();assert.equal(context.started.length,1);assert.equal(context.started[0].input,input);assert.equal(context.started[0].preset,'new-template');
 });
}
check('Running video cannot be selected or have its template changed',()=>{
 setup([job(1,'running',false)]);context.renderJobs();
 assert.doesNotMatch(elements.get('job-list').innerHTML,/toggleJobSelected\(1\)/);
 context.toggleJobSelected(1);context.applyPresetToJobs(replacement,context.jobs);
 assert.equal(context.jobs[0].selected,false);assert.equal(context.jobs[0].preset,original);assert.equal(context.jobs[0].status,'running');
});
check('Only selected applies to finished and aborted videos without changing other rows',()=>{
 setup([job(1,'done'),job(2,'cancelled'),job(3,'error',false),job(4,'pending',false),job(5,'running')]);
 context.applyPresetSelection(replacement);
 assert.equal(context.pendingApply.all.length,4);assert.equal(context.pendingApply.sel.length,2);
 context.confirmApplySelected();
 assert.deepEqual(context.jobs.map(j=>j.status),['pending','pending','error','pending','running']);
 assert.deepEqual(context.jobs.map(j=>j.preset.id),['new-template','new-template','original','original','original']);
 assert.equal(elements.get('btn-run').disabled,false);
});
check('Apply to all requeues every available video and leaves the active conversion alone',()=>{
 setup([job(1,'done'),job(2,'cancelled'),job(3,'error'),job(4,'pending'),job(5,'running')]);
 context.applyPresetSelection(replacement);context.confirmApplyAll();
 assert.deepEqual(context.jobs.map(j=>j.status),['pending','pending','pending','pending','running']);
 assert.equal(context.jobs[4].preset,original);
});
check('A video that begins running while a template dialog is open remains unchanged',()=>{
 setup([job(1,'pending'),job(2,'done')]);context.applyPresetSelection(replacement);
 context.jobs[0].status='running';context.confirmApplyAll();assert.equal(context.jobs[0].preset,original);assert.equal(context.jobs[0].status,'running');
});
check('Completed selected videos are not implicitly rerun by Convert',()=>{
 setup([job(1,'done'),job(2,'cancelled')]);context.updateRunButton();
 assert.equal(elements.get('btn-run').disabled,true);context.startQueue();assert.equal(context.started,null);
});
check('Explicit rerun retains the assigned template and original source',()=>{
 setup([job(1,'done')]);context.jobs[0].preset=replacement;context.restartJob(1);
 assert.equal(context.started[0].preset,'new-template');assert.equal(context.started[0].input,'C:\\media\\source 1.mp4');
});
check('Changing a template during another conversion waits for the queue',()=>{
 setup([job(1,'done')]);context.running=true;context.applyPresetSelection(replacement);
 assert.equal(context.jobs[0].status,'pending');assert.equal(elements.get('btn-run').disabled,true);assert.equal(context.started,null);
});
check('Requeue preserves image-sequence source information',()=>{
 setup([Object.assign(job(1,'cancelled'),{isSequence:true,seqCount:40,seqStart:1,inputPath:'C:\\sequence\\frame_%03d.png'})]);
 context.applyPresetSelection(replacement);assert.equal(context.jobs[0].isSequence,true);assert.equal(context.jobs[0].seqCount,40);assert.equal(context.jobs[0].seqStart,1);
});
fs.writeFileSync(new URL('./queue-verification.json',import.meta.url),JSON.stringify({success:true,method:'Production queue functions tested in Node.js without opening an app or using desktop input.',checks},null,2));
console.log(JSON.stringify({success:true,checks:checks.length},null,2));
