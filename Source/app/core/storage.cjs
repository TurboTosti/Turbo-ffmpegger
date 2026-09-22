const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {Preferences}=require('./preferences.cjs');
const allowed=new Set(['settings.json','presets.json','custom_presets.json','game-options.json']);
function readJSON(file){return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}
function atomic(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';try{fs.writeFileSync(temp,JSON.stringify(value,null,2));fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}}
function mergePresets(base,extra){const out=base.map(p=>({...p}));for(const p of Array.isArray(extra)?extra:[]){if(!p||!['id','name','args','outputExt'].every(k=>typeof p[k]==='string')||!p.id||!p.name)continue;const index=out.findIndex(q=>q.id===p.id);if(index<0)out.push(p);else out[index]=p;}return out;}
function mergeCustoms(current,incoming){const out=Array.isArray(current)?current.slice():[];for(const p of Array.isArray(incoming)?incoming:[]){if(!p||typeof p.name!=='string'||typeof p.args!=='string')continue;const match=out.find(q=>q.id===p.id);if(match&&JSON.stringify(match)===JSON.stringify(p))continue;out.push(match?{...p,id:p.id+'-import-'+crypto.randomUUID()}:p);}return out;}
class Storage{
 constructor(root,resources,{legacyRoot=null,onSaveError=()=>{}}={}){
  this.root=path.resolve(root);this.resources=resources;this.data=path.join(this.root,'Data');this.logs=path.join(this.data,'Logs');
  try{fs.mkdirSync(this.logs,{recursive:true});const check=path.join(this.data,'.write-'+crypto.randomUUID());fs.writeFileSync(check,'');fs.unlinkSync(check);}catch(e){throw Error('This portable folder is not writable. Move the whole application to a folder you can write to. '+e.message);}
  this.preferences=new Preferences({file:name=>this.file(name),onError:(name,error)=>{this.log('Saving '+name+': '+error.message);onSaveError(name,error);}});
  this.defaults=readJSON(path.join(resources,'ui','default-presets.json'));
  // First launch on the existing Windows PC imports the previous desktop edition.
  // No automatic import is repeated after the folder has been carried to another PC.
  if(!fs.existsSync(path.join(this.data,'portable.json'))){
   if(legacyRoot&&fs.existsSync(legacyRoot))this.importLegacy(legacyRoot);
   atomic(path.join(this.data,'portable.json'),{schema:1,migratedAt:new Date().toISOString()});
  }
  if(!fs.existsSync(this.file('settings.json')))atomic(this.file('settings.json'),{});
  if(!fs.existsSync(this.file('custom_presets.json')))atomic(this.file('custom_presets.json'),[]);
  this.loadPresets();
 }
 file(name){if(!allowed.has(name))throw Error('Unknown settings file');return path.join(this.data,name);}
 backup(file){if(!fs.existsSync(file))return;const target=path.join(this.data,'Backups',path.basename(file)+'.'+Date.now()+'-'+crypto.randomUUID());fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(file,target);}
 importLegacy(legacy){
  const report=[];
  for(const name of ['settings.json','presets.json','custom_presets.json']){
   const source=path.join(legacy,name);if(!fs.existsSync(source))continue;
   let old;try{old=readJSON(source);}catch(e){throw Error('The previous '+name+' could not be imported. Its original file has not been changed. '+e.message);}
   const target=this.file(name);this.backup(target);
   fs.mkdirSync(path.join(this.data,'Backups'),{recursive:true});
   fs.copyFileSync(source,path.join(this.data,'Backups','imported-'+name));
   const existing=fs.existsSync(target)?readJSON(target):null;
   const value=name==='custom_presets.json'?mergeCustoms(existing,old):name==='presets.json'?mergePresets(existing||[],old):{...(existing||{}),...old};
   atomic(target,value);report.push({file:name,entries:Array.isArray(value)?value.length:undefined});
  }
  atomic(path.join(this.data,'migration-report.json'),{date:new Date().toISOString(),files:report});return report;
 }
 loadPresets(){let saved;try{saved=readJSON(this.file('presets.json'));}catch{saved=[];}
  const merged=mergePresets(this.defaults,saved);if(JSON.stringify(saved)!==JSON.stringify(merged)){this.backup(this.file('presets.json'));atomic(this.file('presets.json'),merged);}return merged;
 }
 load(name){this.file(name);const pending=this.preferences.pending(name);if(pending!==undefined)return pending;if(name==='presets.json')return JSON.stringify(this.loadPresets());return fs.existsSync(this.file(name))?fs.readFileSync(this.file(name),'utf8'):'{}';}
 flush(){return this.preferences.flush();}
 save(name,text){this.file(name);if(name==='settings.json'||name==='game-options.json')return this.preferences.save(name,text);const value=JSON.parse(text),file=this.file(name);if(name==='custom_presets.json'||name==='presets.json')this.backup(file);atomic(file,value);return true;}
 gameLoad(){const file=path.join(this.data,'Game','voidbreaker-state.json');if(!fs.existsSync(file))return null;try{const saved=readJSON(file);return saved.reset?null:saved;}catch{const backup=file+'.previous';if(fs.existsSync(backup))return readJSON(backup);throw Error('The saved game could not be read. Reset the game to start again.');}}
 gameReset(){const file=path.join(this.data,'Game','voidbreaker-state.json');this.backup(file);atomic(file,{schema:1,reset:true});return true;}
 gameSave(value){if(value?.schema!==1||typeof value.romHash!=='string'||!value.state)throw Error('Invalid game save');const file=path.join(this.data,'Game','voidbreaker-state.json');if(fs.existsSync(file))fs.copyFileSync(file,file+'.previous');atomic(file,value);return true;}
 log(message){try{fs.appendFileSync(path.join(this.logs,'application.log'),new Date().toISOString()+' '+message+'\n');}catch{}}
}
module.exports={Storage,atomic,readJSON,mergePresets,mergeCustoms};
