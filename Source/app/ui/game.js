waitingGame=(()=>{
 let worker,ready=false,loading=null,resuming=null,pausing=null,playing=false,wantsPlay=false,visible=false,audio,node,gain,video,stream=0,revision=0,lastConverting=false,nextId=0,savePending=new Map(),gamepadTimer=null,lastButtons=new Set(),failed=false;
 const el=id=>document.getElementById(id),keys={ArrowLeft:6,ArrowRight:7,ArrowUp:4,ArrowDown:5,KeyA:6,KeyD:7,KeyZ:0,Space:0,KeyX:1,Enter:3,ShiftLeft:2,ShiftRight:2};
 const romHash='4ea2830357b5e8024b6c14ed3b1f8f68030c704d040e097281e412c1ac4c92e9';
 let config={crt:true,strength:.7,volume:.3};try{Object.assign(config,JSON.parse(nativeCall('load',{name:'game-options.json'})));}catch{}
 config.volume=Math.max(0,Math.min(1,Number(config.volume)||0));config.strength=Math.max(.2,Math.min(1,Number(config.strength)||.7));
 const log=event=>nativeMessage('gameDiagnostic',{event});
 function status(text){el('nes-status').textContent=text;el('nes-pause').textContent=playing?'Pause':'Resume';}
 function failure(error){revision++;failed=true;wantsPlay=false;playing=false;stopGamepad();node?.port.postMessage({type:'stop'});audio?.suspend().catch(()=>{});status(error.message);log('error: '+error.message);for(const pending of savePending.values())pending.reject(error);savePending.clear();}
 function level(value){if(!gain)return;gain.gain.cancelScheduledValues(audio.currentTime);gain.gain.setValueAtTime(gain.gain.value,audio.currentTime);gain.gain.linearRampToValueAtTime(value,audio.currentTime+.015);}
 async function init(){if(ready)return;if(loading)return loading;loading=(async()=>{
  if(!video){video=new NesVideo(el('nes-canvas'));if(!video.gl){el('nes-crt').disabled=el('nes-strength').disabled=true;el('nes-crt').title='CRT needs graphics acceleration; the game still works without it.';}}
  audio=new AudioContext();await audio.audioWorklet.addModule('game-audio.js');node=new AudioWorkletNode(audio,'nes-audio',{outputChannelCount:[2]});
  gain=audio.createGain();gain.gain.value=0;node.connect(gain).connect(audio.destination);await audio.suspend();
  const rom=new Uint8Array(await(await fetch('game.nes')).arrayBuffer());const saved=nativeCall('gameLoad');
  const channel=new MessageChannel();node.port.postMessage({type:'connect',port:channel.port1},[channel.port1]);
  worker=new Worker('game-worker.js');const complete=new Promise((resolve,reject)=>{
   worker.onmessage=async e=>{const m=e.data;
    if(m.type==='ready'){ready=true;resolve();}
    else if(m.type==='frame'){
     if(lastConverting!==!!running){lastConverting=!!running;worker.postMessage({type:'performance',converting:lastConverting});video.options(config.crt,config.strength,lastConverting);}
     if(visible)video.draw(m.pixels);
    }
    else if(m.type==='save'){try{nativeCall('gameSave',{value:m.value});savePending.get(m.id)?.resolve();}catch(e){showNotice('Could not save game progress: '+e.message);savePending.get(m.id)?.reject(e);}finally{savePending.delete(m.id);}}
    else if(m.type==='error'){const error=Error(m.error);failure(error);if(!ready)reject(error);}
   };worker.onerror=e=>{const error=Error(e.message);failure(error);reject(error);};
  });
  worker.postMessage({type:'init',rom,hash:romHash,saved,sampleRate:audio.sampleRate,audioPort:channel.port2},[rom.buffer,channel.port2]);await complete;
  log('initialized; audio '+audio.sampleRate+' Hz; '+(video.gl?'CRT graphics available':'plain graphics'));
 })();try{await loading;}catch(error){failure(error);throw error;}finally{loading=null;}}
 function requestSave(type){return new Promise((resolve,reject)=>{const id=++nextId;const timeout=setTimeout(()=>{savePending.delete(id);reject(Error('Game save timed out'));},8000);savePending.set(id,{resolve:()=>{clearTimeout(timeout);resolve();},reject:e=>{clearTimeout(timeout);reject(e);}});worker.postMessage({type,id});});}
 function stopGamepad(){clearInterval(gamepadTimer);gamepadTimer=null;lastButtons.clear();}
 function pollGamepad(){const pad=Array.from(navigator.getGamepads?.()||[]).find(Boolean);const current=new Set();if(pad){if(pad.axes[0]<-.4||pad.buttons[14]?.pressed)current.add(6);if(pad.axes[0]>.4||pad.buttons[15]?.pressed)current.add(7);if(pad.axes[1]<-.4||pad.buttons[12]?.pressed)current.add(4);if(pad.axes[1]>.4||pad.buttons[13]?.pressed)current.add(5);for(const [i,b]of [[0,0],[1,1],[8,2],[9,3]])if(pad.buttons[i]?.pressed)current.add(b);}for(let b=0;b<8;b++)if(current.has(b)!==lastButtons.has(b))worker.postMessage({type:'button',button:b,down:current.has(b)});lastButtons=current;}
 async function resume(){
  wantsPlay=true;if(resuming){await resuming;if(wantsPlay&&visible&&!playing)return resume();return;}
  const requestedRevision=revision;
  resuming=(async()=>{if(pausing)await pausing;if(failed)throw Error('The game could not continue. Your last saved progress is kept. Use Reset to start a new game.');await init();if(requestedRevision!==revision||!wantsPlay||!visible||playing)return;
  stream++;worker.postMessage({type:'performance',converting:!!running});video.options(config.crt,config.strength,!!running);
  worker.postMessage({type:'resume',stream});node.port.postMessage({type:'start',stream});
  await audio.resume();if(requestedRevision!==revision||!wantsPlay||!visible){await audio.suspend();node.port.postMessage({type:'stop'});return;}
  level(config.volume);playing=true;status('Playing · progress saved automatically');log('resumed');
  stopGamepad();gamepadTimer=setInterval(pollGamepad,33);el('nes-canvas').focus();
  })();try{await resuming;}finally{resuming=null;}
 }
 async function pause(){
  revision++;wantsPlay=false;playing=false;stopGamepad();if(pausing)return pausing;
  pausing=(async()=>{if(loading)await loading.catch(()=>{});if(failed){await audio?.suspend();node?.port.postMessage({type:'stop'});return;}if(!worker||!ready)return;
   level(0);await Promise.all([requestSave('pause'),(async()=>{await new Promise(resolve=>setTimeout(resolve,20));await audio.suspend();node.port.postMessage({type:'stop'});})()]);
   status('Paused · saved');log('paused and saved');
  })();try{await pausing;}finally{pausing=null;}
 }
 async function open(){visible=true;el('game-overlay').style.display='block';el('nes-crt').checked=config.crt;el('nes-strength').value=config.strength;el('nes-volume').value=config.volume;bgAnim.setEnabled(false);log('opened');try{await resume();}catch(e){status(e.message);}}
 async function close(){log('close requested');try{await pause();visible=false;el('game-overlay').style.display='none';bgAnim.setEnabled(fancyEnabled);el('btn-game').focus();log('closed; progress saved');}catch(e){showNotice(e.message);}}
 async function togglePause(){try{if(playing||wantsPlay)await pause();else await resume();}catch(e){status(e.message);}}
 async function newGame(){if(!confirm('Reset Voidbreaker and start a new game? Your saved progress will be replaced.'))return;try{
  await pause();if(failed||!worker||!ready){worker?.terminate();await audio?.close();worker=null;ready=false;loading=null;failed=false;nativeCall('gameReset');await init();}
  else{failed=false;await requestSave('reset');}log('reset');await resume();
 }catch(e){status(e.message);}}
 function options(){config={crt:el('nes-crt').checked,strength:Number(el('nes-strength').value),volume:Number(el('nes-volume').value)};video?.options(config.crt,config.strength,!!running);el('nes-strength').disabled=!config.crt||!!video&&!video.gl;if(playing)level(config.volume);try{nativeCall('save',{name:'game-options.json',text:JSON.stringify(config)});}catch(e){showNotice('Could not save game settings: '+e.message);}}
 document.addEventListener('keydown',e=>{if(!visible)return;if(e.code==='Escape'){e.preventDefault();close();return;}if(e.code==='KeyP'){e.preventDefault();if(!e.repeat)togglePause();return;}if(e.target.closest('input,button'))return;const button=keys[e.code];if(button!==undefined){e.preventDefault();if(playing&&!e.repeat)worker.postMessage({type:'button',button,down:true});}});
 document.addEventListener('keyup',e=>{if(!visible)return;const button=keys[e.code];if(button!==undefined){e.preventDefault();worker?.postMessage({type:'button',button,down:false});}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&(playing||wantsPlay))pause().catch(e=>showNotice(e.message));});
 chrome.webview.addEventListener('message',async e=>{if(e.data.type==='gameBlur'&&(playing||wantsPlay))await pause().catch(e=>showNotice(e.message));if(e.data.type==='prepareClose'){log('application close requested');try{await pause();nativeMessage('closeReady');}catch(e){showNotice(e.message);}}});
 return {open,close,togglePause,newGame,options,destroy(){stopGamepad();worker?.terminate();audio?.close();},isOpen:()=>visible};
})();
