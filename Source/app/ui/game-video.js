// Original single-pass CRT shader. Draw only on frame delivery or an option/size change.
class NesVideo {
 constructor(canvas){
  this.canvas=canvas;this.crt=true;this.strength=.7;this.converting=false;
  this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'low-power'});
  if(!this.gl){this.context=canvas.getContext('2d',{alpha:false});return;}
  try{this.setup();}catch(error){
   // A driver can expose WebGL but reject a shader. Keep the game playable.
   const replacement=canvas.cloneNode(false);replacement.width=256;replacement.height=240;canvas.replaceWith(replacement);
   this.canvas=replacement;this.gl=null;this.context=replacement.getContext('2d',{alpha:false});this.error=error.message;return;
  }
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;});
  canvas.addEventListener('webglcontextrestored',()=>{try{this.setup();this.lost=false;if(this.pixels)this.draw(this.pixels);}catch(error){this.error=error.message;}});
 }
 setup(){
  const gl=this.gl;
  const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
  const vertex=compile(gl.VERTEX_SHADER,'attribute vec2 position; varying vec2 uv; void main(){uv=vec2(position.x*.5+.5,.5-position.y*.5);gl_Position=vec4(position,0.,1.);}');
  const fragment=compile(gl.FRAGMENT_SHADER,`
   precision mediump float;
   uniform sampler2D picture; uniform vec2 resolution; uniform float strength;
   varying vec2 uv;
   vec3 sampleScreen(vec2 p){return texture2D(picture,clamp(p,vec2(.001),vec2(.999))).rgb;}
   void main(){
    if(strength<.001){gl_FragColor=vec4(sampleScreen((floor(uv*vec2(256.,240.))+.5)/vec2(256.,240.)),1.);return;}
    vec2 c=uv*2.-1.; vec2 p=c*(1.+strength*.055*dot(c,c)); p=p*.5+.5;
    vec2 edge=min(p,1.-p);
    float border=smoothstep(0.,.009,min(edge.x,edge.y));
    vec2 texel=vec2(1./256.,1./240.);
    vec3 color=sampleScreen(p);
    vec3 glow=(sampleScreen(p+vec2(texel.x,0.))+sampleScreen(p-vec2(texel.x,0.))+sampleScreen(p+vec2(0.,texel.y))+sampleScreen(p-vec2(0.,texel.y)))*.25;
    color=mix(color,color*.90+glow*.24,strength);
    float brightness=max(color.r,max(color.g,color.b));
    float beam=.5+.5*cos((p.y*240.-.5)*6.2831853);
    color*=1.-strength*(.30-.12*brightness)*(1.-beam);
    float column=mod(floor(gl_FragCoord.x),3.);
    vec3 mask=column<1.?vec3(1.,.76,.76):(column<2.?vec3(.76,1.,.76):vec3(.76,.76,1.));
    color*=mix(vec3(1.),mask,strength*.6);
    color*=1.+strength*.09;
    color*=1.-strength*.16*pow(dot(c,c)*.5,1.5);
    gl_FragColor=vec4(color*border,1.);
   }`);
  this.program=gl.createProgram();gl.attachShader(this.program,vertex);gl.attachShader(this.program,fragment);gl.linkProgram(this.program);
  if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
  gl.deleteShader(vertex);gl.deleteShader(fragment);gl.useProgram(this.program);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const position=gl.getAttribLocation(this.program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  this.amount=gl.getUniformLocation(this.program,'strength');
 }
 options(crt,strength,converting=false){this.crt=crt;this.strength=strength;this.converting=converting;if(this.pixels)this.draw(this.pixels);}
 draw(pixels){
  this.pixels=pixels;const bytes=new Uint8Array(pixels.buffer,pixels.byteOffset,pixels.byteLength);
  if(!this.gl){this.context.putImageData(new ImageData(new Uint8ClampedArray(bytes.buffer,bytes.byteOffset,bytes.byteLength),256,240),0,0);return;}
  if(this.lost)return;const gl=this.gl;
  const width=Math.min(this.converting?720:960,Math.max(256,Math.round(this.canvas.clientWidth*Math.min(2,window.devicePixelRatio||1))));
  const height=Math.round(width*240/256);if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
  gl.viewport(0,0,width,height);gl.uniform1f(this.amount,this.crt?this.strength:0);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,240,0,gl.RGBA,gl.UNSIGNED_BYTE,bytes);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
 }
}
