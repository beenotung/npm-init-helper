import { tiged } from '@beenotung/tiged'
import * as fs from 'fs'
import * as fsExtra from 'fs-extra'
import * as path from 'path'
import * as readline from 'readline'
import type { ReadLineOptions } from 'readline'
import { execSync } from 'child_process'

export async function cloneGitRepo(options: {
  src: string // e.g. https://github.com/beenotung/cs-gen#template-macro
  showLog?: boolean
  showWarn?: boolean
  dest: string // path of output folder
}) {
  if (options.showLog) {
    console.log('Cloning from', options.src, '...')
  }
  let git = tiged(options.src)
  let log = (info: { message?: string }) => console.error(info.message)
  if (options.showWarn) {
    git.on('warn', log)
  }
  await git.clone(options.dest)
  if (options.showWarn) {
    git.off('warn', log)
  }
}

export async function ask(question: string): Promise<string>
export async function ask(options: {
  question: string
  input?: ReadLineOptions['input'] // default process.stdin
  output?: ReadLineOptions['output'] // default process.stdout
}): Promise<string>
export async function ask(
  question_or_options:
    | string
    | {
        question: string
        input?: ReadLineOptions['input'] // default process.stdin
        output?: ReadLineOptions['output'] // default process.stdout
      },
): Promise<string> {
  if (typeof question_or_options === 'string')
    return ask({ question: question_or_options })
  let options = question_or_options
  let io = readline.createInterface({
    input: options.input || process.stdin,
    output: options.output || process.stdout,
  })
  let answer = await new Promise<string>(resolve =>
    io.question(options.question, resolve),
  )
  io.close()
  return answer
}

export async function getDest(options?: {
  input?: ReadLineOptions['input'] // default process.stdin
  output?: ReadLineOptions['output'] // default process.stdout
  name?: string // default 'project directory'
}) {
  options = options || {}
  let input = options.input || process.stdin
  let output = options.output || process.stdout
  let name = options.name || 'project directory'
  let question = name + ': '

  let dest = process.argv[2]
  if (!dest) {
    dest = await ask({ question, input, output })
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
    fs.rmSync(repoDir, { recursive: true })
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

const hasExecCmd = process.platform == 'win32' ? 'where' : 'command -v'

export function hasExec(name: string): boolean {
  try {
    execSync(hasExecCmd + ' ' + JSON.stringify(name))
    return true
  } catch (error) {
    return false
  }
}

export function findAnyExec(names: string[]): string | undefined {
  for (let name of names) {
    if (hasExec(name)) {
      return name
    }
  }
}
