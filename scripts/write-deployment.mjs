import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const project = resolve(process.env.PROJECT_DIR || process.cwd())
const output = resolve(
  process.env.WEB_DIR || join(process.env.RUNNER_TEMP || '/tmp', 'omgithub-web')
)
const directory = join(project, 'dist')

mkdirSync(output, { recursive: true })
writeFileSync(
  join(output, 'deployment-output.json'),
  `${JSON.stringify({ project, directory }, null, 2)}\n`
)

console.log(`Deployment output: ${directory}`)
console.log(`Metadata written: ${join(output, 'deployment-output.json')}`)
