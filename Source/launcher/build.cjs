const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const base=__dirname,tool=process.env.TURBO_ZIG||path.join(base,'toolchain/zig-x86_64-windows-0.15.2/zig.exe'),out=path.join(base,'bin');
fs.mkdirSync(out,{recursive:true});
const env={...process.env,TEMP:path.join(base,'temp'),TMP:path.join(base,'temp'),ZIG_GLOBAL_CACHE_DIR:path.join(base,'cache'),ZIG_LOCAL_CACHE_DIR:path.join(base,'cache-local')};fs.mkdirSync(env.TEMP,{recursive:true});
function run(args){const r=spawnSync(tool,args,{cwd:base,env,windowsHide:true,stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw Error('Launcher compiler failed: '+r.status);}
const version=require('../app/package.json').version;
const {parseVersion,displayVersion}=require('../app/core/version.cjs'),parsed=parseVersion(version);
if(!parsed||parsed.canonical!==version||parsed.numbers.some(n=>n>65535))throw Error('Invalid Windows resource version');
const numeric=parsed.numbers.join(',')+',0',label=displayVersion(version);
fs.writeFileSync(path.join(base,'launcher.rc'),'1 ICON "../app/icon.ico"\n1 24 "launcher.manifest"\n1 VERSIONINFO\nFILEVERSION '+numeric+'\nPRODUCTVERSION '+numeric+'\nFILEFLAGSMASK 0x3fL\nFILEFLAGS '+(parsed.channel?'0x2L':'0x0L')+'\nFILEOS 0x40004\nFILETYPE 0x1\nBEGIN\n BLOCK "StringFileInfo"\n BEGIN\n  BLOCK "040904b0"\n  BEGIN\n   VALUE "FileDescription", "Turbo ffmpegger"\n   VALUE "ProductName", "Turbo ffmpegger"\n   VALUE "FileVersion", "'+label+'"\n   VALUE "ProductVersion", "'+label+'"\n  END\n END\n BLOCK "VarFileInfo"\n BEGIN\n  VALUE "Translation", 0x409, 1200\n END\nEND\n');
run(['rc','/fo','bin/launcher.res','launcher.rc']);
run(['cc','-target','x86_64-windows-gnu','-isystem',path.join(path.dirname(tool),'lib/libc/include/any-windows-any'),'-Os','-fno-builtin','-fno-stack-protector','-nostdlib','-Wl,--entry=mainCRTStartup','-Wl,--subsystem,windows','-s','windows.c','bin/launcher.res','-lkernel32','-luser32','-o','bin/Turbo ffmpegger.exe']);
run(['cc','-target','x86_64-linux-musl','-static','-Os','-s','linux.c','-o','bin/turbo-ffmpegger']);
const hash=file=>require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.writeFileSync(path.join(out,'build.json'),JSON.stringify({version,compiler:'Zig 0.15.2',windowsSha256:hash(path.join(out,'Turbo ffmpegger.exe')),linuxSha256:hash(path.join(out,'turbo-ffmpegger'))},null,2));
console.log(JSON.stringify({version,windowsBytes:fs.statSync(path.join(out,'Turbo ffmpegger.exe')).size,linuxBytes:fs.statSync(path.join(out,'turbo-ffmpegger')).size}));
