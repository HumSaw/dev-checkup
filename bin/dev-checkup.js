#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { actions, env, caseCheck, shape, shapeDiff, scrub, boundaries, readme, weight, licenses, shuffle, aggregateChecks } from '../src/index.js'

const argv = process.argv.slice(2)
const json = argv.includes('--json')
const args = argv.filter(value => value !== '--json')
const command = args.shift()
const help = `dev-checkup <command> [path] [options]

Commands:
  all          Run safe repository checks
  actions      Audit GitHub Actions pinning and permissions
  env          Compare source usage with .env.example
  case         Find path case collisions and import mismatches
  shape        capture <file> | compare <baseline> <file>
  shuffle      Deterministically shuffle arguments after --
  licenses     Flag dependency licenses needing review
  webhooks     Redact sensitive JSON keys from a file or stdin
  boundaries   Check imports using dev-checkup.config.json
  readme       Find broken local Markdown links
  weight       Find files at or above --bytes (default 1 MiB)

Global: --json
Exit codes: 0 clean, 1 findings, 2 usage/input error.`
const repositoryCommands = new Set(['all', 'actions', 'env', 'case', 'licenses', 'readme', 'weight', 'boundaries'])
function option(name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined }
function positional() { const values = []; for (let index = 0; index < args.length; index++) { if (args[index].startsWith('--')) { index++; continue } values.push(args[index]) } return values }
function output(value) { if (json) console.log(JSON.stringify(value, null, 2)); else if (Array.isArray(value)) console.log(value.length ? value.map(item => `${item.rule}: ${item.file} — ${item.message}`).join('\n') : 'No findings'); else console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2)) }
function readJson(file) { if (!file) throw new Error('Missing JSON file'); return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')) }
try {
  if (!command || ['help', '-h', '--help'].includes(command)) { console.log(help); process.exit(0) }
  let result
  if (repositoryCommands.has(command)) {
    const positions = positional(); const root = path.resolve(positions[0] ?? '.')
    if (command === 'all') { result = []; for (const [name, check] of Object.entries(aggregateChecks)) result.push(...check(root).map(item => ({ check: name, ...item }))) }
    else if (command === 'actions') result = actions(root)
    else if (command === 'env') result = env(root)
    else if (command === 'case') result = caseCheck(root)
    else if (command === 'licenses') result = licenses(root)
    else if (command === 'readme') result = readme(root)
    else if (command === 'weight') { const bytes = Number(option('--bytes') ?? 1048576); if (!Number.isFinite(bytes) || bytes < 0) throw new Error('--bytes must be a non-negative number'); result = weight(root, bytes) }
    else { const config = positions[1] ?? path.join(root, 'dev-checkup.config.json'); result = boundaries(root, readJson(config)) }
  } else if (command === 'webhooks') {
    const file = positional()[0]; const text = file ? fs.readFileSync(path.resolve(file), 'utf8') : fs.readFileSync(0, 'utf8'); result = scrub(JSON.parse(text), (option('--keys') ?? '').split(',').filter(Boolean))
  } else if (command === 'shape') {
    const [mode, ...files] = positional(); if (mode === 'capture') result = shape(readJson(files[0])); else if (mode === 'compare') result = shapeDiff(readJson(files[0]), shape(readJson(files[1]))); else throw new Error('shape requires capture or compare')
  } else if (command === 'shuffle') {
    const separator = argv.indexOf('--'); const values = separator >= 0 ? argv.slice(separator + 1).filter(value => value !== '--json') : positional(); result = shuffle(values, option('--seed') ?? 'dev-checkup')
  } else throw new Error(`Unknown command: ${command}`)
  output(result)
  process.exit(Array.isArray(result) && result.some(item => item.rule !== 'shape-additive') ? 1 : 0)
} catch (error) { console.error(`dev-checkup: ${error.message}`); process.exit(2) }
