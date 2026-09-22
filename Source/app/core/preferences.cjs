const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

// Never remove/truncate the destination to get around a Windows sharing lock.
async function replaceJSON(file,text,{io=fs.promises,wait=delay,retries=[80,160,320,640,1000]}={}){
 const temp=file+'.'+crypto.randomUUID()+'.tmp';
 try{
  await io.mkdir(path.dirname(file),{recursive:true});
  await io.writeFile(temp,text);
  for(let attempt=0;;attempt++){
   try{await io.rename(temp,file);break;}
   catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=retries.length)throw error;await wait(retries[attempt]);}
  }
 }finally{await io.unlink(temp).catch(()=>{});}
}

class Preferences{
 constructor({file,write=replaceJSON,onError=()=>{},debounce=250}){this.file=file;this.write=write;this.onError=onError;this.debounce=debounce;this.entries=new Map();}
 save(name,text){
  const value=JSON.stringify(JSON.parse(text),null,2);
  let entry=this.entries.get(name);
  if(!entry){entry={revision:0,saved:0,active:null,timer:null,warned:false};this.entries.set(name,entry);}
  entry.text=value;entry.revision++;
  clearTimeout(entry.timer);entry.timer=setTimeout(()=>{entry.timer=null;this.drain(name,entry).catch(()=>{});},this.debounce);
  return true;
 }
 pending(name){const e=this.entries.get(name);return e&&e.revision!==e.saved?e.text:undefined;}
 async drain(name,entry){
  if(entry.active)return entry.active;
  entry.active=(async()=>{
   while(entry.saved!==entry.revision){
    const revision=entry.revision,text=entry.text;
    try{await this.write(this.file(name),text);entry.saved=revision;entry.warned=false;}
    catch(error){if(!entry.warned){entry.warned=true;this.onError(name,error);}throw error;}
   }
  })();
  try{await entry.active;}finally{entry.active=null;}
 }
 async flush(){
  const results=await Promise.allSettled([...this.entries].map(async([name,entry])=>{
   clearTimeout(entry.timer);entry.timer=null;
   // A previously failed attempt can be retried when closing the app.
   if(entry.active)await entry.active.catch(()=>{});
   await this.drain(name,entry);
  }));
  if(results.some(r=>r.status==='rejected'))throw Error('Your latest settings could not be saved yet. The previous saved settings are safe. Keep the app open and try closing again after the folder is unlocked. If this keeps happening, move the whole portable folder to a writable location.');
 }
}
module.exports={Preferences,replaceJSON};
