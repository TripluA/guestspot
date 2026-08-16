#!/usr/bin/env node
// i18n sanity checks:
//   1. en/ro key parity (both files must define the same keys);
//   2. every `t('...')` literal used in web/src exists in the dictionaries;
//   3. report (but don't fail on) dictionary keys never referenced by `t('...')`.
//
// Usage: node scripts/check-i18n.mjs   (exit code 1 on parity/usage violations)

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const webSrc = join(root, 'web', 'src')

function parseDict(file) {
  const src = readFileSync(file, 'utf8')
  const out = {}
  for (const m of src.matchAll(/^\s*([A-Za-z0-9_]+):\s*(?:['"`])/gm)) {
    out[m[1]] = true
  }
  return out
}

const en = parseDict(join(root, 'web', 'src', 'i18n', 'en.ts'))
const ro = parseDict(join(root, 'web', 'src', 'i18n', 'ro.ts'))

let errors = 0
const warn = (msg) => console.error('  WARN ' + msg)
const err = (msg) => { errors++; console.error('  ERROR ' + msg) }

// 1. parity
for (const k of Object.keys(en)) if (!ro[k]) err(`key '${k}' missing in ro.ts`)
for (const k of Object.keys(ro)) if (!en[k]) err(`key '${k}' missing in en.ts`)
if (errors === 0) console.log(`i18n parity ok (${Object.keys(en).length} keys en/ro)`)

// 2. usage scan
const used = new Set()
const files = []
;(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(ts|tsx)$/.test(name)) files.push(p)
  }
})(webSrc)

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(/\bt\(\s*(['"`])([^'"`]+)\1\s*\)/g)) {
    used.add(m[2])
  }
}

const unknown = [...used].filter((k) => !en[k])
if (unknown.length) {
  err(`used but undefined: ${unknown.map((k) => `'${k}'`).join(', ')}`)
} else {
  console.log(`i18n usage ok (${used.size} distinct keys used)`)
}

// 3. unused keys (advisory only)
const unused = Object.keys(en).filter((k) => !used.has(k) && !/^(login|register|settings|editUser|admin|profile|nav|validation|req|spots|dash|notification)/.test(k))
if (unused.length) warn(`possibly-unused keys: ${unused.join(', ')}`)

if (errors) {
  console.error(`check-i18n: ${errors} error(s)`)
  process.exit(1)
}
