import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const core = readFileSync(resolve(root, 'core.js'), 'utf8')
const customization = readFileSync(resolve(root, 'customization.js'), 'utf8')
const source = readFileSync(resolve(root, 'client.source.js'), 'utf8')
const importLine = /^import \{[^}]+\} from '\.\/core\.js'\r?\n/m
const customizationImport = /^import \{[^}]+\} from '\.\/customization\.js'\r?\n/m
if (!importLine.test(source)) throw new Error('expected a single core.js import')
if (!customizationImport.test(source)) throw new Error('expected a single customization.js import')
const output = `(function () {\n${core.replace(/^export /gm, '')}\n${customization.replace(/^export /gm, '')}\n${source.replace(importLine, '').replace(customizationImport, '')}\n})();\n`
writeFileSync(resolve(root, 'client.js'), output)
