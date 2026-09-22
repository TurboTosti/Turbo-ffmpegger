const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Zip,ZipDeflate}=require('./app/vendor/fflate.cjs');
const layout=require('./package-layout.cjs');
const base=__dirname,output=path.resolve(process.argv[2]||path.join(base,'dist'));
const version=require('./app/package.json').version;
function walk(folder,prefix=''){return fs.readdirSync(folder,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(folder,e.name),prefix+e.name+'/'):[prefix+e.name]);}
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function executable(p,platform){return platform==='linux'&&['turbo-ffmpegger','App/turbo-ffmpegger','App/chrome-sandbox','App/chrome_crashpad_handler','Help/Start.sh','App/resources/tools/ffmpeg','App/resources/tools/ffprobe'].includes(p);}
function zipDirectory(folder,file,platform,prefix=path.basename(folder)+'/'){const fd=fs.openSync(file,'w');try{const zip=new Zip((error,chunk)=>{if(error)throw error;fs.writeSync(fd,chunk);});for(const name of walk(folder)){const entry=new ZipDeflate(prefix+name,{level:name.endsWith('.zip')?0:6});entry.os=3;entry.attrs=((executable(name,platform)?0o100755:0o100644)<<16)>>>0;zip.add(entry);const input=fs.openSync(path.join(folder,name),'r'),buffer=Buffer.alloc(1024*1024);try{let n;while((n=fs.readSync(input,buffer,0,buffer.length,null))>0)entry.push(Uint8Array.from(buffer.subarray(0,n)),false);entry.push(new Uint8Array(0),true);}finally{fs.closeSync(input);}}zip.end();}finally{fs.closeSync(fd);}}
function build(){fs.mkdirSync(output,{recursive:true});
const launchers=JSON.parse(fs.readFileSync(path.join(base,'launcher/bin/build.json')));if(launchers.version!==version)throw Error('Rebuild the native launchers for version '+version);
for(const [name,expected]of [['Turbo ffmpegger.exe',launchers.windowsSha256],['turbo-ffmpegger',launchers.linuxSha256]])if(sha(path.join(base,'launcher/bin',name))!==expected)throw Error('Launcher checksum mismatch: '+name);
for(const label of ['Windows','Linux'])for(const target of ['Turbo ffmpegger '+version+' '+label+' x64','Turbo-ffmpegger-'+version+'-'+label+'-x64.zip'])if(fs.existsSync(path.join(output,target)))throw Error('Refusing to overwrite existing release: '+target);
const built=[];
for(const [platform,label,runtime]of [['win32','Windows','windows'],['linux','Linux','linux']]){
 const name='Turbo ffmpegger '+version+' '+label+' x64',folder=path.join(output,name),runtimePath=path.join(base,'runtime',runtime);
 if(fs.existsSync(folder))throw Error('Refusing to overwrite an existing release folder: '+folder);
 const runtimeFolder=path.join(folder,'App'),appSource=path.join(base,'app'),executableName=layout.executableName(platform);
 fs.mkdirSync(folder,{recursive:true});layout.copyRuntime(runtimePath,runtimeFolder,platform);
 fs.cpSync(appSource,path.join(runtimeFolder,'resources','app'),{recursive:true,filter:source=>layout.includedAppFile(path.relative(appSource,source))});
 if(platform==='win32')require('./icon.cjs').patch(path.join(runtimeFolder,executableName),path.join(appSource,'icon.ico'));
 fs.copyFileSync(path.join(base,'launcher','bin',executableName),path.join(folder,executableName));
 fs.mkdirSync(path.join(folder,'resources','app'),{recursive:true});fs.writeFileSync(path.join(folder,'resources','app','package.json'),JSON.stringify({name:'turbo-ffmpegger',version,runtimeDirectory:'App'},null,2));
 fs.mkdirSync(path.join(runtimeFolder,'resources','tools'),{recursive:true});fs.copyFileSync(path.join(base,'docs','ADD-FFMPEG-HERE.txt'),path.join(runtimeFolder,'resources','tools','ADD-FFMPEG-HERE.txt'));
 fs.mkdirSync(path.join(folder,'Data'),{recursive:true});for(const name of ['presets.json','custom_presets.json','settings.json']){const target=path.join(folder,'Data',name);if(!fs.existsSync(target))fs.copyFileSync(path.join(base,'seed-data',name),target);}
 fs.cpSync(path.join(base,'licenses'),path.join(folder,'Licenses'),{recursive:true});
 fs.copyFileSync(path.join(runtimePath,'LICENSE'),path.join(folder,'Licenses','Electron-LICENSE.txt'));fs.copyFileSync(path.join(runtimePath,'LICENSES.chromium.html'),path.join(folder,'Licenses','Chromium-LICENSES.html'));
 fs.mkdirSync(path.join(folder,'Help'),{recursive:true});fs.copyFileSync(path.join(base,'START HERE.txt'),path.join(folder,'Help','START HERE.txt'));fs.copyFileSync(path.join(runtimePath,'version'),path.join(folder,'Help','Runtime-version.txt'));
 fs.copyFileSync(path.join(base,'docs','FFmpeg-setup.md'),path.join(folder,'Help','FFmpeg-setup.md'));
 fs.writeFileSync(path.join(folder,'Help','Package-contents.json'),JSON.stringify(layout.audit(runtimePath,platform),null,2));
 if(fs.existsSync(path.join(base,'Verification.json')))fs.copyFileSync(path.join(base,'Verification.json'),path.join(folder,'Help','Verification.json'));
 if(platform==='linux')fs.writeFileSync(path.join(folder,'Help','Start.sh'),'#!/bin/sh\nset -eu\nAPP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)\nchmod u+x "$APP_DIR/turbo-ffmpegger" "$APP_DIR/App/turbo-ffmpegger" "$APP_DIR/App/chrome_crashpad_handler" "$APP_DIR/App/chrome-sandbox"\nfor TOOL in ffmpeg ffprobe; do\n  if [ -f "$APP_DIR/App/resources/tools/$TOOL" ]; then chmod u+x "$APP_DIR/App/resources/tools/$TOOL"; fi\ndone\nexec "$APP_DIR/turbo-ffmpegger" "$@"\n');
 if(walk(folder).some(p=>/^(?:ffmpeg|ffprobe)(?:\.exe)?$/i.test(path.basename(p))))throw Error('Conversion programs must never be included in public packages');
 const manifest={schema:2,version,platform,arch:'x64',files:walk(folder).filter(p=>!p.startsWith('Data/')&&p!=='desktop-release.json').map(p=>({path:p,sha256:sha(path.join(folder,p)),executable:executable(p,platform)}))};
 fs.writeFileSync(path.join(folder,'desktop-release.json'),JSON.stringify(manifest,null,2));
 const archive=path.join(output,'Turbo-ffmpegger-'+version+'-'+label+'-x64.zip');console.log('Compressing '+label+' package');zipDirectory(folder,archive,platform);built.push({platform,folder,archive,bytes:fs.statSync(archive).size,sha256:sha(archive),files:manifest.files.length});console.log('Built '+label+' '+Math.round(fs.statSync(archive).size/1048576)+' MiB');
}
fs.writeFileSync(path.join(output,'Turbo-ffmpegger-'+version+'-packages.json'),JSON.stringify(built.map(({platform,archive,bytes,sha256,files})=>({platform,file:path.basename(archive),bytes,sha256,files})),null,2));
}
if(require.main===module)build();
module.exports={zipDirectory,walk,build};
