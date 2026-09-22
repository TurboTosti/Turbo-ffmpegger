importScripts('jsnes.js');
let nes,timer=null,active=false,next=0,frameCount=0,rom,saveHash,emitEvery=1,audio=[],sampleRate=48000,audioPort,stream=0;
const FPS=60.098;
function release(){for(let i=0;i<10;i++)nes.buttonUp(1,i);}
function snapshot(id){postMessage({type:'save',id,value:{schema:1,emulator:'jsnes-2.1.0',romHash:saveHash,state:nes.toJSON()}});}
function draw(buffer){if(frameCount%emitEvery)return;const pixels=new Uint32Array(256*240);for(let i=0;i<pixels.length;i++)pixels[i]=0xff000000|buffer[i];postMessage({type:'frame',pixels},[pixels.buffer]);}
function frame(){nes.frame();frameCount++;if(frameCount%900===0)snapshot();}
function flush(){if(!audio.length)return;const samples=Float32Array.from(audio);audio=[];const target=audioPort||{postMessage};target.postMessage({type:'audio',stream,samples},[samples.buffer]);}
function tick(){if(!active)return;try{frame();flush();next+=1000/FPS;if(next<performance.now()-50)next=performance.now();timer=setTimeout(tick,Math.max(0,next-performance.now()));}catch(e){fail(e);}}
function fail(e,id){active=false;clearTimeout(timer);postMessage({type:'error',error:e.message,id});}
function supply(m){
 if(m.type!=='need')return;
 if(!active||m.stream!==stream){audioPort.postMessage({stream:m.stream});return;}
 try{const wanted=Math.min(sampleRate*.1,Math.max(0,m.frames));for(let i=0;i<8&&audio.length/2<wanted;i++)frame();flush();}catch(e){fail(e);}
}
onmessage=e=>{const m=e.data;try{switch(m.type){
 case 'init':
  rom=m.rom;saveHash=m.hash;sampleRate=m.sampleRate||48000;
  if(m.audioPort){audioPort=m.audioPort;audioPort.onmessage=e=>supply(e.data);}
  nes=new jsnes.NES({sampleRate,onFrame:draw,onAudioSample:(l,r)=>audio.push(l,r)});nes.loadROM(rom);
  if(m.saved){
   if(m.saved.romHash!==saveHash||m.saved.emulator!=='jsnes-2.1.0')throw Error('The saved game belongs to a different game version. Use Reset to start this version.');
   const timing={rate:nes.papu.sampleRate,max:nes.papu.sampleTimerMax};nes.fromJSON(m.saved.state);
   // Preserve the fractional audio clock when loading a save from another device.
   const fraction=nes.papu.sampleTimer/nes.papu.sampleTimerMax;
   nes.papu.sampleRate=timing.rate;nes.papu.sampleTimerMax=timing.max;nes.papu.sampleTimer=Math.floor(fraction*timing.max);release();
  }
  postMessage({type:'ready'});break;
 case 'resume':if(active)break;active=true;stream=m.stream||0;audio=[];if(!audioPort){next=performance.now();tick();}break;
 case 'pause':active=false;clearTimeout(timer);timer=null;audio=[];release();snapshot(m.id);break;
 case 'reset':active=false;clearTimeout(timer);nes.loadROM(rom);frameCount=0;audio=[];snapshot(m.id);postMessage({type:'reset'});break;
 case 'button':if(active)nes[m.down?'buttonDown':'buttonUp'](1,m.button);break;
 case 'release':release();break;
 case 'performance':emitEvery=m.converting?2:1;break;
 case 'snapshot':snapshot(m.id);break;
}}catch(e){fail(e,m.id);}};
