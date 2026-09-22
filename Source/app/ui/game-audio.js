// The audio device clock pulls frames through a dedicated port, bypassing the UI.
class NesAudio extends AudioWorkletProcessor {
 constructor() {
  super(); this.capacity=16384; this.left=new Float32Array(this.capacity); this.right=new Float32Array(this.capacity);
  this.read=0; this.size=0; this.stream=0; this.active=false; this.primed=false; this.pending=false;
  this.target=Math.ceil(sampleRate*.065); this.prebuffer=Math.ceil(sampleRate*.045);
  this.lastL=0; this.lastR=0; this.fade=0; this.underruns=0; this.overflows=0;
  this.port.onmessage=({data:m})=>{
   if(m.type==='connect'){this.source=m.port;this.source.onmessage=e=>this.receive(e.data);}
   if(m.type==='start'){this.clear();this.stream=m.stream;this.active=true;}
   if(m.type==='stop'||m.clear){this.active=false;this.clear();}
   if(m.type==='stats')this.port.postMessage({type:'stats',underruns:this.underruns,overflows:this.overflows,buffered:this.size});
  };
 }
 clear(){this.read=this.size=0;this.primed=this.pending=false;this.fade=0;this.lastL=this.lastR=0;}
 receive(m){
  if(!this.active||m.stream!==this.stream)return;
  this.pending=false;const a=m.samples;if(!a)return;
  for(let i=0;i<a.length;i+=2){
   if(this.size===this.capacity){this.read=(this.read+1)%this.capacity;this.size--;this.overflows++;}
   const index=(this.read+this.size)%this.capacity;this.left[index]=a[i];this.right[index]=a[i+1];this.size++;
  }
 }
 process(_inputs,outputs){
  const left=outputs[0][0],right=outputs[0][1]||left;
  if(this.active&&this.source&&!this.pending&&this.size<this.target){this.pending=true;this.source.postMessage({type:'need',stream:this.stream,frames:this.target-this.size});}
  if(!this.primed&&this.size>=this.prebuffer){this.primed=true;this.fade=0;}
  for(let i=0;i<left.length;i++){
   if(this.active&&this.primed&&this.size){
    this.fade=Math.min(1,this.fade+1/(sampleRate*.005));
    this.lastL=this.left[this.read]*this.fade;this.lastR=this.right[this.read]*this.fade;
    this.read=(this.read+1)%this.capacity;this.size--;
   }else{
    if(this.active&&this.primed){this.underruns++;this.primed=false;}
    this.lastL*=.97;this.lastR*=.97;
    if(Math.abs(this.lastL)<1e-8)this.lastL=0;if(Math.abs(this.lastR)<1e-8)this.lastR=0;
   }
   left[i]=this.lastL;right[i]=this.lastR;
  }
  return true;
 }
}
registerProcessor('nes-audio',NesAudio);
