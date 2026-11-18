import { createHash } from 'node:crypto';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const invalid = message => Object.assign(new Error(message), {state:'invalid-input'});
export const versionOK = v => /^\d+\.\d+\.\d+-(?:p\d+|original)$/.test(v??'');
export function validateManifest(m) {
  if(m?.schema!==1 || m.fork!=='pi' || !versionOK(m.fork_version) || m.target!=='x86_64-unknown-linux-gnu' || m.node?.version!=='22.23.3' || !/^[a-f0-9]{64}$/.test(m.node.sha256??'') || m.upstream?.tag!=='v1.5.2' || !/^[a-f0-9]{40}$/.test(m.upstream.commit??'') || m.patches?.length!==0) throw invalid('Invalid pinned Pi manifest');
  return m;
}
export const candidateKey = m => sha256(JSON.stringify([m.fork,m.upstream.commit,m.patches,m.target,m.node]));
export const inputRevision = m => sha256(JSON.stringify(validateManifest(m)));
