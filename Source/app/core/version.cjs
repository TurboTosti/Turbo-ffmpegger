// Public release numbering. Short Git tags (v1.0-alpha) normalize to SemVer
// package versions (1.0.0-alpha); display labels remain friendly (1.0 alpha).
function parseVersion(value){
 if(typeof value!=='string')return null;
 const m=/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?(?:-(alpha|beta|rc)(?:\.(0|[1-9]\d*))?)?$/.exec(value);
 if(!m)return null;
 const numbers=[Number(m[1]),Number(m[2]),Number(m[3]||0)],sequence=m[5]===undefined?null:Number(m[5]);
 if(!numbers.every(Number.isSafeInteger)||(sequence!==null&&!Number.isSafeInteger(sequence)))return null;
 const channel=m[4]||null,canonical=numbers.join('.')+(channel?'-'+channel+(sequence===null?'':'.'+sequence):'');
 return {numbers,channel,sequence,canonical};
}
function newer(a,b){
 a=parseVersion(a);b=parseVersion(b);if(!a||!b)return false;
 for(let i=0;i<3;i++)if(a.numbers[i]!==b.numbers[i])return a.numbers[i]>b.numbers[i];
 const rank={alpha:0,beta:1,rc:2,stable:3},ar=rank[a.channel||'stable'],br=rank[b.channel||'stable'];
 if(ar!==br)return ar>br;
 return (a.sequence??-1)>(b.sequence??-1);
}
function displayVersion(value){
 const p=parseVersion(value);if(!p)return value;
 return p.numbers.slice(0,p.numbers[2]===0?2:3).join('.')+(p.channel?' '+p.channel+(p.sequence===null?'':' '+p.sequence):'');
}
// Private checkpoint builds used 2.0.0–2.0.5 before the public numbering was
// chosen. Their old Data pointers must not hijack a manually copied 1.0 alpha.
// New updater pointers carry a scheme marker, so future public 2.x still works.
const VERSION_SCHEME='public-v1';
function shouldResumeUpdate(active,current,platform){
 if(!active||active.platform!==platform||typeof active.folder!=='string')return false;
 if(active.versionScheme!==VERSION_SCHEME&&/^2\.0\.[0-5]$/.test(active.version))return false;
 return newer(active.version,current);
}
module.exports={parseVersion,newer,displayVersion,shouldResumeUpdate,VERSION_SCHEME};
