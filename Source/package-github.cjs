// Assemble a repository-level ZIP; release archives stay ignored by Git.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {walk,zipDirectory}=require('./package.cjs'),version=require('./app/package.json').version;
const output=path.resolve(process.argv[2]||'dist'),source=path.resolve(process.argv[3]||'source-staging/Turbo-ffmpegger-'+version+'-Source');
const folder=path.join(output,'Repository'),archive=path.join(output,'Turbo-ffmpegger-'+version+'-GitHub-bundle.zip');
if(fs.existsSync(folder)||fs.existsSync(archive))throw Error('Refusing to overwrite an existing repository bundle');
fs.mkdirSync(folder,{recursive:true});
fs.copyFileSync(path.join(__dirname,'README-GITHUB.md'),path.join(folder,'README.md'));
fs.cpSync(source,path.join(folder,'Source'),{recursive:true});
fs.mkdirSync(path.join(folder,'Docs'));
for(const name of ['FFmpeg-setup.md','Publishing.md'])fs.copyFileSync(path.join(__dirname,'docs',name),path.join(folder,'Docs',name));
fs.copyFileSync(path.join(__dirname,'RELEASE-NOTES.md'),path.join(folder,'Docs','Release-notes.md'));
fs.copyFileSync(path.join(__dirname,'Verification.json'),path.join(folder,'Docs','Verification.json'));
const hashes=[];
for(const label of ['Windows','Linux']){
 const file='Turbo-ffmpegger-'+version+'-'+label+'-x64.zip';fs.mkdirSync(path.join(folder,label));fs.copyFileSync(path.join(output,file),path.join(folder,label,file));
 hashes.push(crypto.createHash('sha256').update(fs.readFileSync(path.join(folder,label,file))).digest('hex')+'  '+label+'/'+file);
}
fs.writeFileSync(path.join(folder,'Docs','SHA256SUMS.txt'),hashes.join('\n')+'\n');
fs.writeFileSync(path.join(folder,'.gitignore'),`# Upload these as GitHub Release attachments, not Git commits.
/Windows/*.zip
/Linux/*.zip

# User-supplied conversion programs: never commit these files.
[Ff][Ff][Mm][Pp][Ee][Gg]
[Ff][Ff][Pp][Rr][Oo][Bb][Ee]
[Ff][Ff][Mm][Pp][Ee][Gg].[Ee][Xx][Ee]
[Ff][Ff][Pp][Rr][Oo][Bb][Ee].[Ee][Xx][Ee]

# Local extractions, user data, dependencies and build outputs.
/Windows/*/
/Linux/*/
Data/
Versions/
node_modules/
Source/runtime/
Source/dist/
Source/source-staging/
Source/tools/
Source/package-inputs.json
Source/package-lock.json
Source/launcher/toolchain/
Source/launcher/cache*/
Source/launcher/temp/
Source/launcher/launcher.rc
Source/launcher/bin/*.res
Source/tests/*/
`);
const files=walk(folder);
if(files.some(p=>p.split('/').includes('.git')||/^(?:ffmpeg|ffprobe)(?:\.exe)?$/i.test(path.basename(p))))throw Error('Unexpected Git data or conversion program in repository bundle');
zipDirectory(folder,archive,'source','');
console.log(JSON.stringify({folder,archive,bytes:fs.statSync(archive).size,files:files.length}));
