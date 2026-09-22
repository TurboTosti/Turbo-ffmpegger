const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{zipDirectory,walk}=require('./package.cjs');
const base=__dirname,version=require('./app/package.json').version,folder=process.argv[3]?path.resolve(process.argv[3]):path.resolve(base,'source-staging','Turbo-ffmpegger-'+version+'-Source');
const output=path.resolve(process.argv[2]||path.join(base,'dist'));
fs.mkdirSync(folder,{recursive:true});
for(const name of ['app','seed-data','licenses','docs'])fs.cpSync(path.join(base,name),path.join(folder,name),{recursive:true});
fs.mkdirSync(path.join(folder,'previews'),{recursive:true});
for(const name of ['render-aurora.cjs','aurora-render-results.json','ui-checks.json','aurora-dark.png','aurora-light.png','aurora-wide.png','aurora-comparison.png'])fs.copyFileSync(path.join(base,'previews',name),path.join(folder,'previews',name));
for(const name of ['render-backgrounds.cjs','backgrounds-render-results.json','backgrounds-dark.png','backgrounds-light.png','backgrounds-wide.png','backgrounds-comparison.png','background-futuristic-meteor.png'])fs.copyFileSync(path.join(base,'previews',name),path.join(folder,'previews',name));
for(const name of ['package.cjs','package-layout.cjs','package-source.cjs','package-github.cjs','icon.cjs','prepare-release.cjs','queue-verification.json','START HERE.txt','Verification.json','RELEASE-NOTES.md'])fs.copyFileSync(path.join(base,name),path.join(folder,name));
fs.mkdirSync(path.join(folder,'launcher','bin'),{recursive:true});
for(const name of ['windows.c','linux.c','build.cjs','launcher.manifest','TOOLCHAIN.json'])fs.copyFileSync(path.join(base,'launcher',name),path.join(folder,'launcher',name));
for(const name of ['Turbo ffmpegger.exe','turbo-ffmpegger','build.json'])fs.copyFileSync(path.join(base,'launcher','bin',name),path.join(folder,'launcher','bin',name));
fs.copyFileSync(path.join(base,'docs','Building.md'),path.join(folder,'README.md'));
const githubReadme=path.join(base,'README-GITHUB.md');if(fs.existsSync(githubReadme))fs.copyFileSync(githubReadme,path.join(folder,'README-GITHUB.md'));
fs.writeFileSync(path.join(folder,'verify-queue.mjs'),fs.readFileSync(path.join(base,'verify-queue.mjs'),'utf8').replace("'../acorn.mjs'","'acorn'"));
fs.mkdirSync(path.join(folder,'tests'),{recursive:true});for(const name of fs.readdirSync(path.join(base,'tests')).filter(n=>n.endsWith('.cjs')||n.endsWith('-results.json'))){const from=path.join(base,'tests',name),to=path.join(folder,'tests',name);if(name.endsWith('.cjs'))fs.writeFileSync(to,fs.readFileSync(from,'utf8').replaceAll("'../../acorn.mjs'","'acorn'"));else fs.copyFileSync(from,to);}
const localGameSource=path.join(base,'game-source'),gameSource=fs.existsSync(localGameSource)?localGameSource:path.resolve(base,'../../../../2026-09-08/the-x20/outputs/Voidbreaker-R49-source');fs.cpSync(gameSource,path.join(folder,'game-source'),{recursive:true});
fs.mkdirSync(path.join(folder,'validation'),{recursive:true});for(const suffix of ['Package-checks.json','Layout-checks.json','Runtime-checks.json','Executable-checks.json','Version-checks.json','packages.json']){const name='Turbo-ffmpegger-'+version+'-'+suffix,file=path.join(output,name);if(fs.existsSync(file))fs.copyFileSync(file,path.join(folder,'validation',name));}
const inventory=walk(folder).filter(p=>p!=='SOURCE-MANIFEST.json').map(p=>({path:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(folder,p))).digest('hex')}));
if(inventory.some(p=>/^(?:ffmpeg|ffprobe)(?:\.exe)?$/i.test(path.basename(p.path))))throw Error('Conversion programs must not be included in source exports');
fs.writeFileSync(path.join(folder,'SOURCE-MANIFEST.json'),JSON.stringify({version,files:inventory},null,2));
fs.mkdirSync(output,{recursive:true});const archive=path.join(output,'Turbo-ffmpegger-'+version+'-Source.zip');zipDirectory(folder,archive,'source');console.log(JSON.stringify({archive,bytes:fs.statSync(archive).size}));
