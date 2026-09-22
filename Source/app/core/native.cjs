const fs=require('node:fs'),path=require('node:path');const {readable}=require('./media.cjs');
const {displayVersion}=require('./version.cjs');
module.exports=function createNative(storage,media,version,tools){return function sync(action,a={}){switch(action){
 case 'info':return {version,displayVersion:displayVersion(version),dataFolder:storage.data,toolsFolder:tools,separator:path.sep,platform:process.platform};
 case 'load':return storage.load(a.name);case 'save':return storage.save(a.name,a.text);
 case 'exists':return fs.existsSync(a.path)&&fs.statSync(a.path).isFile();case 'directoryExists':return fs.existsSync(a.path)&&fs.statSync(a.path).isDirectory();case 'absolutePath':return path.resolve(a.path);
 case 'fileInfo':return {Name:path.basename(a.path),Path:a.path,Size:fs.statSync(a.path).size};case 'listFiles':return fs.readdirSync(a.path,{withFileTypes:true}).filter(e=>e.isFile()).map(e=>({Name:e.name,Path:path.join(a.path,e.name)}));
 case 'validateInput':readable(a.path);return true;case 'probe':return media.probe(a.path);case 'convert':return media.convert(a);case 'poll':return media.poll(a.token);case 'cancel':return media.cancel(a.token);case 'forget':return media.forget(a.token);
 case 'gameLoad':return storage.gameLoad();case 'gameSave':return storage.gameSave(a.value);case 'gameReset':return storage.gameReset();
 default:throw Error('Unknown operation');}};};
