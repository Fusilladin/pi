import { gunzipSync } from 'node:zlib';
import { mkdirSync,writeFileSync,lstatSync,realpathSync } from 'node:fs';
import { dirname,resolve,join } from 'node:path';
import { validateManifest,invalid,sha256 } from './manifest.mjs';
export function safeDirectory(p){p=resolve(p);if(p!==dirname(p))safeDirectory(dirname(p));try{const s=lstatSync(p);if(!s.isDirectory()||s.isSymbolicLink())throw invalid('Unsafe directory');}catch(e){if(e.code!=='ENOENT')throw e;mkdirSync(p,{mode:0o700});}if(realpathSync(p)!==p)throw invalid('Directory alias refused');return p;}
export function inspectArchive(bytes){
 if(bytes.length>128*1024*1024)throw invalid('Compressed archive limit');
 const tar=gunzipSync(bytes,{maxOutputLength:512*1024*1024}),files=new Map();let o=0;
 const str=(h,a,b)=>h.subarray(a,b).toString('utf8').replace(/\0.*$/s,'');
 const oct=(h,a,b)=>{const s=str(h,a,b).trim();if(!/^[0-7]+$/.test(s))throw invalid('Invalid tar number');return parseInt(s,8);};
 while(o+512<=tar.length&&tar[o]!==0){const h=tar.subarray(o,o+512),prefix=str(h,345,500),name=(prefix?prefix+'/':'')+str(h,0,100),size=oct(h,124,136),mode=oct(h,100,108);const sum=h.reduce((n,b,i)=>n+(i>=148&&i<156?32:b),0);
  if(sum!==oct(h,148,156)||str(h,257,263)!=='ustar'||str(h,263,265)!=='00'||!['0',''].includes(str(h,156,157))||str(h,157,257)||mode&0o7000||!Number.isSafeInteger(size)||files.has(name)||!name||name.startsWith('/')||name.includes('\\')||name.split('/').some(p=>!p||p==='.'||p==='..')||!(/^(node\/bin\/node|bin\/pi|node_modules\/.+|package(?:-lock)?\.json|LICENSE|NODE-LICENSE|NOTICE|FORK-NOTICE\.md|FORK-VERSION|manifest\.json|INVENTORY\.json)$/.test(name)))throw invalid('Unsafe tar entry');
  const end=o+512+size,next=o+512+Math.ceil(size/512)*512;if(end>tar.length||next>tar.length)throw invalid('Truncated archive');files.set(name,{bytes:tar.subarray(o+512,end),mode});o=next;
 }
 if(tar.length-o<1024||tar.subarray(o).some(b=>b!==0))throw invalid('Invalid tar trailer');
 const m=validateManifest(JSON.parse(files.get('manifest.json')?.bytes));
 const inventory=JSON.parse(files.get('INVENTORY.json')?.bytes);const names=[...files.keys()].filter(n=>n!=='INVENTORY.json').sort();
 if(JSON.stringify(names)!==JSON.stringify(Object.keys(inventory).sort()))throw invalid('Inventory mismatch');
 for(const n of names)if(sha256(files.get(n).bytes)!==inventory[n])throw invalid('Payload hash mismatch');
 for(const n of ['bin/pi','node/bin/node','LICENSE','NODE-LICENSE','NOTICE','FORK-NOTICE.md','package-lock.json','node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js'])if(!files.has(n))throw invalid('Incomplete Pi bundle');
 if(files.get('FORK-VERSION')?.bytes.toString().trim()!==m.fork_version||!['bin/pi','node/bin/node'].every(n=>files.get(n).mode&0o111)||sha256(files.get('package-lock.json').bytes)!==m.lockfile_sha256)throw invalid('Runtime identity mismatch');
 return {files,manifest:m};
}
export function safeExtract(bytes,destination){const inspected=inspectArchive(bytes);safeDirectory(dirname(destination));mkdirSync(destination,{mode:0o700});for(const [n,e] of inspected.files){safeDirectory(dirname(join(destination,n)));writeFileSync(join(destination,n),e.bytes,{flag:'wx',mode:e.mode&0o111?0o755:0o644});}return inspected.manifest;}
