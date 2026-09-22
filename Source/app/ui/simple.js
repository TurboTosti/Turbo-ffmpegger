// The overlay owns only its selection. Work runs in the ordinary conversion queue,
// so exiting the overlay leaves the original queue, progress and Stop controls intact.
var simpleStrings={
 en:{manage_templates:'Manage templates',simple_mode:'Simple mode',simple_drop:'Drop a video here',simple_choose:'or click to choose',simple_replace:'Drop another video or click to replace',simple_ready:'Ready',simple_checking:'Checking video…',simple_invalid:'This file could not be read as a video. Choose another video.',simple_one:'Please choose one video at a time.',simple_empty:'Drop an existing local video, or click to choose one.',simple_busy:'A conversion is running. Close Simple mode to view or stop it.',simple_converting:'Converting…',simple_done:'Saved beside the original:',simple_error:'Conversion failed. Close Simple mode to view the details, or try again.',simple_cancelled:'Conversion stopped. You can try again.',simple_update:'Finish the update before converting.',simple_no_template:'Select a template in the main window first.',simple_close:'Close Simple mode',simple_progress:'Conversion progress'},
 nl:{manage_templates:'Templates beheren',simple_mode:'Eenvoudige modus',simple_drop:'Sleep hier een video',simple_choose:'of klik om te kiezen',simple_replace:'Sleep een andere video of klik om te vervangen',simple_ready:'Klaar om te starten',simple_checking:'Video controleren…',simple_invalid:'Dit bestand kan niet als video worden gelezen. Kies een andere video.',simple_one:'Kies één video tegelijk.',simple_empty:'Sleep een bestaande video of klik om te kiezen.',simple_busy:'Er loopt een conversie. Sluit deze modus om die te bekijken of te stoppen.',simple_converting:'Converteren…',simple_done:'Naast het origineel opgeslagen:',simple_error:'Conversie mislukt. Sluit deze modus voor details of probeer opnieuw.',simple_cancelled:'Conversie gestopt. Je kunt opnieuw proberen.',simple_update:'Rond de update af voordat je converteert.',simple_no_template:'Selecteer eerst een template in het hoofdvenster.',simple_close:'Eenvoudige modus sluiten',simple_progress:'Conversievoortgang'},
 ja:{manage_templates:'テンプレート管理',simple_mode:'シンプルモード',simple_drop:'ここに動画をドロップ',simple_choose:'またはクリックして選択',simple_replace:'別の動画をドロップ、またはクリックして変更',simple_ready:'準備完了',simple_checking:'動画を確認中…',simple_invalid:'動画を読み込めません。別の動画を選択してください。',simple_one:'動画を1つずつ選択してください。',simple_empty:'ローカルの動画をドロップ、またはクリックして選択してください。',simple_busy:'変換中です。このモードを閉じると進行状況の確認や停止ができます。',simple_converting:'変換中…',simple_done:'元の動画と同じフォルダーに保存しました:',simple_error:'変換に失敗しました。このモードを閉じて詳細を確認するか、再試行してください。',simple_cancelled:'変換を停止しました。再試行できます。',simple_update:'更新が完了してから変換してください。',simple_no_template:'先にメイン画面でテンプレートを選択してください。',simple_close:'シンプルモードを閉じる',simple_progress:'変換の進行状況'},
 zh:{manage_templates:'管理模板',simple_mode:'简易模式',simple_drop:'将视频拖到这里',simple_choose:'或点击选择',simple_replace:'拖入其他视频或点击更换',simple_ready:'准备就绪',simple_checking:'正在检查视频…',simple_invalid:'无法读取此视频，请选择其他视频。',simple_one:'请一次选择一个视频。',simple_empty:'拖入本地视频或点击选择。',simple_busy:'正在转换。关闭简易模式可查看或停止转换。',simple_converting:'正在转换…',simple_done:'已保存在原视频旁:',simple_error:'转换失败。关闭简易模式查看详情或重试。',simple_cancelled:'转换已停止，可以重试。',simple_update:'请先完成更新。',simple_no_template:'请先在主窗口选择模板。',simple_close:'关闭简易模式',simple_progress:'转换进度'},
 ko:{manage_templates:'템플릿 관리',simple_mode:'간편 모드',simple_drop:'여기에 동영상을 놓으세요',simple_choose:'또는 클릭하여 선택',simple_replace:'다른 동영상을 놓거나 클릭하여 변경',simple_ready:'준비 완료',simple_checking:'동영상 확인 중…',simple_invalid:'동영상을 읽을 수 없습니다. 다른 동영상을 선택하세요.',simple_one:'동영상을 하나씩 선택하세요.',simple_empty:'로컬 동영상을 놓거나 클릭하여 선택하세요.',simple_busy:'변환 중입니다. 간편 모드를 닫으면 확인하거나 중지할 수 있습니다.',simple_converting:'변환 중…',simple_done:'원본 옆에 저장됨:',simple_error:'변환하지 못했습니다. 간편 모드를 닫아 자세한 내용을 확인하거나 다시 시도하세요.',simple_cancelled:'변환이 중지되었습니다. 다시 시도할 수 있습니다.',simple_update:'업데이트를 완료한 후 변환하세요.',simple_no_template:'먼저 기본 창에서 템플릿을 선택하세요.',simple_close:'간편 모드 닫기',simple_progress:'변환 진행률'}
};
Object.keys(simpleStrings).forEach(code=>Object.assign(LANG[code],simpleStrings[code]));
var simpleMode=(()=>{
 const el=id=>document.getElementById(id);
 let visible=false,timer=null,selection=null,template=null,target=null,serial=0,error='';
 const busy=()=>selection?.status==='running';
 function render(){
  const probe=selection?.probe,usable=probe?.ok&&probe.hasVideo;
  el('simple-file').textContent=selection?selection.filename:L('simple_drop');
  el('simple-hint').textContent=L(selection?'simple_replace':'simple_choose');
  el('simple-drop').disabled=busy();
  el('simple-run').disabled=!!error||!usable||!template||running||updateInstalling||busy();
  el('simple-close').setAttribute('aria-label',L('simple_close'));
  const progress=el('simple-progress');progress.setAttribute('aria-label',L('simple_progress'));
  let text=error||(!template?L('simple_no_template'):updateInstalling?L('simple_update'):running&&!busy()?L('simple_busy'):'');
  progress.value=0;
  if(!text&&selection){
   if(busy()){
    const duration=selection.totalSec||probe?.duration,seconds=selection.prog?.timeSec||0;
    if(duration>0){progress.value=Math.max(0,Math.min(99,seconds/duration*100));text=L('simple_converting')+' '+Math.floor(progress.value)+'%';}
    else{progress.removeAttribute('value');text=L('simple_converting');}
   }else if(selection.status==='done'){progress.value=100;text=L('simple_done')+' '+fso.GetFileName(selection.outputPath);}
   else if(selection.status==='error')text=selection.simpleError||L('simple_error');
   else if(selection.status==='cancelled')text=L('simple_cancelled');
   else if(!probe){progress.removeAttribute('value');text=L('simple_checking');}
   else text=L(usable?'simple_ready':'simple_invalid');
  }
  if(el('simple-status').textContent!==text)el('simple-status').textContent=text;
 }
 function open(){
  if(visible)return;
  closeSettings();
  const selected=selectedPreset||allPresets().find(p=>p.id==='mp4-hq-original')||allPresets()[0];
  template=selected?JSON.parse(JSON.stringify(selected)):null;
  visible=true;error='';target=null;
  desktopPopup.open(el('simple-overlay'));bgAnim.setEnabled(false);render();el('simple-drop').focus();
  timer=setInterval(render,200);
 }
 function close(){if(!visible)return;visible=false;target=null;clearInterval(timer);timer=null;desktopPopup.close(el('simple-overlay'),()=>{bgAnim.setEnabled(fancyEnabled);el('btn-simple').focus();});}
 function requestTarget(){target='simple-'+(++serial);return target;}
 function browse(){if(!busy())nativeMessage('browse',{target:requestTarget()});}
 function drag(event){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect=busy()?'none':'copy';el('simple-drop').classList.toggle('dragging',!busy());}
 function leave(event){event.preventDefault();el('simple-drop').classList.remove('dragging');}
 function drop(event){event.preventDefault();event.stopPropagation();leave(event);if(busy())return;
  try{chrome.webview.postMessageWithAdditionalObjects({type:'drop',target:requestTarget()},event.dataTransfer.files);}
  catch(e){error=e.message;render();}
 }
 function receive(message){
  if(!visible||message.target!==target||busy())return;
  target=null;error='';
  if(message.errors?.length){error=message.errors.join('\n');render();return;}
  if(message.paths.length!==1){error=L(message.paths.length?'simple_one':'simple_empty');render();return;}
  const path=message.paths[0];
  selection={inputPath:path,filename:fso.GetFileName(path),status:'pending',selected:true,simpleMode:true};
  scheduleProbe(selection);render();
 }
 function start(){
  if(!visible||error||running||updateInstalling||!template||!selection?.probe?.ok||!selection.probe.hasVideo)return;
  error='';target=null;
  // A fresh queue entry makes repeated conversion safe and retains earlier results.
  selection={id:++jobCounter,inputPath:selection.inputPath,filename:selection.filename,probe:selection.probe,
   totalSec:selection.probe.duration||0,preset:JSON.parse(JSON.stringify(template)),selected:true,status:'pending',simpleMode:true,log:'',outputPath:''};
  jobs.push(selection);running=true;stopRequested=false;
  el('btn-stop').style.display='';updateRunButton();
  runNext([selection],0);render();
 }
 el('simple-overlay').addEventListener('cancel',event=>{event.preventDefault();close();});
 return {open,close,browse,drag,leave,drop,receive,start,isOpen:()=>visible};
})();
