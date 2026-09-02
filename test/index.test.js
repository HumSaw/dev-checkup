import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { actions, env, caseCheck, shape, shapeDiff, scrub, boundaries, readme, weight, licenses, shuffle } from '../src/index.js'
const cli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../bin/dev-checkup.js')
const fixture = () => fs.mkdtempSync(path.join(os.tmpdir(),'dev-checkup-'))
const put=(root,file,text)=>{const full=path.join(root,file);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,text);return full}
test('actions flags mutable refs and missing permissions',()=>{const r=fixture();put(r,'.github/workflows/ci.yml','steps:\n - uses: actions/checkout@v4');assert.deepEqual(actions(r).map(x=>x.rule),['explicit-permissions','immutable-ref'])})
test('env reports missing and stale contracts',()=>{const r=fixture();put(r,'.env.example','OLD=\n');put(r,'app.js','process.env.API_KEY');assert.deepEqual(env(r).map(x=>x.rule),['missing-env','stale-env'])})
test('case detects collisions',()=>{const r=fixture();put(r,'A.txt','');put(r,'a.txt','');assert.equal(caseCheck(r)[0].rule,'case-collision')})
test('shape captures and classifies drift',()=>{const base=shape({id:1,name:'x'});assert.equal(shapeDiff(base,shape({id:'1',extra:true})).filter(x=>x.rule==='shape-breaking').length,2)})
test('scrub recursively redacts keys',()=>assert.deepEqual(scrub({token:'x',nested:{email:'a'}}),{token:'[REDACTED]',nested:{email:'[REDACTED]'}}))
test('boundaries enforce denied imports',()=>{const r=fixture();put(r,'ui/a.js',"import db from '../db'");assert.equal(boundaries(r,{deny:{ui:['../db']}}).length,1)})
test('readme finds missing local links',()=>{const r=fixture();put(r,'README.md','[guide](docs/nope.md)');assert.equal(readme(r)[0].rule,'broken-link')})
test('weight sorts large files',()=>{const r=fixture();put(r,'big.bin','12345');assert.equal(weight(r,4)[0].bytes,5)})
test('licenses flag review licenses',()=>{const r=fixture();put(r,'node_modules/x/package.json',JSON.stringify({name:'x',license:'GPL-3.0'}));assert.equal(licenses(r)[0].license,'GPL-3.0')})
test('shuffle is deterministic and preserves values',()=>{const a=shuffle(['a','b','c'],'42');assert.deepEqual(a,shuffle(['a','b','c'],'42'));assert.deepEqual([...a].sort(),['a','b','c'])})
test('CLI shape capture reads the requested file',()=>{const r=fixture();const file=put(r,'payload.json',JSON.stringify({id:1}));const run=spawnSync(process.execPath,[cli,'shape','capture',file,'--json'],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout),{object:{id:'number'}})})
test('CLI webhooks reads the requested file',()=>{const r=fixture();const file=put(r,'event.json',JSON.stringify({token:'secret',ok:true}));const run=spawnSync(process.execPath,[cli,'webhooks',file,'--json'],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout),{token:'[REDACTED]',ok:true})})
test('CLI reports findings with exit code 1',()=>{const r=fixture();put(r,'README.md','[missing](nope.md)');const run=spawnSync(process.execPath,[cli,'readme',r,'--json'],{encoding:'utf8'});assert.equal(run.status,1);assert.equal(JSON.parse(run.stdout)[0].rule,'broken-link')})
