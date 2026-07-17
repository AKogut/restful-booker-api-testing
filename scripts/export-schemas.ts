import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { schemaRegistry } from '../src/schemas/registry'

const outputDir = fileURLToPath(new URL('../schemas', import.meta.url))

rmSync(outputDir, { recursive: true, force: true })
mkdirSync(outputDir, { recursive: true })

for (const [name, schema] of Object.entries(schemaRegistry)) {
  const jsonSchema = zodToJsonSchema(schema, name)
  writeFileSync(`${outputDir}/${name}.json`, `${JSON.stringify(jsonSchema, null, 2)}\n`)
}

process.stdout.write(`Exported ${Object.keys(schemaRegistry).length} JSON Schemas to schemas/\n`)
