const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const {spawn}=require('node:child_process');
// Parse argument text without ever invoking a shell. Backslashes in normal file paths remain literal.
function splitArgs(text=''){const result=[];let value='',quote=null,started=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='\\'&&text[i+1]===quote){value+=text[++i];started=true;}else if(c===quote){quote=null;started=true;}else if(!quote&&(c==='"'||c==="'")){quote=c;started=true;}else if(!quote&&/\s/.test(c)){if(started){result.push(value);value='';started=false;}}else{value+=c;started=true;}}if(quote)throw Error('A preset argument has an unclosed quote.');if(started)result.push(value);return result;}
function readable(file){if(!path.isAbsolute(file)||!fs.statSync(file).isFile())throw Error('Choose an existing local file: '+file);fs.accessSync(file,fs.constants.R_OK);}
class Media{
 constructor(storage,tools){this.storage=storage;this.tools=tools;this.operations=new Map();this.reserved=new Set();}
 tool(name){const file=path.join(this.tools,name+(process.platform==='win32'?'.exe':''));
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())throw Error('FFmpeg and FFprobe are supplied separately. Add both programs to '+this.tools+' (missing '+path.basename(file)+'). See Help/FFmpeg-setup.md.');
  try{fs.accessSync(file,fs.constants.R_OK|(process.platform==='win32'?0:fs.constants.X_OK));}catch{throw Error('Cannot run '+file+'. Check its permissions; on Linux both programs need executable permission. See Help/FFmpeg-setup.md.');}return file;
 }
 get busy(){return [...this.operations.values()].some(o=>!o.done&&!o.isProbe);}
 probe(file){readable(file);return this.start(this.tool('ffprobe'),['-v','error','-print_format','json','-show_streams','-show_format','-i',file],{isProbe:true});}
 convert(r){
  const input=r.inputPath;readable(r.isSequence?r.firstFrame:input);const executable=this.tool('ffmpeg'),p=r.preset,ext=p.outputExt;
  if(!/^[a-z0-9]{1,12}$/i.test(ext))throw Error('Invalid output format.');
  const directory=path.resolve(r.simpleMode?path.dirname(input):(r.outputFolder||path.join(path.dirname(input),'output')));
  try{fs.mkdirSync(directory,{recursive:true});const test=path.join(directory,'.check-'+crypto.randomUUID());fs.writeFileSync(test,'');fs.unlinkSync(test);}catch(e){throw Error(r.simpleMode?'Cannot save beside this video. Move the video to a writable folder and try again.':'Choose a writable output folder using Browse. '+e.message);}
  const stem=path.basename((r.isSequence?r.seqBase.replace(/[_\-.]+$/,''):path.basename(input,path.extname(input)))||'sequence')+(r.simpleMode?'_converted':'');let output=path.join(directory,stem+'.'+ext),n=1;
  while(fs.existsSync(output)||this.reserved.has(output)||path.resolve(input)===output)output=path.join(directory,stem+'_'+n+++'.'+ext);this.reserved.add(output);
  const temp=path.join(directory,'.turbo-'+crypto.randomUUID()+'.'+ext),args=['-hide_banner','-nostdin','-progress','pipe:1','-nostats'],before=splitArgs(p.inputArgs);
  if(r.isSequence){if(!before.includes('-r')&&!before.includes('-framerate'))args.push('-framerate','30');args.push('-start_number',String(r.seqStart));}
  args.push(...before,'-i',input);
  const outputArgs=splitArgs(p.args);
  if(r.isSequence){if(p.flatten){if(!/^[a-z0-9#@.]+$/i.test(p.flatten))throw Error('Invalid background colour');let filter='';for(let i=0;i<outputArgs.length;i++){if(['-vf','-filter:v'].includes(outputArgs[i])){filter=outputArgs[i+1]||'';outputArgs.splice(i,2);i--;}}
   // Derive the solid background from the input so size, timestamps and frame rate match exactly.
   args.push('-filter_complex','[0:v]split[bg0][fg];[bg0]format=rgba,drawbox=c='+p.flatten+':t=fill:replace=1[bg];[bg][fg]overlay=shortest=1,format=yuv420p'+(filter?','+filter:'')+'[v]','-map','[v]');}args.push('-frames:v',String(r.seqCount));}
  args.push(...outputArgs,'-n',temp);const token=this.start(executable,args,{outputPath:output,temp});return {token,outputPath:output};
 }
 start(executable,args,options={}){
  const token=crypto.randomUUID(),op={...options,done:false,cancelled:false,exitCode:null,log:'',raw:'',progress:{},size:0,outputPath:options.outputPath||'',partial:''};this.operations.set(token,op);
  const child=spawn(executable,args,{shell:false,windowsHide:true,cwd:this.storage.data,stdio:['ignore','pipe','pipe']});op.child=child;
  this.storage.log('Media process started: '+executable+'; pid='+child.pid);
  child.once('close',(code,signal)=>this.storage.log('Media process ended: pid='+child.pid+'; code='+code+'; signal='+signal));
  const finish=code=>{if(op.done)return;clearTimeout(op.timeout);op.exitCode=code??-1;try{if(!op.isProbe&&!op.cancelled&&code===0){try{fs.linkSync(op.temp,op.outputPath);}catch(e){if(e.code==='EEXIST')throw e;fs.copyFileSync(op.temp,op.outputPath,fs.constants.COPYFILE_EXCL);}} }catch(e){op.exitCode=-1;op.log+='\n'+e.message;}finally{if(op.temp){try{fs.unlinkSync(op.temp);}catch{}}op.done=true;}};
  child.on('error',e=>{op.log=e.message;finish(-1);});child.on('close',finish);
  child.stdout.on('data',chunk=>{if(op.isProbe){op.raw+=chunk;if(op.raw.length>20_000_000){op.log+='Inspection output too large';child.kill();}return;}op.partial+=chunk;const lines=op.partial.split(/\r?\n/);op.partial=lines.pop();for(const line of lines){const i=line.indexOf('=');if(i>0)op.progress[line.slice(0,i)]=line.slice(i+1);}});
  child.stderr.on('data',chunk=>{op.log=(op.log+chunk).slice(-500000);});
  if(op.isProbe)op.timeout=setTimeout(()=>{op.log+='\nInspection timed out';child.kill();},30000);
  return token;
 }
 poll(token){const op=this.operations.get(token);if(!op)throw Error('This conversion is no longer available.');try{op.size=fs.statSync(op.temp&&fs.existsSync(op.temp)?op.temp:op.outputPath).size;}catch{}return {done:op.done,cancelled:op.cancelled,exitCode:op.exitCode,log:op.log,raw:op.raw,progress:op.progress,size:op.size,outputPath:op.outputPath};}
 cancel(token){const op=this.operations.get(token);if(op&&!op.done){op.cancelled=true;op.child.kill('SIGKILL');}return true;}
 forget(token){if(this.operations.get(token)?.done)this.operations.delete(token);return true;}
 async close(){for(const [token]of this.operations)this.cancel(token);await Promise.all([...this.operations.values()].filter(o=>!o.done).map(o=>new Promise(resolve=>{o.child.once('close',resolve);setTimeout(resolve,3000);})));}
}
module.exports={Media,splitArgs,readable};
