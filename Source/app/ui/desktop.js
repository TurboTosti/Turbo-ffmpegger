var settingsTab='appearance';
var desktopUpdate={state:'idle'};
var extraTranslations={
 en:{templates:'Templates',filters:'Filters',appearance:'Appearance',updates:'Updates',edit_selected:'Edit / duplicate selected',saved_templates:'Saved custom templates',open_data:'Open settings folder',install_update:'Install update',view_releases:'View releases',update_idle:'Check for a new desktop version.',update_none:'You have the latest published desktop version.',update_legacy:'No newer portable desktop package has been published yet.',update_ready:'A desktop update is available:',update_downloading:'Downloading and verifying the update…',update_failed_native:'Could not complete the update:',template_empty:'No custom templates yet. Create one above.',template_tools:'Create templates or duplicate a preset. Your saved templates appear in the preset list.',update_finished:'Update prepared. Restart to use it.',restart_update:'Restart with update',checking_native:'Checking published releases…'},
 nl:{templates:'Templates',filters:'Filters',appearance:'Uiterlijk',updates:'Updates',edit_selected:'Geselecteerde bewerken / dupliceren',saved_templates:'Opgeslagen eigen templates',open_data:'Instellingenmap openen',install_update:'Update installeren',view_releases:'Releases bekijken',update_idle:'Controleer op een nieuwe desktopversie.',update_none:'Je hebt de nieuwste gepubliceerde desktopversie.',update_legacy:'Er is nog geen nieuwer desktopprogramma gepubliceerd.',update_ready:'Er is een desktopupdate beschikbaar:',update_downloading:'Update downloaden en controleren…',update_failed_native:'De update is niet voltooid:',template_empty:'Nog geen eigen templates. Maak er hierboven een.',template_tools:'Maak templates of dupliceer een preset. Opgeslagen templates staan in de presetlijst.',update_finished:'Update gereed. Herstart om deze te gebruiken.',restart_update:'Herstart met update',checking_native:'Releases controleren…'},
 ja:{templates:'テンプレート',filters:'フィルター',appearance:'外観',updates:'更新',edit_selected:'選択項目を編集・複製',saved_templates:'保存したテンプレート',open_data:'設定フォルダーを開く',install_update:'更新をインストール',view_releases:'リリースを表示',update_idle:'デスクトップ版の更新を確認します。',update_none:'最新のデスクトップ版です。',update_legacy:'新しいデスクトップ版はまだ公開されていません。',update_ready:'更新があります:',update_downloading:'更新をダウンロードして確認中…',update_failed_native:'更新できませんでした:',template_empty:'テンプレートはありません。上から作成できます。',template_tools:'テンプレートを作成するか、プリセットを複製します。',update_finished:'更新の準備ができました。再起動してください。',restart_update:'更新して再起動',checking_native:'リリースを確認中…'},
 zh:{templates:'模板',filters:'筛选',appearance:'外观',updates:'更新',edit_selected:'编辑／复制所选项',saved_templates:'已保存的自定义模板',open_data:'打开设置文件夹',install_update:'安装更新',view_releases:'查看发布版本',update_idle:'检查 桌面版更新。',update_none:'已是最新发布的桌面版。',update_legacy:'尚未发布更新的 桌面版。',update_ready:'有可用更新：',update_downloading:'正在下载并验证更新…',update_failed_native:'无法完成更新：',template_empty:'暂无自定义模板，可在上方创建。',template_tools:'创建模板或复制预设，保存的模板显示在预设列表中。',update_finished:'更新已准备好，请重新启动。',restart_update:'重新启动并更新',checking_native:'正在检查发布版本…'},
 ko:{templates:'템플릿',filters:'필터',appearance:'모양',updates:'업데이트',edit_selected:'선택 항목 편집 / 복제',saved_templates:'저장된 사용자 템플릿',open_data:'설정 폴더 열기',install_update:'업데이트 설치',view_releases:'출시 버전 보기',update_idle:'데스크톱 업데이트를 확인합니다.',update_none:'최신 데스크톱 버전입니다.',update_legacy:'새 데스크톱 버전이 아직 없습니다.',update_ready:'업데이트를 사용할 수 있습니다:',update_downloading:'업데이트 다운로드 및 확인 중…',update_failed_native:'업데이트를 완료하지 못했습니다:',template_empty:'저장된 템플릿이 없습니다. 위에서 만드세요.',template_tools:'템플릿을 만들거나 프리셋을 복제하세요.',update_finished:'업데이트 준비 완료. 다시 시작하세요.',restart_update:'업데이트 후 다시 시작',checking_native:'출시 버전 확인 중…'}
};
Object.keys(extraTranslations).forEach(function(code){Object.assign(LANG[code],extraTranslations[code]);});

