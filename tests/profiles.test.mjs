import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateProfile} from '../fork/lib/profiles.mjs';
import {validateManifest} from '../fork/lib/manifest.mjs';
const profile=JSON.parse(readFileSync(new URL('../fork/profiles/local-noweb.json',import.meta.url)));
test('local no-search profile pins retained original, provider, model and exact tool allowlist',()=>{assert.equal(validateProfile(profile).version,'1.2.0-original');for(const change of [{track:'latest-approved'},{provider:'cloud'},{tools:profile.tools+',search'},{model:'fallback'}])assert.throws(()=>validateProfile({...profile,...change}));});
test('runtime manifest pins empty patch set, Node checksum, upstream commit and GNU platform',()=>{const m=JSON.parse(readFileSync(new URL('../fork/manifest.json',import.meta.url)));assert.equal(validateManifest(m).upstream.tag,'v1.5.2');for(const change of [{target:'aarch64-linux'},{patches:[{}]},{node:{version:'latest',sha256:m.node.sha256}}])assert.throws(()=>validateManifest({...m,...change}));});
