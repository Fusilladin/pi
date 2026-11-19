import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { publishFile, validateOwnerGate } from '../fork/lib/publish.mjs';
import { sha256 } from '../fork/lib/manifest.mjs';

const fork = JSON.parse(readFileSync(new URL('../fork/manifest.json', import.meta.url))).fork;

// Only synthetic commands run: no GitHub, real Git, approvals or host guard.
function fixture(t) {
  const scratch = '/tmp/t85/publish-harden-20261118';
  mkdirSync(scratch, { recursive: true });
  const root = mkdtempSync(join(scratch, 'publish-'));
  const home = join(root, 'home');
  const checkout = join(home, fork + '-fork');
  const bin = join(root, 'bin');
  mkdirSync(checkout, { recursive: true });
  mkdirSync(bin);
  const commit = 'a'.repeat(40);
  const artifact = 'synthetic.tar.gz';
  const artifactBytes = 'synthetic archive bytes';
  const pin = { repo: 'Fusilladin/' + fork, tag: 'fork-1.2.3-p0', artifact,
    artifact_sha256: sha256(artifactBytes) };
  const vm = { schema: 3, commit, artifact_sha256: pin.artifact_sha256,
    verdict: 'PASS', vm: 'Linux container Debian trixie',
    forbidden_vm_touched: false, at: new Date().toISOString(),
    steps: { fresh: 'PASS', update: 'PASS', rollback: 'PASS' } };
  const evidence = join(root, 'publish.json');
  writeFileSync(join(root, 'vm.json'), JSON.stringify(vm));
  writeFileSync(evidence, JSON.stringify({ repo: pin.repo, tag: pin.tag,
    checkout, vmtest: join(root, 'vm.json') }));
  const review = join(home, 'dev/projects/plans/_run/commit-review');
  mkdirSync(review, { recursive: true });
  writeFileSync(join(review, 'approvals.json'), JSON.stringify({
    [fork + '-fork']: { [commit]: true },
  }));
  const guard = join(home, 'dev/projects/plans/_run/guard/guard.mjs');
  mkdirSync(dirname(guard), { recursive: true });
  writeFileSync(guard, `import {appendFileSync} from 'node:fs';
    appendFileSync(process.env.PUBLISH_FIXTURE_LOG, JSON.stringify(['guard', ...process.argv.slice(2)])+'\\n');
    if(process.env.PUBLISH_FIXTURE_FAIL==='guard') { console.error('PRIVATE-DETAIL'); process.exit(1); }
  `);
  const data = { commit, checkout, pin, artifactBytes, manifest: { synthetic: true } };
  const dataPath = join(root, 'data.json');
  writeFileSync(dataPath, JSON.stringify(data));
  const script = `#!${process.execPath}
import {appendFileSync,readFileSync,writeFileSync} from 'node:fs';
import {basename,join} from 'node:path';
const d=JSON.parse(readFileSync(process.env.PUBLISH_FIXTURE_DATA));
const args=process.argv.slice(2),command=basename(process.argv[1]);
appendFileSync(process.env.PUBLISH_FIXTURE_LOG,JSON.stringify([command,...args])+'\\n');
let step,output;
if(command==='git') {
 const a=args.slice(2),key=a.join(' ');
 const results={
  'rev-parse HEAD':['read-head',d.commit],
  'status --porcelain':['check-worktree',''],
  'rev-parse --show-toplevel':['check-checkout',d.checkout],
  ['show '+d.commit+':fork/release.json']:['read-release-pin',JSON.stringify(d.pin)],
  ['show '+d.commit+':fork/manifest.json']:['read-manifest',JSON.stringify(d.manifest)]
 };
 [step,output]=results[key]??['unexpected-git',null];
} else if(args[0]==='api') {
 const route=args[1];
 if(route.endsWith('/immutable-releases')) {step='check-immutable-releases';output=JSON.stringify({enabled:true});}
 else if(route.includes('/git/ref/tags/')) {step='check-remote-tag';output=JSON.stringify({object:d.annotated?{type:'tag',sha:'c'.repeat(40)}:{type:'commit',sha:d.commit}});}
 else if(route.includes('/git/tags/')) {step='check-remote-tag';output=JSON.stringify({object:{type:'commit',sha:d.commit}});}
 else if(route.includes('/releases?per_page=100&page=')) {
  step='find-draft-release';
  const release={tag_name:d.pin.tag,draft:d.draft??true,assets:[d.pin.artifact,'SHA256SUMS','manifest.json'].map(name=>({name}))};
  const page=Number(route.split('page=').at(-1));
  output=JSON.stringify(page===1?Array.from({length:100},(_,i)=>({tag_name:'unrelated-'+i,draft:true})):d.missing?[]:[release,...(d.duplicate?[release]:[])]);
  if(d.invalidListing)output='{}';

 }
} else if(args[0]==='release'&&args[1]==='download') {
 step='download-draft-assets';output='';
 if(process.env.PUBLISH_FIXTURE_FAIL!==step) {
  const dir=args[args.indexOf('--dir')+1];
  writeFileSync(join(dir,d.pin.artifact),d.artifactBytes);
  writeFileSync(join(dir,'SHA256SUMS'),d.pin.artifact_sha256+'  '+d.pin.artifact+'\\n');
  writeFileSync(join(dir,'manifest.json'),JSON.stringify(d.manifest));
 }
} else if(args[0]==='release'&&args[1]==='edit') {step='publish-draft-release';output='';}
if(!step||output===null||process.env.PUBLISH_FIXTURE_FAIL===step) {console.error('PRIVATE-DETAIL');process.exit(1);}
process.stdout.write(output);
`;
  for (const name of ['git', 'gh']) writeFileSync(join(bin, name), script, { mode: 0o755 });
  const env = { HOME: home, PATH: bin, PUBLISH_FIXTURE_DATA: dataPath,
    PUBLISH_FIXTURE_LOG: join(root, 'commands.jsonl'), PUBLISH_FIXTURE_FAIL: '' };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    const archive = join(scratch, '_archive');
    mkdirSync(archive, { recursive: true });
    renameSync(root, join(archive, root.split('/').at(-1)));
  });
  return { evidence, data, save: () => writeFileSync(dataPath, JSON.stringify(data)),
    commands: () => readFileSync(env.PUBLISH_FIXTURE_LOG, 'utf8').trim().split('\n').map(JSON.parse) };
}

