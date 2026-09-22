// Replace only the Windows resource section; no compiler or external editor required.
const fs=require('node:fs');
function parse(file){
 const bytes=fs.readFileSync(file),pe=bytes.readUInt32LE(60),optional=pe+24,sections=[];
 if(bytes.toString('ascii',pe,pe+4)!=='PE\0\0'||bytes.readUInt16LE(optional)!==0x20b)throw Error('Expected x64 PE');
 for(let i=0;i<bytes.readUInt16LE(pe+6);i++){const at=optional+bytes.readUInt16LE(pe+20)+40*i;sections.push({at,va:bytes.readUInt32LE(at+12),size:bytes.readUInt32LE(at+16),offset:bytes.readUInt32LE(at+20)});}
 const rva=bytes.readUInt32LE(optional+128),section=sections.find(s=>rva>=s.va&&rva<s.va+s.size),base=section.offset+rva-section.va;
 const address=rva=>{const s=sections.find(s=>rva>=s.va&&rva<s.va+s.size);if(!s)throw Error('Resource outside image');return s.offset+rva-s.va;};
 function directory(offset){const at=base+offset,node={header:Buffer.from(bytes.subarray(at,at+16)),entries:[]};const count=bytes.readUInt16LE(at+12)+bytes.readUInt16LE(at+14);
  for(let i=0;i<count;i++){const e=at+16+8*i,key=bytes.readUInt32LE(e),target=bytes.readUInt32LE(e+4);let name=key;
   if(key>>>31){const pos=base+(key&0x7fffffff),len=bytes.readUInt16LE(pos);name=bytes.toString('utf16le',pos+2,pos+2+len*2);}
   if(target>>>31)node.entries.push({name,node:directory(target&0x7fffffff)});
   else{const p=base+target,dataAt=address(bytes.readUInt32LE(p)),size=bytes.readUInt32LE(p+4);node.entries.push({name,data:Buffer.from(bytes.subarray(dataAt,dataAt+size)),codepage:bytes.readUInt32LE(p+8)});}
  }return node;
 }
 return {bytes,pe,optional,sections,section,base,rva,root:directory(0)};
}
function patch(file,icon){
 const pe=parse(file),ico=fs.readFileSync(icon),count=ico.readUInt16LE(4);
 if(ico.readUInt16LE(2)!==1||!count)throw Error('Expected ICO');
 const group=Buffer.alloc(6+count*14);ico.copy(group,0,0,6);
 const icons={header:Buffer.alloc(16),entries:[]};
 for(let i=0;i<count;i++){const p=6+i*16,size=ico.readUInt32LE(p+8),offset=ico.readUInt32LE(p+12);ico.copy(group,6+i*14,p,p+12);group.writeUInt16LE(i+1,6+i*14+12);
  icons.entries.push({name:i+1,node:{header:Buffer.alloc(16),entries:[{name:1033,data:Buffer.from(ico.subarray(offset,offset+size)),codepage:0}]}});
 }
 const types=pe.root.entries,old=types.find(e=>e.name===3);if(old)old.node=icons;else types.push({name:3,node:icons});
 const groups=types.find(e=>e.name===14);if(!groups)throw Error('No icon group in original executable');
 for(const entry of groups.node.entries)for(const lang of entry.node.entries)lang.data=group;
 let size=0;const dirs=[],strings=[],leaves=[];
 function allocate(node){node.entries.sort((a,b)=>typeof a.name===typeof b.name?(typeof a.name==='string'?a.name.localeCompare(b.name):a.name-b.name):(typeof a.name==='string'?-1:1));node.offset=size;size+=16+8*node.entries.length;dirs.push(node);for(const e of node.entries)if(e.node)allocate(e.node);}
 allocate(pe.root);
 for(const d of dirs)for(const e of d.entries){if(typeof e.name==='string'){e.nameOffset=size;strings.push(e);size+=2+e.name.length*2;}if(!e.node)leaves.push(e);}
 size=(size+3)&~3;for(const e of leaves){e.entryOffset=size;size+=16;}for(const e of leaves){e.dataOffset=size;size=(size+e.data.length+3)&~3;}
 if(size>pe.section.size-(pe.base-pe.section.offset)){
  // Retain every existing section/RVA. Add a read-only resource section when needed.
  const align=(n,a)=>Math.ceil(n/a)*a,sa=pe.bytes.readUInt32LE(pe.optional+32),fa=pe.bytes.readUInt32LE(pe.optional+36);
  const at=pe.sections.at(-1).at+40;if(at+40>pe.bytes.readUInt32LE(pe.optional+60))throw Error('No room for another section header');
  const offset=align(pe.bytes.length,fa),length=align(size,fa),va=align(Math.max(...pe.sections.map(s=>s.va+Math.max(s.size,pe.bytes.readUInt32LE(s.at+8)))),sa);
  const extended=Buffer.alloc(offset+length);pe.bytes.copy(extended);pe.bytes=extended;
  pe.bytes.fill(0,at,at+40);pe.bytes.write('.appres',at,'ascii');pe.bytes.writeUInt32LE(size,at+8);pe.bytes.writeUInt32LE(va,at+12);pe.bytes.writeUInt32LE(length,at+16);pe.bytes.writeUInt32LE(offset,at+20);pe.bytes.writeUInt32LE(0x40000040,at+36);
  pe.bytes.writeUInt16LE(pe.sections.length+1,pe.pe+6);pe.bytes.writeUInt32LE(align(va+size,sa),pe.optional+56);pe.bytes.writeUInt32LE(pe.bytes.readUInt32LE(pe.optional+8)+length,pe.optional+8);
  pe.section={at,va,size:length,offset};pe.base=offset;pe.rva=va;pe.bytes.writeUInt32LE(va,pe.optional+128);
 }
 const out=Buffer.alloc(pe.section.size-(pe.base-pe.section.offset));
 for(const d of dirs){d.header.copy(out,d.offset);out.writeUInt16LE(d.entries.filter(e=>typeof e.name==='string').length,d.offset+12);out.writeUInt16LE(d.entries.filter(e=>typeof e.name==='number').length,d.offset+14);d.entries.forEach((e,i)=>{const p=d.offset+16+i*8;out.writeUInt32LE(typeof e.name==='string'?(e.nameOffset|0x80000000)>>>0:e.name,p);out.writeUInt32LE(e.node?(e.node.offset|0x80000000)>>>0:e.entryOffset,p+4);});}
 for(const e of strings){out.writeUInt16LE(e.name.length,e.nameOffset);out.write(e.name,e.nameOffset+2,'utf16le');}
 for(const e of leaves){out.writeUInt32LE(pe.rva+e.dataOffset,e.entryOffset);out.writeUInt32LE(e.data.length,e.entryOffset+4);out.writeUInt32LE(e.codepage||0,e.entryOffset+8);e.data.copy(out,e.dataOffset);}
 out.copy(pe.bytes,pe.base);pe.bytes.writeUInt32LE(size,pe.optional+132);pe.bytes.writeUInt32LE(0,pe.optional+64);
 // Resource edits invalidate any Authenticode signature; this build is unsigned.
 pe.bytes.writeUInt32LE(0,pe.optional+144);pe.bytes.writeUInt32LE(0,pe.optional+148);
 fs.writeFileSync(file,pe.bytes);
}
module.exports={parse,patch};
