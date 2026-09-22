function nativeCall(action, args) {
  var response = JSON.parse(chrome.webview.hostObjects.sync.native.Call(action, JSON.stringify(args || {})));
  if (!response.ok) throw new Error(response.error || 'The operation failed.');
  return response.value;
}
function nativeMessage(type, args) {
  chrome.webview.postMessage(Object.assign({type:type}, args || {}));
}
var nativeInfo = nativeCall('info');
// Small data adapter for the retained preset, media-inspection and queue views.
// All process control and persistence live in the compiled application.
var fso = {
  FileExists: function(path) { return nativeCall('exists', {path:path}); },
  FolderExists: function(path) { return nativeCall('directoryExists', {path:path}); },
  GetAbsolutePathName: function(path) { return nativeCall('absolutePath', {path:path}); },
  GetFile: function(path) { return nativeCall('fileInfo', {path:path}); },
  GetFileName: function(path) { return path.replace(/\\/g, '/').split('/').pop(); },
  GetParentFolderName: function(path) { return path.substring(0,Math.max(path.lastIndexOf('\\'),path.lastIndexOf('/'))); },
  GetFolder: function(path) { return {Files:nativeCall('listFiles', {path:path})}; }
};
function Enumerator(items) {
  var index = 0;
  this.atEnd = function() { return index >= items.length; };
  this.moveNext = function() { index++; };
  this.item = function() { return items[index]; };
}
function showNotice(message) {
  var element = document.getElementById('native-notice');
  if (!element) {
    element = document.createElement('div');
    element.id = 'native-notice';
    element.style.cssText = 'position:fixed;bottom:58px;right:20px;max-width:580px;padding:14px 40px 14px 16px;background:#33291d;color:#ffe7bd;border:1px solid #ad8141;border-radius:8px;z-index:99999;font:13px Segoe UI;white-space:pre-wrap;box-shadow:0 8px 25px #0008;cursor:pointer';
    element.title = 'Click to dismiss';
    element.addEventListener('click', function() { element.style.display='none'; });
    document.body.appendChild(element);
  }
  element.textContent = message + '  ×';
  element.style.display='block';
}
window.addEventListener('error', function(e) {
  nativeMessage('error', {error: e.message + ' (' + e.filename + ':' + e.lineno + ')'});
  showNotice('The interface encountered an error: ' + e.message);
});
window.addEventListener('unhandledrejection', function(e) {
  var message = String(e.reason && e.reason.message || e.reason);
  nativeMessage('error', {error:message});
  showNotice(message);
});
chrome.webview.addEventListener('message', function(e) {
  var message = e.data;
  if (message.type === 'files') {
    if(message.target){if(window.simpleMode)window.simpleMode.receive(message);return;}
    var added=0;
    message.paths.forEach(function(path) { if (addInputFile(path)) added++; });
    renderJobs(); updateRunButton(); renderPresets();
    if (message.errors && message.errors.length) showNotice(message.errors.join('\n\n'));
    if (added) {
      var notice=document.getElementById('native-notice');
      if (notice && !message.errors.length) notice.style.display='none';
    }
  } else if (message.type === 'outputFolder') {
    outputFolder=message.path;
    document.getElementById('out-path').textContent=outputFolder;
    document.getElementById('btn-resetout').style.display='';
  } else if (message.type === 'notice') showNotice(message.error);
});