function openSettings(tab) {
 settingsTab=['appearance','language','updates'].includes(tab)?tab:'appearance';
 var panel=document.getElementById('settings-panel');
 panel.classList.add('open');
 panel.setAttribute('aria-hidden','false');
 document.querySelectorAll('[data-settings-section]').forEach(function(section){section.hidden=section.dataset.settingsSection!==settingsTab;});
 document.querySelectorAll('[data-settings-tab]').forEach(function(button){button.setAttribute('aria-selected',String(button.dataset.settingsTab===settingsTab));});
 panel.scrollTop=0;
 refreshDesktopControls();
}
function closeSettings() {var p=document.getElementById('settings-panel');p.classList.remove('open');p.setAttribute('aria-hidden','true');}
function toggleSettings() {if(document.getElementById('settings-panel').classList.contains('open'))closeSettings();else openSettings('appearance');}
function openTemplates() {closeSettings();refreshDesktopControls();desktopPopup.open(document.getElementById('templates-overlay'));document.getElementById('sp-newtemplate').focus();}
function closeTemplates(done) {desktopPopup.close(document.getElementById('templates-overlay'),function(){document.getElementById('btn-templates').focus();if(done)done();});}
function newTemplate() {closeSettings();closeTemplates(function(){openEditor(null);});}
function editSelectedTemplate() {closeSettings();var id=selectedPreset?selectedPreset.id:null;closeTemplates(function(){openEditor(id);});}
document.getElementById('templates-overlay').addEventListener('cancel',function(event){event.preventDefault();closeTemplates();});
function refreshDesktopControls() {
 var t=getT();
 document.documentElement.style.setProperty('--desktop-accent',t.ac);
 document.documentElement.style.setProperty('--desktop-border',t.bord);
 document.documentElement.style.setProperty('--desktop-text',t.text);
 document.documentElement.style.setProperty('--desktop-muted',t.muted);
 document.documentElement.style.setProperty('--desktop-surface',t.surf);
 document.documentElement.style.setProperty('--desktop-surface-secondary',t.surf2);
 document.documentElement.style.setProperty('--desktop-border-strong',t.bordHi);
 document.documentElement.style.setProperty('--desktop-accent-text',t.acText);
 document.querySelectorAll('[data-desktop-label]').forEach(function(el){el.textContent=L(el.dataset.desktopLabel);});
 var list=document.getElementById('saved-template-list');
 if(list) {
  list.replaceChildren();
  if(!customPresets.length)list.textContent=L('template_empty');
  customPresets.forEach(function(p){
   var row=document.createElement('div');row.className='saved-template';
   var label=document.createElement('span');label.textContent=p.name;row.append(label);
   var edit=document.createElement('button');edit.textContent='✎';edit.title=L('edit_selected');edit.onclick=function(){closeTemplates(function(){openEditor(p.id);});};row.append(edit);
   var del=document.createElement('button');del.textContent='×';del.title=L('remove');del.onclick=function(){deleteCustom(p.id);refreshDesktopControls();};row.append(del);list.append(row);
  });
 }
 document.getElementById('templates-close').setAttribute('aria-label',L('close'));
 renderUpdateControls();
}
function renderUpdateControls() {
 var label=document.getElementById('update-status'),btn=document.getElementById('sp-updatebtn'),install=document.getElementById('sp-installbtn');
 if(!label||!btn||!install)return;
 var state=desktopUpdate.state;
 btn.disabled=state==='checking'||state==='downloading';
 btn.textContent=L(state==='checking'?'checking_native':'check_updates');
 install.hidden=state!=='available'&&state!=='ready';
 install.disabled=!!running;
 install.textContent=L(state==='ready'?'restart_update':'install_update');
 var text=L('update_idle');
 if(state==='checking')text=L('checking_native');
 if(state==='current')text=L('update_none');
 if(state==='noPackage')text=L('update_legacy');
 if(state==='available')text=L('update_ready')+' '+desktopUpdate.version;
 if(state==='downloading')text=L('update_downloading');
 if(state==='ready')text=L('update_finished');
 if(state==='error')text=L('update_failed_native')+' '+desktopUpdate.error;
 label.textContent=L('installed_version',APP_VERSION)+'\n'+text;
}
function checkForUpdates() {desktopUpdate={state:'checking'};renderUpdateControls();nativeMessage('checkUpdates');}
function installDesktopUpdate() {
 if(running){showNotice(L('stop_all')+' — '+L('convert'));return;}
 if(desktopUpdate.state==='ready'){nativeMessage('activateUpdate');return;}
 if(desktopUpdate.state!=='available')return;
 desktopUpdate.state='downloading';renderUpdateControls();nativeMessage('downloadUpdate');
}
function refreshDisplayedAppVersion(){APP_VERSION=nativeInfo.displayVersion||nativeInfo.version;renderUpdateControls();}
function dropBridgeElementVisible(id){var e=document.getElementById(id);return !!e&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';}
document.onclick=function(e){
 if(e.target.closest('#settings-panel')||e.target.closest('[data-settings-trigger]'))return;
 closeSettings();
};
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.getElementById('settings-panel').classList.contains('open'))closeSettings();});
chrome.webview.addEventListener('message',function(e){if(e.data.type==='update'){desktopUpdate=e.data;renderUpdateControls();}});
var originalApplyLanguage=applyLanguage;
applyLanguage=function(){originalApplyLanguage();refreshDesktopControls();};
var originalApplyTheme=applyTheme;
applyTheme=function(name){originalApplyTheme(name);refreshDesktopControls();};
var originalRenderPresets=renderPresets;
renderPresets=function(){originalRenderPresets();refreshPresetSidebar();if(document.getElementById('settings-panel').classList.contains('open')||document.getElementById('templates-overlay').open)refreshDesktopControls();};

