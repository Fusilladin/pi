import { candidateKey, inputRevision, validateManifest, invalid } from './manifest.mjs';

// Publication is an injected owner transport. There is no default network client.
export function publicationIdentity({ manifest, commit, artifactHash, draftId }) {
  validateManifest(manifest);
  if (manifest.production_ready !== true || !/^[a-f0-9]{40}$/.test(commit ?? '') || !/^[a-f0-9]{64}$/.test(artifactHash ?? '') || !/^[1-9]\d*$/.test(String(draftId ?? ''))) throw invalid('Pinned release identity required');
  return { key: candidateKey(manifest), inputHash: inputRevision(manifest), commit, artifactHash, draftId: String(draftId) };
}
export function validatePublication({ identity, candidate, review, draft, artifact, vm, now = Date.now() }) {
  if (!identity || !['key', 'inputHash', 'artifactHash'].every(k => typeof identity[k] === 'string' && /^[a-f0-9]{64}$/.test(identity[k])) || typeof identity.commit !== 'string' || !/^[a-f0-9]{40}$/.test(identity.commit) || /^0+$/.test(identity.commit) || typeof identity.draftId !== 'string' || !/^[1-9]\d*$/.test(identity.draftId)) throw invalid('Exact publication identity required');
  const same = record => record && ['key', 'inputHash', 'commit', 'artifactHash', 'draftId'].every(k => record[k] === identity[k]);
  if (![candidate, review, draft, artifact, vm].every(same) || candidate.state !== 'validated' || review.verdict !== 'PASS' || draft.draft !== true || artifact.verified !== true || vm.verdict !== 'PASS' || !['fresh', 'update', 'rollback'].every(k => vm.steps?.[k] === 'PASS')) throw invalid('Review/artifact/VM identity gate refused');
  const age = now - Date.parse(vm.at);
  if (!Number.isFinite(age) || age < 0 || age > 24 * 60 * 60 * 1000) throw invalid('Fresh VM evidence required');
  if (vm.vm === 'windows-11-ic' || !vm.vm) throw invalid('Permitted disposable VM required');
  return identity;
}
export async function publish(evidence, transport) {
  validatePublication(evidence);
  if (!transport) throw invalid('Explicit owner publication transport required');
  return transport.publishDraft(evidence);
}
