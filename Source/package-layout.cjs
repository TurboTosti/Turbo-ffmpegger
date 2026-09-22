const fs=require('node:fs'),path=require('node:path');
const common=['chrome_100_percent.pak','chrome_200_percent.pak','icudtl.dat','resources.pak','snapshot_blob.bin','v8_context_snapshot.bin','vk_swiftshader_icd.json'];
const platformFiles={win32:['electron.exe','d3dcompiler_47.dll','dxcompiler.dll','dxil.dll','ffmpeg.dll','vk_swiftshader.dll','vulkan-1.dll'],linux:['electron','chrome_crashpad_handler','chrome-sandbox','libffmpeg.so','libvk_swiftshader.so','libvulkan.so.1']};
const languages=['en-US.pak','en-GB.pak','nl.pak','ja.pak','zh-CN.pak','ko.pak'];
const omittedAppFiles=new Set(['icon.ico','vendor/JSNES-LICENSE.txt','vendor/fflate-LICENSE.txt']);
function executableName(platform){return platform==='win32'?'Turbo ffmpegger.exe':'turbo-ffmpegger';}
function runtimeFiles(platform){return [...common,...platformFiles[platform]];}
function includedAppFile(relative){return !omittedAppFiles.has(relative.replaceAll('\\','/'));}
function copyRuntime(source,destination,platform){
 fs.mkdirSync(destination,{recursive:true});for(const name of runtimeFiles(platform))fs.copyFileSync(path.join(source,name),path.join(destination,name));
 fs.mkdirSync(path.join(destination,'locales'),{recursive:true});for(const name of languages)fs.copyFileSync(path.join(source,'locales',name),path.join(destination,'locales',name));
 const old=path.join(destination,platform==='win32'?'electron.exe':'electron');fs.renameSync(old,path.join(destination,executableName(platform)));
}
function audit(source,platform){return {runtimeDirectory:'App',kept:runtimeFiles(platform),locales:languages,relocated:{LICENSE:'Licenses/Electron-LICENSE.txt','LICENSES.chromium.html':'Licenses/Chromium-LICENSES.html',version:'Help/Runtime-version.txt'},omitted:{'resources/default_app.asar':'Electron demonstration app; our application replaces it','other locale packs':'Only supported interface language locales are distributed','app/icon.ico':'Build input only; original icon is embedded in both Windows executables','app/vendor/*-LICENSE.txt':'Identical license texts are consolidated in Licenses'},excludedRuntimeDirectories:fs.readdirSync(source,{withFileTypes:true}).filter(e=>e.isDirectory()&&!['locales','resources'].includes(e.name)).map(e=>e.name),retainedRootFile:'desktop-release.json is required for compatibility with the installed 2.0.0–2.0.2 updater',compatibilityMetadata:'resources/app/package.json lets existing updaters validate the version; actual code is under App/resources/app',reason:'Chromium resources, ICU data, snapshots, graphics/media libraries, sandbox and crash helpers remain together. Different graphics hardware can need the fallback drivers.'};}
module.exports={runtimeFiles,copyRuntime,includedAppFile,omittedAppFiles,languages,executableName,audit};
