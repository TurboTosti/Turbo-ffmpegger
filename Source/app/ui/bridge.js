// Keep the retained interface behind a small, isolated Electron bridge.
const nativeListeners=[];
window.chrome=window.chrome||{};
chrome.webview={hostObjects:{sync:{native:{Call:(action,json)=>JSON.stringify(window.turbo.call(action,JSON.parse(json)))}}},
 postMessage:message=>window.turbo.message(message),
 postMessageWithAdditionalObjects:(message,files)=>window.turbo.drop(Array.from(files),message.target),
 addEventListener:(type,callback)=>{if(type==='message')nativeListeners.push(callback);}};
window.turbo.onMessage(message=>{nativeListeners.forEach(fn=>fn({data:message}));if(message.type==='imported'){loadSettings();loadPresets();applyLanguage();showNotice('Previous templates and settings imported. They are now in the portable Data folder.');}});
