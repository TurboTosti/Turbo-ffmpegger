const {app,BrowserWindow,ipcMain,dialog,shell,protocol,net,session,screen}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {Storage,readJSON}=require('./core/storage.cjs');const {Media,readable}=require('./core/media.cjs');const {Updates,PAGE}=require('./core/updates.cjs');
const {displayVersion,shouldResumeUpdate}=require('./core/version.cjs');
const version=require('./package.json').version;
const rootArg=process.argv.find(a=>a.startsWith('--portable-root='));const root=require('./core/layout.cjs').portableRoot(process.execPath,rootArg?rootArg.slice(16):null);
const resources=__dirname,tools=require('./core/layout.cjs').mediaTools(root);let storage,media,updates,win,sync,closing=false,finishing=false,closeTimer;
protocol.registerSchemesAsPrivileged([{scheme:'turbo',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
// Chromium caches are portable too. No application profile is required elsewhere.
try{const profile=path.join(root,'Data','Runtime',process.platform),crashes=path.join(profile,'Crashes'),logs=path.join(root,'Data','Logs');fs.mkdirSync(crashes,{recursive:true});fs.mkdirSync(logs,{recursive:true});app.setPath('userData',profile);app.setPath('sessionData',profile);app.setPath('crashDumps',crashes);app.setAppLogsPath(logs);}catch(e){dialog.showErrorBox('Turbo ffmpegger','This portable folder is not writable. Move the whole application to a folder you can write to.\n\n'+e.message);app.exit(1);}
app.setName('Turbo ffmpegger');
const primary=app.requestSingleInstanceLock();
if(!primary)app.quit();
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
function startVersion(folder){const exe=path.join(folder,process.platform==='win32'?'Turbo ffmpegger.exe':'turbo-ffmpegger');fs.accessSync(exe,fs.constants.R_OK|(process.platform==='win32'?0:fs.constants.X_OK));app.relaunch({execPath:exe,args:['--portable-root='+root]});}
function send(message){if(win&&!win.isDestroyed())win.webContents.send('native-message',message);}
const allowedSender=e=>e.sender===win?.webContents&&e.senderFrame?.url.startsWith('turbo://app/');
function sendFiles(paths,target){const valid=[],errors=[];for(const file of new Set(paths)){try{readable(file);valid.push(file);}catch(e){errors.push(e.message);}}if(!valid.length&&!errors.length)errors.push('Drop an existing local file, or use Browse files.');send({type:'files',paths:valid,errors,target});}
ipcMain.on('call',(event,{action,args})=>{if(!allowedSender(event)){event.returnValue={ok:false,error:'Blocked origin'};return;}try{event.returnValue={ok:true,value:sync(action,args)};}catch(e){storage?.log(action+': '+e.message);event.returnValue={ok:false,error:e.message};}});
ipcMain.on('message',async(event,m)=>{if(!allowedSender(event))return;try{switch(m.type){
 case 'ready':break;
 case 'gameDiagnostic':storage.log('Voidbreaker: '+String(m.event||'').replace(/[\r\n]/g,' ').slice(0,500));break;
 case 'files':sendFiles(m.paths,m.target);break;
 case 'browse':{const r=await dialog.showOpenDialog(win,{title:'Add media files',properties:m.target?['openFile']:['openFile','multiSelections']});if(!r.canceled)sendFiles(r.filePaths,m.target);break;}
 case 'outputFolder':{const r=await dialog.showOpenDialog(win,{title:'Choose output folder',properties:['openDirectory','createDirectory']});if(!r.canceled)send({type:'outputFolder',path:r.filePaths[0]});break;}
 case 'reveal':if(fs.existsSync(m.path))shell.showItemInFolder(m.path);break;
 case 'editPresets':await shell.openPath(storage.file('presets.json'));break;case 'openData':await shell.openPath(storage.data);break;
 case 'importLegacy':{const r=await dialog.showOpenDialog(win,{title:'Select your previous Turbo ffmpegger settings folder',properties:['openDirectory']});if(!r.canceled){await storage.flush();storage.importLegacy(r.filePaths[0]);send({type:'imported'});}break;}
 case 'checkUpdates':try{const release=await updates.check();send({type:'update',state:release?'available':'noPackage',version:release?displayVersion(release.version):undefined});}catch(e){send({type:'update',state:'error',error:e.message});}break;
 case 'downloadUpdate':try{if(media.busy)throw Error('Finish or stop conversion first');await updates.download();send({type:'update',state:'ready',version:displayVersion(updates.available.version)});}catch(e){send({type:'update',state:'error',error:e.message});}break;
 case 'activateUpdate':if(media.busy)throw Error('Finish or stop conversion first');win.updateFolder=updates.prepared;win.close();break;
 case 'viewReleases':await shell.openExternal(PAGE);break;
 case 'resize':if(!win.isMaximized()){const bounds=screen.getDisplayMatching(win.getBounds()).workArea;win.setSize(Math.min(bounds.width,Math.round(980*m.scale+20)),Math.min(bounds.height,Math.round(700*m.scale+48)));}break;
 case 'error':storage.log(m.error);break;
 case 'closeReady':if(!closeTimer||finishing)break;clearTimeout(closeTimer);closeTimer=null;await finishClose();break;
 }}catch(e){storage.log(e.stack||e.message);send({type:'notice',error:e.message});}});
async function finishClose(){if(finishing)return;finishing=true;try{await storage.flush();await media.close();if(win.updateFolder){await startVersion(win.updateFolder);updates.activate();}closing=true;win.destroy();app.quit();}finally{finishing=false;}}
app.whenReady().then(async()=>{if(!primary)return;try{
 storage=new Storage(root,resources,{onSaveError:()=>send({type:'notice',error:'Your latest settings could not be saved yet because the Data folder is locked or not writable. Your previous saved settings are safe. The app will try again when you change a setting or close it.'}),legacyRoot:process.platform==='win32'&&process.env.LOCALAPPDATA?path.join(process.env.LOCALAPPDATA,'Turbo ffmpegger'):null});
 storage.log('Application '+version+' started; pid='+process.pid+'; executable='+process.execPath);
 const activeFile=path.join(storage.data,'active-version.json');if(fs.existsSync(activeFile)){try{const active=readJSON(activeFile);const target=path.resolve(root,active.folder);if(shouldResumeUpdate(active,version,process.platform)&&target.startsWith(path.join(root,'Versions')+path.sep)){await startVersion(target);app.quit();return;}}catch(e){storage.log('Update launch: '+e.message);}}
 media=new Media(storage,tools);updates=new Updates(storage,version);sync=require('./core/native.cjs')(storage,media,version,tools);
 protocol.handle('turbo',request=>{const url=new URL(request.url);if(url.hostname!=='app')return new Response('Blocked',{status:403});const relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);const file=path.resolve(resources,'ui','.'+relative);const ui=path.join(resources,'ui');if(!file.startsWith(ui+path.sep)||!fs.existsSync(file))return new Response('Missing resource',{status:404});return net.fetch(pathToFileURL(file).toString());});
 session.defaultSession.setPermissionRequestHandler((_wc,_permission,cb)=>cb(false));session.defaultSession.setPermissionCheckHandler(()=>false);
 win=new BrowserWindow({title:'Turbo ffmpegger',icon:path.join(resources,'icon.png'),width:1120,height:780,minWidth:780,minHeight:540,backgroundColor:'#111216',autoHideMenuBar:true,show:false,webPreferences:{preload:path.join(resources,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,spellcheck:false,backgroundThrottling:true}});
 win.webContents.on('render-process-gone',(_e,details)=>storage.log('Renderer exited: '+JSON.stringify(details)));
 app.on('child-process-gone',(_e,details)=>storage.log('Runtime child exited: '+JSON.stringify(details)));
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,url)=>{if(url!=='turbo://app/index.html')e.preventDefault();});win.webContents.session.on('will-download',e=>e.preventDefault());
 win.once('ready-to-show',()=>win.show());win.on('blur',()=>send({type:'gameBlur'}));
 win.on('close',async e=>{if(closing)return;e.preventDefault();if(closeTimer||finishing)return;if(media.busy){const r=await dialog.showMessageBox(win,{type:'question',buttons:['Keep open','Stop conversion and close'],defaultId:0,cancelId:0,message:'A conversion is running.'});if(r.response===0)return;}send({type:'prepareClose'});closeTimer=setTimeout(()=>{closeTimer=null;dialog.showMessageBox(win,{type:'error',message:'The game save did not finish. Please pause the game and try closing again.'});},10000);});
 await win.loadURL('turbo://app/index.html');
 }catch(e){dialog.showErrorBox('Turbo ffmpegger',e.message);app.quit();}});
app.on('window-all-closed',()=>app.quit());