test('publication finds a draft on a later releases page and keeps the publication checks', t => {
  const f = fixture(t);
  f.data.annotated = true; f.save();
  assert.equal(publishFile(f.evidence).state, 'published');
  const commands = f.commands();
  assert.deepEqual(commands.filter(a => a[0] === 'gh' && a[1] === 'api' && a[2].includes('/releases?')).map(a=>a[2]),
    [1,2].map(page=>`repos/${f.data.pin.repo}/releases?per_page=100&page=${page}`));
  assert.equal(commands.some(a=>a.includes('--slurp')||a.includes('--paginate')),false);
  assert.equal(commands.some(a => a.some(v => v.includes('/releases/tags/'))), false);
  assert.ok(commands.some(a => a[0] === 'guard' && a.includes('public')));
  assert.deepEqual(commands.at(-1), ['gh', 'release', 'edit', f.data.pin.tag,
    '--repo', f.data.pin.repo, '--draft=false', '--latest=false']);
});

test('command failures name only a fixed step and retain the draft', t => {
  const f = fixture(t);
  for (const step of ['read-head', 'check-worktree', 'check-checkout', 'read-release-pin',
    'check-immutable-releases', 'check-remote-tag', 'find-draft-release',
    'download-draft-assets', 'read-manifest', 'guard', 'publish-draft-release']) {
    process.env.PUBLISH_FIXTURE_FAIL = step;
    const label = step === 'guard' ? 'public-pre-push-guard' : step;
    assert.throws(() => publishFile(f.evidence), error => {
      assert.equal(error.state, 'invalid-input');
      assert.equal(error.message, `Owner publication step failed: ${label}; draft retained`);
      assert.equal(error.message.includes('PRIVATE-DETAIL'), false);
      return true;
    });
  }
  assert.equal(f.commands().some(a => a.includes('--draft=false')),
    true, 'only the explicit final-step failure attempts publication');
});

test('missing, duplicate and already published matching releases fail before download', t => {
  const f = fixture(t);
  for (const change of [{ missing: true }, { duplicate: true }, { draft: false }, { invalidListing: true }]) {
    Object.assign(f.data, { missing: false, duplicate: false, draft: true, invalidListing: false }, change);
    f.save();
    assert.throws(() => publishFile(f.evidence), { state: 'invalid-input' });
  }
  assert.equal(f.commands().some(a => a[1] === 'release'), false);
});

test('owner approval and fresh exact artifact evidence remain mandatory', () => {
  const now = Date.now(), commit = 'a'.repeat(40), artifactHash = 'b'.repeat(64);
  const input = { repo: 'Fusilladin/pi', commit, artifactHash, approved: true, now,
    vm: { schema: 3, commit, artifact_sha256: artifactHash, verdict: 'PASS',
      vm: 'Linux container Debian trixie', forbidden_vm_touched: false,
      at: new Date(now).toISOString(), steps: { fresh: 'PASS', update: 'PASS', rollback: 'PASS' } } };
  assert.equal(validateOwnerGate(input), true);
  for (const change of [{ approved: false }, { artifactHash: 'c'.repeat(64) },
    { vm: { ...input.vm, commit: 'c'.repeat(40) } },
    { vm: { ...input.vm, at: new Date(now - 86400001).toISOString() } },
    { vm: { ...input.vm, steps: { fresh: 'PASS', update: 'PASS' } } }]) {
    assert.throws(() => validateOwnerGate({ ...input, ...change }), { state: 'invalid-input' });
  }
});
