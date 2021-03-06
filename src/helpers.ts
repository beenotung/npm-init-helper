import * as degit from 'degit'
import * as fs from 'fs'
import type { ReadStream, WriteStream } from 'fs'
import * as fsExtra from 'fs-extra'
import * as path from 'path'
import * as readline from 'readline'

export async function cloneGitRepo(options: {
  src: string // e.g. https://github.com/beenotung/cs-gen#template-macro
  showLog?: boolean
  showWarn?: boolean
  dest: string // path of output folder
}) {
  if (options.showLog) {
    console.log('Cloning from', options.src, '...')
  }
  let git = degit(options.src)
  if (options.showWarn) {
    git.on('warn', info => console.error(info.message))
  }
  await git.clone(options.dest)
}

export async function getDest(options?: {
  input?: ReadStream // default process.stdin
  output?: WriteStream // default process.stdout
  name?: string // default 'project directory'
}) {
  options = options || {}
  let input = options.input || process.stdin
  let output = options.output || process.stdout
  let name = options.name || 'project directory'
  let question = name + ': '

  let dest = process.argv[2]
  if (!dest) {
    let io = readline.createInterface({
      input,
      output,
    })
    dest = await new Promise(resolve => io.question(question, resolve))
    io.close()
  }
  if (!dest) {
    console.error('Please specify the', name)
    process.exit(1)
  }
  if (fs.existsSync(dest)) {
    console.error('Error:', dest, 'already exists')
    process.exit(1)
  }
  return dest
}

export async function cloneTemplate(options: {
  dest?: string // can be obtained from `getDest()`
  gitSrc: string // e.g. https://github.com/beenotung/cs-gen#template-macro
  srcDir: string // e.g. template/demo-server
  showLog?: boolean
  showWarn?: boolean
  updatePackageJson?: boolean
  skipRenameIgnoreFile?: boolean
}) {
  let dest = options.dest || (await getDest())
  let repoDir = fs.mkdtempSync(dest + '.tmp')
  await cloneGitRepo({
    src: options.gitSrc,
    dest: repoDir,
    showLog: options.showLog,
    showWarn: options.showWarn,
  })
  try {
    if (options.showLog) {
      console.log('Creating a new project in', dest, '...')
    }
    let src = path.join(repoDir, options.srcDir)
    fs.renameSync(src, dest)
  } catch (error) {
    fs.rmdirSync(repoDir, { recursive: true })
    throw error
  }
  if (options.updatePackageJson) {
    updatePackageJsonName(dest)
  }
  if (!options.skipRenameIgnoreFile) {
    fixIgnoreFilename(dest)
  }
}

export async function copyTemplate(options: {
  srcDir: string // e.g. __dirname/template/demo-server
  dest?: string // can be obtained from `getDest()`
  verbose?: boolean
  updatePackageJson?: boolean
  skipRenameIgnoreFile?: boolean
}) {
  let dest = options.dest || (await getDest())
  if (options.verbose) {
    console.log('Creating a new project in', dest, '...')
  }
  fsExtra.copySync(options.srcDir, dest)
  if (options.updatePackageJson) {
    updatePackageJsonName(dest)
  }
  if (!options.skipRenameIgnoreFile) {
    fixIgnoreFilename(dest)
  }
}

export function readPackageJson(file: string) {
  let text = fs.readFileSync(file).toString()
  let json = JSON.parse(text)
  let indent = text
    .split('\n')
    .find(line => line !== line.trimStart() && line.includes('"'))
    ?.split('"')[0]
  function save() {
    let text = JSON.stringify(json, null, indent)
    fs.writeFileSync(file, text)
  }
  return { json, indent, save }
}

export function updatePackageJson(file: string, updateFn: (json: any) => void) {
  let pkg = readPackageJson(file)
  updateFn(pkg.json)
  pkg.save()
  return pkg
}

function updatePackageJsonName(dest: string) {
  let file = path.join(dest, 'package.json')
  let name = path.basename(dest)
  updatePackageJson(file, pkg => (pkg.name = name))
}

function fixIgnoreFilename(dest: string) {
  let git = path.join(dest, '.gitignore')
  let npm = path.join(dest, '.npmignore')
  if (!fs.existsSync(git) && fs.existsSync(npm)) {
    fs.renameSync(npm, git)
  }
}
