import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {invalid,versionOK} from './manifest.mjs';
import {safeDirectory} from './safe-extract.mjs';
import {readJSON,atomicJSON} from './state.mjs';
const tools='read,bash,edit,write,grep,find,ls';
export function validateProfile(p){if(p?.schema!==1||p.name!=='local-noweb'||p.track!=='pinned'||!versionOK(p.version)||p.provider!=='strata'||p.model!=='qwen3.8-flash-next-iq3_xxs'||p.tools!==tools)throw invalid('Invalid pinned no-search profile');return p;}
export function profileInit({home,guard}){home=resolve(home);const root=join(home,'.local/share/pi-fork'),path=join(root,'profiles/local-noweb');safeDirectory(path);const config=join(path,'profile.json');if(existsSync(config))return validateProfile(readJSON(config));if(!guard)throw invalid('Explicit guard required');const p=validateProfile({schema:1,name:'local-noweb',track:'pinned',version:'1.2.0-original',provider:'strata',model:'qwen3.8-flash-next-iq3_xxs',tools,guard:resolve(guard)});if(!existsSync(p.guard))throw invalid('Guard unavailable');atomicJSON(config,p);return p;}
export function setVersion({home,version}){if(!versionOK(version))throw invalid('Invalid version');const root=join(resolve(home),'.local/share/pi-fork');if(!readJSON(join(root,'state.json'))?.versions[version])throw invalid('Version not retained');const f=join(root,'profiles/local-noweb/profile.json'),p=validateProfile(readJSON(f));p.version=version;atomicJSON(f,p);return p;}
export function profileRun({home,args=[],baseUrl='http://127.0.0.1:8080/v1',guardOverride}){home=resolve(home);const root=join(home,'.local/share/pi-fork'),p=validateProfile(readJSON(join(root,'profiles/local-noweb/profile.json'))),r=readJSON(join(root,'state.json'))?.versions[p.version];if(!r)throw invalid('Pinned Pi unavailable');const guard=guardOverride??p.guard;
 for(let i=0;i<args.length;i++){
  const arg=args[i];if(!arg.startsWith('-'))continue;
  if(['--print','-p','--no-session'].includes(arg))continue;
  if(arg==='--mode'&&['text','json'].includes(args[i+1])){i++;continue;}
  throw invalid('Profile selection and tool overrides refused');
 }
 if(!/^http:\/\/127\.0\.0\.1:(?:8080|1970[0-9]|1971[0-9])\/v1$/.test(baseUrl))throw invalid('Loopback provider required');
 const dir=join(root,'profiles/local-noweb/runs',randomUUID());safeDirectory(dir);const agent=join(dir,'agent');safeDirectory(agent);
 const model={id:p.model,name:p.model,reasoning:false,input:['text'],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:65536,maxTokens:8192};
 atomicJSON(join(agent,'models.json'),{providers:{strata:{baseUrl,api:'openai-completions',apiKey:'local',models:[model]}}});
 const node=join(r.path,r.original?'node_modules/node/bin/node':'node/bin/node'),cli=join(r.path,'node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js');
 const env={PATH:process.env.PATH,HOME:dir,PI_CODING_AGENT_DIR:agent,PI_OFFLINE:'1',TERM:process.env.TERM??'xterm-256color'};
 return {node,argv:[cli,'--provider',p.provider,'--model',p.model,'--no-extensions','-e',guard,'--no-mcp','--no-skills','--offline','--tools',p.tools,'--session-dir',join(dir,'sessions'),...args],env,cwd:dir};
}