var libraryTranslations={
 en:{show_all:'Show all',show_library:'Show the full template library',library_all:'All templates',library_filtered:'Filtered list',library_empty:'No templates match these filters. Choose Show all to restore the full list.'},
 nl:{show_all:'Toon alles',show_library:'Volledige templatelijst tonen',library_all:'Alle templates',library_filtered:'Gefilterde lijst',library_empty:'Geen templates voor deze filters. Kies Toon alles voor de volledige lijst.'},
 ja:{show_all:'すべて表示',show_library:'すべてのテンプレートを表示',library_all:'すべてのテンプレート',library_filtered:'絞り込み中',library_empty:'一致するテンプレートがありません。「すべて表示」を選択してください。'},
 zh:{show_all:'显示全部',show_library:'显示完整模板库',library_all:'全部模板',library_filtered:'已筛选',library_empty:'没有匹配的模板。选择“显示全部”恢复完整列表。'},
 ko:{show_all:'모두 보기',show_library:'전체 템플릿 보기',library_all:'모든 템플릿',library_filtered:'필터 적용됨',library_empty:'일치하는 템플릿이 없습니다. 모두 보기를 선택하세요.'}
};
Object.keys(libraryTranslations).forEach(function(code){Object.assign(LANG[code],libraryTranslations[code]);});
function refreshPresetSidebar(){
 var list=document.getElementById('preset-list'),count=document.getElementById('preset-count');
 if(!list||!count)return;
 var total=allPresets().length,visible=list.querySelectorAll('.preset-item').length;
 var filtered=!!searchTerm||showFavsOnly||(compatOnly&&queueInputExtSet().__any);
 count.textContent=visible+' / '+total;
 document.getElementById('preset-filter-label').textContent=L(filtered?'library_filtered':'library_all');
 var show=document.getElementById('preset-show-all');show.textContent=L('show_all');show.disabled=!filtered;
 document.getElementById('fav-filter').style.color=showFavsOnly?getT().ac:getT().muted;
 document.getElementById('compat-filter').style.color=compatOnly?getT().ac:getT().muted;
 if(!visible){var empty=document.createElement('div');empty.className='preset-empty';empty.textContent=L('library_empty');list.prepend(empty);}
}
function showAllPresets(){
 closeSettings();searchTerm='';showFavsOnly=false;compatOnly=false;
 document.getElementById('search-box').value='';renderPresets();
 var list=document.getElementById('preset-list');list.scrollTop=0;list.focus({preventScroll:true});
}

function jobCanBeSelected(job){return ['pending','done','error','cancelled'].includes(job.status);}
function prepareJobForConversion(job){
 delete job.simpleMode;delete job.simpleError;
 job.status='pending';job.aborted=false;job.log='';job.token=null;
 job.prog=null;job.outputPath='';
 job.totalSec=job.probe&&job.probe.duration>0?job.probe.duration:0;
 job.outSizeBytes=0;job.lastSizeBytes=0;job.lastSizeTime=0;job.writeBps=0;
}
var queueTranslations={
 en:{apply_title:'Apply template to videos?',apply_q:'Apply to all {n} available videos, or only the {m} selected? Finished, aborted and failed videos will be ready to convert again.'},
 nl:{apply_title:'Template toepassen op video’s?',apply_q:'Toepassen op alle {n} beschikbare video’s, of alleen de {m} geselecteerde? Voltooide, afgebroken en mislukte video’s worden weer klaargezet voor conversie.'},
 ja:{apply_title:'動画にテンプレートを適用しますか？',apply_q:'変換中でない {n} 件すべてに適用しますか、それとも選択中の {m} 件のみですか？完了・中止・失敗した動画は再び変換待ちになります。'},
 zh:{apply_title:'将模板应用到视频？',apply_q:'应用到全部 {n} 个可用视频，还是仅所选的 {m} 个？已完成、中止或失败的视频将重新进入待转换状态。'},
 ko:{apply_title:'동영상에 템플릿을 적용할까요?',apply_q:'사용 가능한 {n}개 전체에 적용할까요, 아니면 선택한 {m}개에만 적용할까요? 완료, 중단 또는 실패한 동영상은 다시 변환 대기 상태가 됩니다.'}
};
Object.keys(queueTranslations).forEach(function(code){Object.assign(LANG[code],queueTranslations[code]);});
