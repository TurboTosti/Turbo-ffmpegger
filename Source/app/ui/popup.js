// Native dialogs keep focus inside the popup. Explicit CSS centering avoids the
// legacy universal margin reset, while short animations echo the existing modals.
var desktopPopup=(()=>{
 const transitions=new WeakMap();
 const reduceMotion=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function cancel(dialog){const animation=transitions.get(dialog);transitions.delete(dialog);animation?.cancel();}
 function open(dialog){
  cancel(dialog);dialog.inert=false;
  if(!dialog.open)dialog.showModal();
  if(!reduceMotion()){
   const animation=dialog.animate([{opacity:0,transform:'scale(.94)'},{opacity:1,transform:'scale(1)'}],{duration:220,easing:'cubic-bezier(.34,1.56,.64,1)'});
   transitions.set(dialog,animation);
   animation.finished.catch(()=>{}).then(()=>{if(transitions.get(dialog)===animation)transitions.delete(dialog);});
  }
 }
 function close(dialog,done){
  cancel(dialog);
  const finish=()=>{dialog.close();dialog.inert=false;if(done)done();};
  if(!dialog.open||reduceMotion()){finish();return;}
  dialog.inert=true;
  const animation=dialog.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.97)'}],{duration:130,easing:'ease-in'});
  transitions.set(dialog,animation);
  animation.finished.catch(()=>{}).then(()=>{if(transitions.get(dialog)!==animation)return;transitions.delete(dialog);finish();});
 }
 return {open,close};
})();
