const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {atomic,readJSON}=require('./storage.cjs');
const REPO='TurboTosti/Turbo-ffmpegger',PAGE='https://github.com/'+REPO+'/releases';
const {parseVersion,newer,VERSION_SCHEME}=require('./version.cjs');
function selectRelease(releases,current,platform=process.platform){
 const installed=parseVersion(current);if(!installed)return null;let result=null;
 for(const release of releases){
  const candidate=parseVersion(release.tag_name);
  if(!candidate||release.draft||!newer(candidate.canonical,current)||result&&!newer(candidate.canonical,result.version))continue;
  // Alpha/beta/RC users follow preview releases and eventual stable releases.
  // Stable users never enter a prerelease channel, even if GitHub's flag is off.
  if(!installed.channel&&(candidate.channel||release.prerelease))continue;
  if(release.prerelease&&!candidate.channel)continue;
  for(const asset of release.assets||[]){
   const name=String(asset.name||'').toLowerCase();if(!name.endsWith('.zip')||name.includes('source')||!name.includes('x64'))continue;
   if(platform==='win32'?!/(windows|win32|win-x64)/.test(name):!name.includes('linux'))continue;
   const prefix=PAGE+'/download/';if(typeof asset.browser_download_url!=='string'||!asset.browser_download_url.startsWith(prefix))continue;
   result={version:candidate.canonical,url:asset.browser_download_url,digest:asset.digest};break;
  }
 }
 return result;
}
function safeRelative(name){if(!name||name.includes('\\')||name.includes(':')||name.startsWith('/')||name.split('/').some(x=>!x||x==='.'||x==='..'||/[ .]$/.test(x)))throw Error('Unsafe update path');return name;}
function stage(archive,storage,release,platform=process.platform){
 const parsed=parseVersion(release.version);if(!parsed||parsed.canonical!==release.version)throw Error('Invalid update version');
 const {unzipSync}=require('../vendor/fflate.cjs');let size=0,count=0;
 const files=unzipSync(fs.readFileSync(archive),{filter(e){size+=e.originalSize;count++;if(size>2_000_000_000||count>10000)throw Error('Update archive exceeds limits');return !e.name.endsWith('/');}});
 const manifests=Object.keys(files).filter(n=>n.split('/').pop()==='desktop-release.json');if(manifests.length!==1)throw Error('A portable desktop manifest is required');
 const location=manifests[0],prefix=location.slice(0,-'desktop-release.json'.length),meta=JSON.parse(Buffer.from(files[location]).toString('utf8'));
 if(meta.schema!==2||meta.version!==release.version||meta.platform!==platform||meta.arch!=='x64')throw Error('This package does not match this portable application, platform or version.');
 const versions=path.resolve(storage.root,'Versions'),folder=path.resolve(versions,release.version+'-'+crypto.randomUUID());if(!folder.startsWith(versions+path.sep))throw Error('Invalid staging folder');fs.mkdirSync(folder,{recursive:true});
 try{const seen=new Set();for(const item of meta.files){const name=safeRelative(item.path);if(/^Data\//i.test(name))throw Error('Update packages cannot replace your portable data.');const key=platform==='win32'?name.toLowerCase():name;if(seen.has(key))throw Error('Duplicate update entry');seen.add(key);const data=files[prefix+name];if(!data||crypto.createHash('sha256').update(data).digest('hex')!==item.sha256)throw Error('Update checksum mismatch: '+name);const target=path.join(folder,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data);if(platform!=='win32')fs.chmodSync(target,item.executable?0o755:0o644);}
  const exe=platform==='win32'?'Turbo ffmpegger.exe':'turbo-ffmpegger';if(!fs.existsSync(path.join(folder,exe)))throw Error('Missing application executable');const app=readJSON(path.join(folder,'resources','app','package.json'));if(app.version!==release.version)throw Error('Application version mismatch');
  if(app.runtimeDirectory!==undefined){if(app.runtimeDirectory!=='App')throw Error('Unknown runtime layout');const actual=readJSON(path.join(folder,'App','resources','app','package.json'));if(actual.version!==release.version||!fs.existsSync(path.join(folder,'App',exe)))throw Error('Runtime version mismatch');}
  return folder;
 }catch(e){fs.rmSync(folder,{recursive:true,force:true});throw e;}
}
class Updates{
 constructor(storage,current){this.storage=storage;this.current=current;this.available=null;this.prepared=null;}
 async check(){const response=await fetch('https://api.github.com/repos/'+REPO+'/releases?per_page=100',{headers:{'User-Agent':'Turbo-ffmpegger/'+this.current},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Release check returned '+response.status);this.available=selectRelease(await response.json(),this.current);return this.available;}
 async download(){if(!this.available)throw Error('Check for updates first');const folder=path.join(this.storage.data,'Downloads');fs.mkdirSync(folder,{recursive:true});const file=path.join(folder,crypto.randomUUID()+'.zip');try{const response=await fetch(this.available.url,{signal:AbortSignal.timeout(600000)});if(!response.ok)throw Error('Download failed: '+response.status);let total=0;const hash=crypto.createHash('sha256'),out=fs.openSync(file,'wx');try{for await(const chunk of response.body){total+=chunk.length;if(total>1_500_000_000)throw Error('Update too large');hash.update(chunk);fs.writeSync(out,chunk);}}finally{fs.closeSync(out);}if(this.available.digest?.startsWith('sha256:')&&hash.digest('hex')!==this.available.digest.slice(7))throw Error('Download checksum mismatch');
  const {Worker}=require('node:worker_threads');this.prepared=await new Promise((resolve,reject)=>{const worker=new Worker(__filename,{workerData:{archive:file,root:this.storage.root,release:this.available}});worker.once('message',r=>r.error?reject(Error(r.error)):resolve(r.folder));worker.once('error',reject);});return this.prepared;
 }finally{if(fs.existsSync(file))fs.unlinkSync(file);}}
 activate(){if(!this.prepared)throw Error('Prepare the update first');atomic(path.join(this.storage.data,'active-version.json'),{version:this.available.version,versionScheme:VERSION_SCHEME,folder:path.relative(this.storage.root,this.prepared),platform:process.platform});return this.prepared;}
}
const {isMainThread,parentPort,workerData}=require('node:worker_threads');if(!isMainThread&&workerData?.archive){try{parentPort.postMessage({folder:stage(workerData.archive,{root:workerData.root},workerData.release)});}catch(e){parentPort.postMessage({error:e.message});}}
module.exports={Updates,stage,newer,selectRelease,safeRelative,PAGE};
