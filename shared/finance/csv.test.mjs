import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dollarsToCents } from './money.ts'
import { detectParser, importUploads, parseCsvText, parseRows, rowsToObjects } from './csv.ts'
import { emptyState } from './types.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../backend/tests/fixtures')
const chase = readFileSync(join(root, 'Chase1561_Activity.csv'), 'utf8')
const objects = rowsToObjects(parseCsvText(chase))
if (detectParser('Chase1561_Activity.csv', Object.keys(objects[0])) !== 'chase_credit') throw new Error('parser')
const { rows } = parseRows('Chase1561_Activity.csv', objects)
if (rows[0].amount_cents !== 999) throw new Error(`amt ${rows[0].amount_cents}`)
if (rows[2].who !== 'A') throw new Error('who')
if (dollarsToCents('12.95') !== 1295) throw new Error('cents')
const state = emptyState()
const result = await importUploads(state, [{ name: 'Chase1561_Activity.csv', text: chase }])
if (result.rows_ok !== 3) throw new Error(`import ${result.rows_ok}`)
const again = await importUploads(state, [{ name: 'Chase1561_Activity.csv', text: chase }])
if (again.rows_skipped !== 3) throw new Error('idempotent')
console.log('shared csv ok')
