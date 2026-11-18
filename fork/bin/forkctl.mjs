#!/usr/bin/env node
import {realpathSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {install,rollback,adoptOriginal,status,list,runOld,recoverInstall} from '../lib/install.mjs';
import {profileInit,setVersion,profileRun} from '../lib/profiles.mjs';
export async function main(args){const [cmd,...rest]=args;if(!cmd||cmd==='--help')return {help:'forkctl install|adopt-original|rollback|recover|status|list|run --home DIR; profile-init --home DIR --guard FILE; profile-set-version --home DIR --version V; profile-run --home DIR [-- ARGS]; publish --evidence FILE'};const opts={};let pass=[];for(let i=0;i<rest.length;i++){if(rest[i]==='--'){pass=rest.slice(i+1);break;}const key=rest[i].slice(2);if(!rest[i].startsWith('--')||key in opts||!['home','directory','archive','sha256','version','isolated','guard','evidence','supply','stage','output','offline'].includes(key))throw Error('Unknown option');if(['isolated','offline'].includes(key))opts[key]=true;else {if(!rest[i+1]||rest[i+1].startsWith('--'))throw Error('Missing value');opts[key]=rest[++i];}}
 if(cmd==='build')return (await import('../lib/build-pi.mjs')).buildPi(opts);
 if(cmd==='package')return (await import('../lib/build-pi.mjs')).packageRuntime(opts);
 if(cmd==='publish')return (await import('../lib/publish.mjs')).publishFile(opts.evidence);
 if(!opts.home)throw Error('Explicit --home required');
 if(cmd==='profile-run'){const spec=profileRun({...opts,args:pass});const p=spawnSync(spec.node,spec.argv,{env:spec.env,cwd:spec.cwd,stdio:'inherit'});process.exitCode=p.status??1;return;}
 const f={install,rollback,'adopt-original':adoptOriginal,status,list,run:runOld,recover:recoverInstall,'profile-init':profileInit,'profile-set-version':setVersion}[cmd];if(!f)throw Error('Command not implemented');return f(opts);
}
if(process.argv[1]&&realpathSync(process.argv[1])===fileURLToPath(import.meta.url)){try{const r=await main(process.argv.slice(2));if(r!==undefined)console.log(JSON.stringify(r));}catch(e){console.error(JSON.stringify({state:'invalid-input',message:e.message}));process.exitCode=64;}}
