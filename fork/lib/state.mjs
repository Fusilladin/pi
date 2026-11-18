import { mkdirSync, writeFileSync, readFileSync, renameSync, openSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
export function readJSON(path,fallback) {try{return JSON.parse(readFileSync(path,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
export function atomicJSON(path,value){const p=`${path}.${randomUUID()}.pending`;writeFileSync(p,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});renameSync(p,path);}
export function withLock(root,key,fn){mkdirSync(join(root,'locks'),{recursive:true});const p=join(root,'locks',key);let fd;try{fd=openSync(p,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw Error('Busy; existing lock retained');throw e;}writeFileSync(fd,JSON.stringify({pid:process.pid,at:new Date().toISOString()}));try{return fn();}finally{closeSync(fd);const a=join(root,'locks','_archive');mkdirSync(a,{recursive:true});renameSync(p,join(a,randomUUID()+'.json'));}}
