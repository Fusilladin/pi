import {readFileSync,mkdtempSync,realpathSync} from 'node:fs';
import {dirname,join,basename,resolve} from 'node:path';
import {homedir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {sha256,invalid} from './manifest.mjs';
export function validateOwnerGate({repo,commit,artifactHash,approved,vm,now=Date.now()}){
 if(!/^Fusilladin\/(codex|pi)$/.test(repo??'')||!(/^[a-f0-9]{40}$/.test(commit??''))||/^0+$/.test(commit)||!(/^[a-f0-9]{64}$/.test(artifactHash??''))||!approved)throw invalid('Exact-head owner approval required');
 if(vm?.schema!==3||vm.commit!==commit||vm.artifact_sha256!==artifactHash||vm.verdict!=='PASS'||vm.vm!=='Linux container Debian trixie'||vm.forbidden_vm_touched!==false||!['fresh','update','rollback'].every(k=>vm.steps?.[k]==='PASS'))throw invalid('Exact artifact Linux test required');
 const age=now-Date.parse(vm.at);if(!Number.isFinite(age)||age<0||age>86400000)throw invalid('Fresh Linux test required');
 return true;
}
function run(step,cmd,args,opts={}){const r=spawnSync(cmd,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024,timeout:120000,...opts});if(r.status!==0)throw invalid(`Owner publication step failed: ${step}; draft retained`);return r.stdout;}
// Explicit GET pages work on gh 2.46.0; draft tags are absent from releases/tags.
// Do not stop at the first match: a duplicate must fail closed before publication.
export function listTagReleases(repo,tag,command=run){
 const matches=[];
 for(let page=1;page<=1000;page++){
  const raw=command('find-draft-release','gh',['api',`repos/${repo}/releases?per_page=100&page=${page}`]);
  let releases;try{releases=JSON.parse(raw);}catch{throw invalid('Invalid release listing; draft retained');}
  if(!Array.isArray(releases)||releases.length>100||releases.some(r=>!r||typeof r!=='object'||Array.isArray(r)||typeof r.tag_name!=='string'))throw invalid('Invalid release listing; draft retained');
  matches.push(...releases.filter(r=>r.tag_name===tag));
  if(releases.length<100)return matches;
 }
 throw invalid('Release listing exceeded 1000 pages; draft retained');
}
function remoteTagCommit(repo,tag){
 let object=JSON.parse(run('check-remote-tag','gh',['api',`repos/${repo}/git/ref/tags/${tag}`])).object;
 for(let depth=0;depth<10;depth++){
  if(!/^[a-f0-9]{40}$/.test(object?.sha??''))break;
  if(object.type==='commit')return object.sha;
  if(object.type!=='tag')break;
  object=JSON.parse(run('check-remote-tag','gh',['api',`repos/${repo}/git/tags/${object.sha}`])).object;
 }
 throw invalid('Invalid remote tag; draft retained');
}
export function publishFile(path){path=resolve(path);const e=JSON.parse(readFileSync(path)),checkout=realpathSync(e.checkout),git=(step,...a)=>run(step,'git',['-C',checkout,...a]).trim(),commit=git('read-head','rev-parse','HEAD');if(git('check-worktree','status','--porcelain'))throw invalid('Checkout changed after review');if(git('check-checkout','rev-parse','--show-toplevel')!==checkout)throw invalid('Exact checkout required');const pin=JSON.parse(git('read-release-pin','show',`${commit}:fork/release.json`));if(e.repo!==pin.repo||e.tag!==pin.tag)throw invalid('Release pin mismatch');
 const approved=JSON.parse(readFileSync(join(homedir(),'dev/projects/plans/_run/commit-review/approvals.json')))[basename(checkout)]?.[commit];const vm=JSON.parse(readFileSync(e.vmtest));validateOwnerGate({repo:e.repo,commit,artifactHash:pin.artifact_sha256,approved,vm});
 const immutable=JSON.parse(run('check-immutable-releases','gh',['api',`repos/${e.repo}/immutable-releases`]));if(immutable.enabled!==true)throw invalid('Immutable releases must be enabled');
 if(remoteTagCommit(e.repo,e.tag)!==commit)throw invalid('Remote tag differs from approved commit');
 const matches=listTagReleases(e.repo,e.tag);if(matches.length!==1)throw invalid('Expected exactly one matching release; draft retained');const draft=matches[0];if(draft.draft!==true)throw invalid('Release must still be a draft');if(!Array.isArray(draft.assets))throw invalid('Invalid draft assets; draft retained');const expected=[pin.artifact,'SHA256SUMS','manifest.json'].sort();if(JSON.stringify(draft.assets.map(a=>a.name).sort())!==JSON.stringify(expected))throw invalid('Draft asset set differs');
 const dir=mkdtempSync(join(dirname(path),'publish-verify-'));run('download-draft-assets','gh',['release','download',e.tag,'--repo',e.repo,'--dir',dir]);if(sha256(readFileSync(join(dir,pin.artifact)))!==pin.artifact_sha256)throw invalid('Draft artifact bytes changed');const lines=readFileSync(join(dir,'SHA256SUMS'),'utf8').trim().split(/\r?\n/);if(!lines.includes(`${pin.artifact_sha256}  ${pin.artifact}`))throw invalid('Draft checksums changed');const manifest=JSON.parse(readFileSync(join(dir,'manifest.json')));const committed=JSON.parse(git('read-manifest','show',`${commit}:fork/manifest.json`));if(JSON.stringify(manifest)!==JSON.stringify(committed))throw invalid('Draft manifest changed');
 // Publication always runs the public-scope guard.
 run('public-pre-push-guard',process.execPath,[join(homedir(),'dev/projects/plans/_run/guard/guard.mjs'),'pre-push','--scope','public','origin',`https://github.com/${e.repo}.git`],{cwd:checkout,input:`refs/heads/fork ${commit} refs/heads/fork ${commit}\n`});
 run('publish-draft-release','gh',['release','edit',e.tag,'--repo',e.repo,'--draft=false','--latest=false']);return {state:'published',repo:e.repo,tag:e.tag,commit,artifactHash:pin.artifact_sha256};
}
