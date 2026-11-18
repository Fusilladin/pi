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
function run(cmd,args,opts={}){const r=spawnSync(cmd,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024,timeout:120000,...opts});if(r.status!==0)throw invalid('Owner publication command failed; draft retained');return r.stdout;}
export function publishFile(path){path=resolve(path);const e=JSON.parse(readFileSync(path)),checkout=realpathSync(e.checkout),git=(...a)=>run('git',['-C',checkout,...a]).trim(),commit=git('rev-parse','HEAD');if(git('status','--porcelain'))throw invalid('Checkout changed after review');if(git('rev-parse','--show-toplevel')!==checkout)throw invalid('Exact checkout required');const pin=JSON.parse(git('show',`${commit}:fork/release.json`));if(e.repo!==pin.repo||e.tag!==pin.tag)throw invalid('Release pin mismatch');
 const approved=JSON.parse(readFileSync(join(homedir(),'dev/projects/plans/_run/commit-review/approvals.json')))[basename(checkout)]?.[commit];const vm=JSON.parse(readFileSync(e.vmtest));validateOwnerGate({repo:e.repo,commit,artifactHash:pin.artifact_sha256,approved,vm});
 const immutable=JSON.parse(run('gh',['api',`repos/${e.repo}/immutable-releases`]));if(immutable.enabled!==true)throw invalid('Immutable releases must be enabled');
 const ref=JSON.parse(run('gh',['api',`repos/${e.repo}/git/ref/tags/${e.tag}`]));if(ref.object?.type!=='commit'||ref.object.sha!==commit)throw invalid('Remote tag differs from approved commit');const draft=JSON.parse(run('gh',['api',`repos/${e.repo}/releases/tags/${e.tag}`]));if(draft.draft!==true)throw invalid('Release must still be a draft');const expected=[pin.artifact,'SHA256SUMS','manifest.json'].sort();if(JSON.stringify(draft.assets.map(a=>a.name).sort())!==JSON.stringify(expected))throw invalid('Draft asset set differs');
 const dir=mkdtempSync(join(dirname(path),'publish-verify-'));run('gh',['release','download',e.tag,'--repo',e.repo,'--dir',dir]);if(sha256(readFileSync(join(dir,pin.artifact)))!==pin.artifact_sha256)throw invalid('Draft artifact bytes changed');const lines=readFileSync(join(dir,'SHA256SUMS'),'utf8').trim().split(/\r?\n/);if(!lines.includes(`${pin.artifact_sha256}  ${pin.artifact}`))throw invalid('Draft checksums changed');const manifest=JSON.parse(readFileSync(join(dir,'manifest.json')));const committed=JSON.parse(git('show',`${commit}:fork/manifest.json`));if(JSON.stringify(manifest)!==JSON.stringify(committed))throw invalid('Draft manifest changed');
 // Public-scope guard is mandatory even while the repository remains private.
 run(process.execPath,[join(homedir(),'dev/projects/plans/_run/guard/guard.mjs'),'pre-push','--scope','public','origin',`https://github.com/${e.repo}.git`],{cwd:checkout,input:`refs/heads/fork ${commit} refs/heads/fork ${commit}\n`});
 run('gh',['release','edit',e.tag,'--repo',e.repo,'--draft=false','--latest=false']);return {state:'published',repo:e.repo,tag:e.tag,commit,artifactHash:pin.artifact_sha256};
}
