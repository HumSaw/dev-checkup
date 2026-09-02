import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const SKIP = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.venv', 'target', 'coverage'])
const SOURCE = /\.(?:[cm]?[jt]sx?|py|go|rs)$/

function walk(root, visit) {
  if (!fs.existsSync(root)) return
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue
    const file = path.join(root, entry.name)
    entry.isDirectory() ? walk(file, visit) : visit(file)
  }
}
function finding(rule, file, message, extra = {}) { return { rule, file, message, ...extra } }
export function actions(root) {
  const out = []; const dir = path.join(root, '.github', 'workflows')
  walk(dir, file => {
    if (!/\.ya?ml$/.test(file)) return
    const rel = path.relative(root, file); const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
    if (!lines.some(line => /^permissions\s*:/.test(line.trim()))) out.push(finding('explicit-permissions', rel, 'Declare top-level permissions explicitly', { line: 1 }))
    lines.forEach((line, index) => { const match = line.match(/uses:\s*([^\s#]+)/); if (match && !/@[0-9a-f]{40}$/i.test(match[1])) out.push(finding('immutable-ref', rel, 'Pin action to a full commit SHA', { line: index + 1, value: match[1] })) })
  }); return out
}
export function env(root, example = '.env.example') {
  const declared = new Set(); const envFile = path.join(root, example)
  if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/); if (m) declared.add(m[1]) }
  const used = new Set(); const patterns = [/process\.env\.([A-Z][A-Z0-9_]*)/g, /os\.environ(?:\.get)?\(["']([A-Z][A-Z0-9_]*)/g, /os\.Getenv\(["']([A-Z][A-Z0-9_]*)/g]
  walk(root, file => { if (!SOURCE.test(file)) return; const text = fs.readFileSync(file, 'utf8'); for (const regex of patterns) for (const m of text.matchAll(regex)) used.add(m[1]) })
  return [...used].filter(key => !declared.has(key)).map(key => finding('missing-env', example, `${key} is used but not documented`, { key })).concat([...declared].filter(key => !used.has(key)).map(key => finding('stale-env', example, `${key} is documented but not detected in source`, { key }))).sort((a,b) => a.key.localeCompare(b.key))
}
export function caseCheck(root) {
  const names = new Map(); const out = []
  walk(root, file => { const rel = path.relative(root, file).split(path.sep).join('/'); const key = rel.toLowerCase(); if (names.has(key) && names.get(key) !== rel) out.push(finding('case-collision', rel, `Conflicts with ${names.get(key)}`, { other: names.get(key) })); else names.set(key, rel) })
  walk(root, file => { if (!SOURCE.test(file)) return; const rel = path.relative(root, file); const text = fs.readFileSync(file, 'utf8'); for (const m of text.matchAll(/(?:from\s+|require\()["'](\.{1,2}\/[^"']+)["']/g)) { const target = path.resolve(path.dirname(file), m[1]); const parent = path.dirname(target); const wanted = path.basename(target).toLowerCase(); if (fs.existsSync(parent)) { const actual = fs.readdirSync(parent).find(name => name.toLowerCase() === wanted && name !== path.basename(target)); if (actual) out.push(finding('case-mismatch', rel, `${m[1]} differs from on-disk ${actual}`)) } } })
  return out
}
export function shape(value) { if (Array.isArray(value)) return { array: value.length ? shape(value[0]) : 'unknown' }; if (value && typeof value === 'object') return { object: Object.fromEntries(Object.keys(value).sort().map(key => [key, shape(value[key])])) }; if (value === null) return 'null'; return typeof value === 'number' ? 'number' : typeof value }
export function shapeDiff(oldValue, newValue, at = '$') {
  if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return []
  if (oldValue?.object && newValue?.object) { const out = []; for (const key of Object.keys(oldValue.object)) if (!(key in newValue.object)) out.push(finding('shape-breaking', at + '.' + key, 'Field removed')); for (const key of Object.keys(newValue.object)) if (!(key in oldValue.object)) out.push(finding('shape-additive', at + '.' + key, 'Field added')); for (const key of Object.keys(oldValue.object)) if (key in newValue.object) out.push(...shapeDiff(oldValue.object[key], newValue.object[key], at + '.' + key)); return out }
  return [finding('shape-breaking', at, 'Type changed', { from: oldValue, to: newValue })]
}
export function scrub(value, extras = []) { const keys = new Set(['authorization','token','secret','password','cookie','signature','email', ...extras.map(x => x.toLowerCase())]); if (Array.isArray(value)) return value.map(item => scrub(item, extras)); if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,val]) => [key, keys.has(key.toLowerCase()) ? '[REDACTED]' : scrub(val, extras)])); return value }
export function boundaries(root, policy) {
  const out = []; for (const [scope, denied] of Object.entries(policy.deny ?? {})) { walk(path.join(root, scope), file => { if (!SOURCE.test(file)) return; const rel = path.relative(root, file); fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => { for (const item of denied) if (line.includes(`from '${item}`) || line.includes(`from "${item}`) || line.includes(`require('${item}`)) out.push(finding('denied-import', rel, `${scope} may not import ${item}`, { line: index + 1, scope, denied: item })) }) }) } return out
}
export function readme(root) {
  const out = []; walk(root, file => { if (!/\.md$/i.test(file)) return; const text = fs.readFileSync(file, 'utf8'); for (const m of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) { const ref = m[1].trim().split(/[?#]/)[0]; if (!ref || /^(?:https?:|mailto:|#)/i.test(ref)) continue; const decoded = decodeURIComponent(ref.replace(/^<|>$/g, '')); if (!fs.existsSync(path.resolve(path.dirname(file), decoded))) out.push(finding('broken-link', path.relative(root, file), `Missing local target: ${ref}`, { target: ref })) } }); return out
}
export function weight(root, limit = 1024 * 1024) {
  const out = []; walk(root, file => { const size = fs.statSync(file).size; if (size >= limit) out.push(finding('large-file', path.relative(root, file), `${size} bytes`, { bytes: size })) }); return out.sort((a,b) => b.bytes - a.bytes)
}
export function licenses(root) {
  const lock = path.join(root, 'node_modules'); const out = []; if (!fs.existsSync(lock)) return out
  for (const name of fs.readdirSync(lock)) { if (name.startsWith('.')) continue; const dirs = name.startsWith('@') ? fs.readdirSync(path.join(lock,name)).map(n => path.join(lock,name,n)) : [path.join(lock,name)]; for (const dir of dirs) { const pkg = path.join(dir,'package.json'); if (!fs.existsSync(pkg)) continue; try { const data=JSON.parse(fs.readFileSync(pkg,'utf8')); const license=typeof data.license==='string'?data.license:'UNKNOWN'; if (!/^(MIT|ISC|BSD-[23]-Clause|Apache-2\.0|0BSD|CC0-1\.0)$/i.test(license)) out.push(finding('license-review', data.name ?? path.basename(dir), `Review license: ${license}`, { license })) } catch {} } } return out
}
export function shuffle(items, seed = 'dev-checkup') { return [...items].map((value,index)=>({value,key:crypto.createHash('sha256').update(`${seed}:${index}:${value}`).digest('hex')})).sort((a,b)=>a.key.localeCompare(b.key)).map(x=>x.value) }
export const aggregateChecks = { actions, env, case: caseCheck, licenses, readme, weight }
