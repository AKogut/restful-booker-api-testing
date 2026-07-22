import { readFileSync } from 'node:fs'
import { buildReport, formatReport, parseExchanges } from '@diagnostics/exchange-report'

const path = process.argv[2] ?? process.env.HTTP_LOG_FILE ?? 'exchanges.jsonl'

let contents: string
try {
  contents = readFileSync(path, 'utf8')
} catch {
  console.info(`No exchange log at ${path} — nothing to summarise.`)
  process.exit(0)
}

const exchanges = parseExchanges(contents)
if (exchanges.length === 0) {
  console.info(`Exchange log at ${path} contained no usable entries.`)
  process.exit(0)
}

console.info(formatReport(buildReport(exchanges)))
