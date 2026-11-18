import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {inspectArchive} from '../fork/lib/safe-extract.mjs';
function tar(name,type='0'){const b=Buffer.alloc(1536);b.write(name,0,100);for(const [o,n,v]of [[100,8,'0000644'],[124,12,'00000000000']])b.write(v,o,n);b.fill(32,148,156);b.write(type,156);b.write('ustar\0',257);b.write('00',263);const sum=b.subarray(0,512).reduce((a,v)=>a+v,0);b.write(sum.toString(8).padStart(6,'0')+'\0 ',148,8);return gzipSync(b);}
test('unsafe paths and all link/special tar entries fail before extraction',()=>{for(const [name,type]of [['../payload','0'],['/absolute','0'],['bin/pi','2'],['node_modules/link','1'],['node_modules/device','3']])assert.throws(()=>inspectArchive(tar(name,type)),/Unsafe tar entry/);assert.throws(()=>inspectArchive(Buffer.from('corrupt')));});
