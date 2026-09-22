const {contextBridge,ipcRenderer,webUtils}=require('electron');
contextBridge.exposeInMainWorld('turbo',{
 call:(action,args)=>ipcRenderer.sendSync('call',{action,args:args||{}}),
 message:message=>ipcRenderer.send('message',message),
 drop:(files,target)=>ipcRenderer.send('message',{type:'files',target,paths:Array.from(files,f=>webUtils.getPathForFile(f)).filter(Boolean)}),
 onMessage:callback=>ipcRenderer.on('native-message',(_event,message)=>callback(message))
});
