import { readdirSync, rmdirSync } from 'fs'
import { cloneGitRepo } from '../src/helpers'
import { execSync } from 'child_process'

async function main() {
  execSync('rm -rf output')
  await cloneGitRepo({
    src: 'https://github.com/beenotung/cs-gen#template-macro',
    dest: 'output/cs-gen',
  })
  let filenames = readdirSync('output/cs-gen')
  console.log('cloned files:', filenames)
  rmdirSync('output', { recursive: true })
}
main().catch(error => {
  console.error(error)
  process.exit(1)
})
