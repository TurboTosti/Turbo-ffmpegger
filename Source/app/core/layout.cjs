const path=require('node:path');
// Runtime moved one level down; Data remains beside the launcher. An update
// explicitly passes the original portable root so it does not create new Data.
function portableRoot(executable,override){if(override)return path.resolve(override);const folder=path.dirname(executable);return path.basename(folder)==='App'?path.dirname(folder):folder;}
// User-supplied conversion tools live in the original portable folder, even
// when the active application has been staged under Versions by the updater.
function mediaTools(root){return path.join(root,'App','resources','tools');}
module.exports={portableRoot,mediaTools};
