import {readFileSync,lstatSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {sha256,invalid} from './manifest.mjs';
export function verifySupplementalPins({stage,supply}){const pins=JSON.parse(readFileSync(new URL('../npm-supplemental-pins.json',import.meta.url)));let count=0;
 for(const p of pins.entries){const archive=readFileSync(join(supply,'npm-firstparty',p.file));if(sha256(archive)!==p.sha256||createHash('sha512').update(archive).digest('base64')!==p.integrity.replace(/^sha512-/,''))throw invalid('Supplemental npm archive pin changed');const tar=gunzipSync(archive,{maxOutputLength:256*1024*1024});let o=0;
  while(o+512<=tar.length&&tar[o]!==0){const h=tar.subarray(o,o+512),str=(a,b)=>h.subarray(a,b).toString().replace(/\0.*$/s,''),prefix=str(345,500),n=(prefix?prefix+'/':'')+str(0,100),size=parseInt(str(124,136).trim(),8),type=str(156,157);const sum=h.reduce((n,b,i)=>n+(i>=148&&i<156?32:b),0);if(sum!==parseInt(str(148,156).trim(),8)||!['0',''].includes(type)||!n.startsWith('package/')||n.split('/').some(x=>x==='..'||x==='.'||!x)||!Number.isSafeInteger(size)||o+512+size>tar.length)throw invalid('Invalid authenticated npm tar');const file=join(stage,p.packagePath,n.slice(8)),s=lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||sha256(readFileSync(file))!==sha256(tar.subarray(o+512,o+512+size)))throw invalid('Installed first-party package differs from registry pin');o+=512+Math.ceil(size/512)*512;count++;}
  if(JSON.parse(readFileSync(join(stage,p.packagePath,'package.json'))).version!==p.version)throw invalid('Installed first-party version differs');
 }
 return {packages:pins.entries.length,files:count,verified:true};
}
